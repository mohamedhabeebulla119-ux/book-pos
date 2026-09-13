"use client"

import { useSyncExternalStore } from 'react'

/**
 * GUEST TEST MODE — a development/testing shortcut, not authentication.
 *
 * Apple Expert's real customer authentication is phone + SMS OTP. Until an SMS
 * provider is bought and configured, nobody can complete that flow, so this
 * gives the team a way to walk through the retail and wholesale screens.
 *
 * WHAT A GUEST IS: a label in this browser tab saying "show me the retail
 * screens" or "show me the wholesale screens". That is the whole feature.
 *
 * WHAT A GUEST IS NOT, and cannot become:
 *
 *   - a Supabase session. No token is minted, stored or faked; `getSession()`
 *     still returns null, so every query runs as the anonymous role.
 *   - a customer_type. Pricing is resolved by the database from
 *     private.current_customer_type(), which reads auth.uid(). A guest has no
 *     auth.uid(), so PostgreSQL hands back public retail prices and physically
 *     withholds every wholesale_vip row. Nothing on this device can change that.
 *   - a database row. No profile, no auth user, no fake VIP record.
 *
 * Two independent switches have to be on for any of it to exist:
 *
 *   1. NEXT_PUBLIC_ENABLE_GUEST_MODE === 'true' AT BUILD TIME. Next.js inlines
 *      the literal into the bundle, so a production build made without it
 *      contains no reachable guest path at all — the entry buttons never render
 *      and every accessor below returns null.
 *   2. Someone explicitly choosing a guest option on the entry screen in this
 *      browser session.
 *
 * State lives in sessionStorage rather than localStorage on purpose: a test
 * identity should not survive the app being closed, and it must never sit
 * beside real preferences as though it were a durable account.
 */

/**
 * The runtime guard for every function in this module.
 *
 * Read as a STATIC reference so Next.js inlines it at build time. A dynamic
 * `process.env[name]` lookup would not be replaced, and would be `undefined`
 * inside the Capacitor WebView, where there is no Node process at runtime.
 *
 * Screens that RENDER guest UI write the comparison out inline instead of
 * importing this, so the minifier can delete their markup entirely — it will
 * not fold a constant across a module boundary. Both spellings read the same
 * variable; this one exists so the store's guards have a single named home.
 */
export const GUEST_MODE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GUEST_MODE === 'true'

/** Which set of screens a guest asked to look at. Never a permission. */
export type GuestExperience = 'retail' | 'wholesale'

const STORAGE_KEY = 'apple-expert-guest-test-mode'

function isGuestExperience(value: string | null): value is GuestExperience {
  return value === 'retail' || value === 'wholesale'
}

// ---------------------------------------------------------------------------
// Module store
// ---------------------------------------------------------------------------
// The same external-store shape the catalog uses, so no provider has to be
// added to the customer layout and nothing re-renders that does not read it.
// ---------------------------------------------------------------------------

let current: GuestExperience | null = null
let hydrated = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** Reads sessionStorage once, then serves from memory so snapshots stay stable. */
function hydrate(): void {
  if (hydrated) return
  hydrated = true
  if (!GUEST_MODE_ENABLED || typeof window === 'undefined') return
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    current = isGuestExperience(stored) ? stored : null
  } catch {
    // Blocked storage: the tester simply picks a guest option again.
    current = null
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getSnapshot(): GuestExperience | null {
  hydrate()
  return current
}

/** Prerendered HTML must never claim a guest session. */
function getServerSnapshot(): null {
  return null
}

/**
 * The active guest experience, or null.
 *
 * Always null when the build has guest mode switched off, whatever is in
 * storage — a stale value from a test build can never resurrect the feature in
 * a production one.
 */
export function useGuestMode(): GuestExperience | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Non-reactive read, for event handlers and routing decisions. */
export function getGuestExperience(): GuestExperience | null {
  return getSnapshot()
}

export function startGuestSession(experience: GuestExperience): void {
  if (!GUEST_MODE_ENABLED) return
  hydrate()
  current = experience
  try {
    window.sessionStorage.setItem(STORAGE_KEY, experience)
  } catch {
    // Non-fatal: the choice still applies for this render, it just is not kept.
  }
  emit()
}

/** Ends the test identity. Called on "Exit test mode" and on real sign-in. */
export function endGuestSession(): void {
  hydrate()
  current = null
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored to clear.
  }
  emit()
}
