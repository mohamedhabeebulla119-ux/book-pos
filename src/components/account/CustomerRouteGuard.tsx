"use client"

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AlertCircle, LoaderCircle, LogOut, RotateCw } from 'lucide-react'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { decideAccess } from '@/lib/customer/access'
import { hasCompletedOnboarding } from '@/utils/onboarding'
import { getExperience } from '@/utils/experience'

/**
 * Route protection for the whole customer app.
 *
 * `output: "export"` means there is no server and no middleware, so the check
 * runs here, before any store screen renders: the store shell (bottom nav
 * included) is withheld until decideAccess() says `render`, which cannot happen
 * until the session and the account's profiles.customer_type are loaded. A
 * Wholesale VIP therefore never sees the Retail home flash up before being
 * redirected, and vice versa.
 *
 * Mounted once in the (shop) layout, so it covers normal navigation, direct
 * URLs, refreshes, Capacitor deep links and session restoration alike: each of
 * those is just a pathname change or a new session reaching this component.
 */
export function CustomerRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const { access } = useCustomerAuth()

  // The local entry flags only sequence the signed-out screens (onboarding,
  // then type selection, then sign-in). They are read during render; on the
  // server and the first client render `access` is 'loading', so they are not
  // consulted until after hydration.
  const decision = decideAccess(access, pathname, {
    onboarded: typeof window !== 'undefined' && hasCompletedOnboarding(),
    experienceChosen: typeof window !== 'undefined' && getExperience() !== null,
  })
  const redirectTo = decision.kind === 'redirect' ? decision.to : null

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo)
  }, [redirectTo, router])

  if (decision.kind === 'render') return <>{children}</>
  if (decision.kind === 'error') return <AccountUnavailable />
  return <div className="min-h-screen bg-background" aria-busy="true" />
}

/** Signed in, but the account's type could not be read — so nothing is shown. */
function AccountUnavailable() {
  const { refresh, signOut } = useCustomerAuth()
  const [retrying, setRetrying] = useState(false)

  async function retry() {
    setRetrying(true)
    try { await refresh() } finally { setRetrying(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 text-center shadow-card">
        <span className="mx-auto mb-4 flex h-13 w-13 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertCircle size={23} strokeWidth={1.9} />
        </span>
        <h1 className="mb-1.5 text-lg font-bold tracking-tight">We could not load your account</h1>
        <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
          You are still signed in. Check your connection and try again.
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="focus-ring flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-cta text-[14px] font-semibold text-white shadow-glow disabled:opacity-70"
          >
            {retrying
              ? <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" />
              : <RotateCw size={16} />}
            Try again
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="focus-ring flex h-11 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold text-red-500"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
