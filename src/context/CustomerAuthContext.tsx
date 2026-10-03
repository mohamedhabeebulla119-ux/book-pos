"use client"

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { reloadCatalog } from '@/lib/catalog'
import {
  fetchOwnProfile, resolveCustomerType, isVipExpired,
  type CustomerProfile, type CustomerType,
} from '@/lib/customer/profile'
import { resolveAccess, type CustomerAccess } from '@/lib/customer/access'
import { clearExperience } from '@/utils/experience'

/**
 * Customer session + profile state.
 *
 * Deliberately a SECOND context rather than a generalisation of
 * AdminAuthContext: the two answer different questions of the same session.
 * AdminAuthContext asks "may this person administer the store", and lives only
 * under (admin). This one asks "who is shopping, and at which tier", and lives
 * only under (shop). They share the one Supabase client — and therefore the one
 * session — so nothing is signed in twice.
 *
 *   'loading'    – resolving the session or the profile read
 *   'signed-out' – no Supabase session; the storefront still works, anonymously
 *   'signed-in'  – authenticated, profile loaded
 *   'error'      – the profile read failed; NOT collapsed into signed-out, so a
 *                  network blip never looks like being logged out
 */
export type CustomerAuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'error'

interface CustomerAuthValue {
  status: CustomerAuthStatus
  userId: string | null
  email: string | null
  /**
   * The phone number Supabase Auth VERIFIED by SMS code, as E.164 with the '+'.
   * Null unless auth.users.phone_confirmed_at is set. Deliberately not
   * profiles.phone, which the customer can edit freely.
   */
  phone: string | null
  profile: CustomerProfile | null
  /**
   * The tier this customer is priced at, mirroring
   * private.current_customer_type(). Anonymous and expired-VIP resolve to
   * 'retail'. This LABELS; it never decides a price.
   */
  customerType: CustomerType
  /**
   * The single access state every route guard and navigation link reads:
   * loading / unauthenticated / error / retail / wholesale_vip. Built only from
   * the session and profiles.customer_type — see lib/customer/access.ts.
   */
  access: CustomerAccess
  /**
   * `access === 'wholesale_vip'` — the one flag the VIP identity badges read.
   * False while loading, signed out or on a profile-read error, so the UI
   * never shows a VIP badge before the database has confirmed the tier.
   */
  isWholesaleVip: boolean
  /** True when a VIP grant exists but has lapsed — worth telling them about. */
  vipExpired: boolean
  errorMessage: string | null
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const CustomerAuthContext = createContext<CustomerAuthValue | undefined>(undefined)

/** Evaluated once: these are build-time inlined NEXT_PUBLIC_ values. */
const CONFIGURED = isSupabaseConfigured()

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CustomerAuthStatus>(CONFIGURED ? 'loading' : 'signed-out')
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Guards against a slow profile read resolving after a newer auth event has
  // already updated the state.
  const requestRef = useRef(0)
  /** The identity the catalog was last loaded for, so a reload fires only on a real change. */
  const pricedForRef = useRef<string | null>(null)

  const applySession = useCallback(async (session: Session | null) => {
    const ticket = ++requestRef.current
    const nextUserId = session?.user?.id ?? null
    const callerChanged = pricedForRef.current !== nextUserId

    // Prices are resolved per-caller by the database, so the catalog has to be
    // re-read whenever the caller changes — including on sign-out, which drops
    // a VIP customer back to public retail prices.
    if (callerChanged) {
      pricedForRef.current = nextUserId
      reloadCatalog()
    }

    if (!session?.user) {
      setUserId(null)
      setEmail(null)
      setPhone(null)
      setProfile(null)
      setErrorMessage(null)
      setStatus('signed-out')
      return
    }

    // A different account: drop the previous customer's profile at once rather
    // than showing it beside the new identity until the read below returns. A
    // token refresh for the same account keeps the current state (no flicker).
    if (callerChanged) {
      setProfile(null)
      setStatus('loading')
    }

    setUserId(session.user.id)
    setEmail(session.user.email || null)
    // Supabase Auth stores phone numbers without the leading '+'.
    const verifiedPhone = session.user.phone_confirmed_at ? session.user.phone : ''
    setPhone(verifiedPhone ? `+${verifiedPhone.replace(/^\+/, '')}` : null)

    try {
      // "profiles read own" restricts this to the caller's own row; the id is
      // passed for the index, not as an authorisation claim.
      const row = await fetchOwnProfile(session.user.id)
      if (ticket !== requestRef.current) return

      setProfile(row)
      setErrorMessage(null)
      setStatus('signed-in')
    } catch (err) {
      if (ticket !== requestRef.current) return
      // Still signed in — only the profile read failed. Saying 'signed-out'
      // here would bounce them out of pages they are entitled to see.
      setProfile(null)
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Could not load your account.')
    }
  }, [])

  /** Re-reads the session and profile. Called from event handlers, never an effect. */
  const refresh = useCallback(async () => {
    if (!CONFIGURED) return
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    await applySession(session)
  }, [applySession])

  useEffect(() => {
    if (!CONFIGURED) return

    // Subscribing is enough to bootstrap: supabase-js emits INITIAL_SESSION to
    // every new listener immediately (with a null session when there is none),
    // so no separate initial fetch is needed and state is only ever set from
    // this external-system callback.
    const supabase = getSupabaseClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session)
    })

    return () => subscription.unsubscribe()
  }, [applySession])

  const signOut = useCallback(async () => {
    if (!CONFIGURED) return
    await getSupabaseClient().auth.signOut()
    // The next person on this device chooses their customer type afresh
    // instead of inheriting this one's. onAuthStateChange fires SIGNED_OUT,
    // which clears the profile and reloads the catalog.
    clearExperience()
  }, [])

  const customerType = resolveCustomerType(profile)
  const access = resolveAccess(status, customerType)

  return (
    <CustomerAuthContext.Provider
      value={{
        status,
        userId,
        email,
        phone,
        profile,
        customerType,
        access,
        isWholesaleVip: access === 'wholesale_vip',
        vipExpired: isVipExpired(profile),
        errorMessage,
        signOut,
        refresh,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  )
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext)
  if (context === undefined) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider')
  }
  return context
}
