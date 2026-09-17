"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Store, LoaderCircle, AlertCircle, Crown, Clock, XCircle, LogIn,
  ShieldCheck, ArrowRight, CalendarDays, FlaskConical, Lock,
} from 'lucide-react'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { WholesaleRequestForm } from '@/components/account/WholesaleRequestForm'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { useGuestMode } from '@/lib/auth/guestMode'
import {
  listOwnRequests, pendingRequest, latestDecision,
  type WholesaleRequest,
} from '@/lib/customer/wholesale'

/**
 * The wholesale gateway.
 *
 * This is the screen that enforces the central business rule: choosing the
 * "Wholesale Customer" card on the entry screen decided which door the shopper
 * walked through, and NOTHING more. What they find behind it is decided here by
 * public.profiles.customer_type — read from the database under the
 * "profiles read own" policy, never from the local experience preference.
 *
 * There is no separate wholesale catalog. A Wholesale VIP customer shops the
 * same storefront; the difference is that my_effective_prices returns their VIP
 * rows, which RLS physically withholds from everyone else.
 */

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Shared card chrome, so every state of this page reads as one screen. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 shadow-card">
      {children}
    </div>
  )
}

function Chip({ icon: Icon, tone }: { icon: typeof Crown; tone: 'primary' | 'amber' | 'muted' }) {
  const classes =
    tone === 'primary' ? 'border-mint-deep bg-well-strong text-primary'
    : tone === 'amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
    : 'border-border bg-muted text-muted-foreground'
  return (
    <span className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full border ${classes}`}>
      <Icon size={25} strokeWidth={1.8} />
    </span>
  )
}

export default function WholesalePage() {
  const { status, userId, profile, customerType, vipExpired } = useCustomerAuth()
  // A test identity, never an authorisation. Only used to decide which
  // explanation to show someone who is not signed in.
  const guest = useGuestMode()

  const [requestLoad, setRequestLoad] = useState<Load>({ kind: 'loading' })
  const [requests, setRequests] = useState<WholesaleRequest[]>([])

  const applyError = useCallback((err: unknown) => {
    setRequestLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Could not load your request.' })
  }, [])

  // Only signed-in customers have requests to read; anonymous visitors skip the
  // query entirely rather than firing one RLS would answer with nothing.
  // State is written only from the promise callbacks, never synchronously here.
  useEffect(() => {
    if (status !== 'signed-in') return
    let cancelled = false
    listOwnRequests()
      .then((rows) => { if (!cancelled) { setRequests(rows); setRequestLoad({ kind: 'ready' }) } })
      .catch((err) => { if (!cancelled) applyError(err) })
    return () => { cancelled = true }
  }, [status, applyError])

  // Derived rather than stored: there is nothing to load for a visitor who is
  // not signed in, so that case is "ready" by definition and never needs a
  // state write to say so.
  const load: Load = status === 'signed-in' ? requestLoad : { kind: 'ready' }

  const pending = pendingRequest(requests)
  const decision = latestDecision(requests)
  const isVip = customerType === 'wholesale_vip'

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="px-4 py-6">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-mint-deep bg-mint text-primary-strong shadow-card">
            <Store size={26} strokeWidth={1.9} />
          </span>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground text-balance">
            Wholesale
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground text-balance">
            Business purchasing, bulk orders and wholesale pricing.
          </p>
        </div>

        {(status === 'loading' || load.kind === 'loading') && status !== 'signed-out' && (
          <div className="flex items-center justify-center gap-2.5 py-14 text-sm text-muted-foreground">
            <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" /> Checking your account…
          </div>
        )}

        {/* Wholesale Guest — the portal UI, with nothing behind it.
            This is the "show the screens, withhold the data" option: the layout
            can be reviewed, while real wholesale pricing stays where it was,
            behind a verified account the database has marked wholesale_vip.
            Nothing is mocked, because a demo number sitting in a price field is
            exactly the thing that later gets quoted to a customer. */}
        {status === 'signed-out' && guest !== null && (
          <div className="space-y-4">
            <div className="rounded-[26px] border-2 border-dashed border-amber-500/45 bg-amber-500/8 p-6">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/40 bg-amber-400/20 text-amber-700 dark:text-amber-400">
                <FlaskConical size={25} strokeWidth={1.9} />
              </span>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
                Wholesale demo · test mode
              </p>
              <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
                You are viewing the wholesale portal as a guest
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Every wholesale screen, navigation path and component can be reviewed from here.
                What is deliberately absent is the data: a guest has no Supabase session, so the
                database answers as an anonymous caller and returns retail prices only.
              </p>
            </div>

            <Panel>
              <Chip icon={Lock} tone="muted" />
              <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
                Wholesale pricing needs a verified account
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                Wholesale VIP prices are released by PostgreSQL to accounts an administrator has
                approved, and to nobody else. Selecting &ldquo;Wholesale Guest&rdquo; asks to see the
                wholesale experience; it does not — and cannot — make this device a wholesale
                customer.
              </p>
              <div className="flex flex-col gap-2.5">
                <Link href="/account/sign-in" className="w-full">
                  <Button fullWidth size="lg">Sign in</Button>
                </Link>
                <Link href="/categories" className="w-full">
                  <Button fullWidth size="lg" variant="secondary">Browse the store</Button>
                </Link>
              </div>
            </Panel>

            <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" />
              Guest mode is a testing feature of this build only. It is compiled out of production
              builds and grants no access of any kind.
            </p>
          </div>
        )}

        {/* Not signed in — the tier cannot be known without a session. */}
        {status === 'signed-out' && guest === null && (
          <Panel>
            <Chip icon={LogIn} tone="primary" />
            <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">Sign in to continue</h2>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              Wholesale pricing is tied to your account, so we need to know who you are before we
              can show it. Continue with Google — if your account is new to Apple Expert, signing in
              creates it.
            </p>
            <div className="flex flex-col gap-2.5">
              <Link href="/account/sign-in" className="w-full">
                <Button fullWidth size="lg">Sign in</Button>
              </Link>
              <Link href="/categories" className="w-full">
                <Button fullWidth size="lg" variant="secondary">Browse the store</Button>
              </Link>
            </div>
          </Panel>
        )}

        {status === 'error' && (
          <Panel>
            <Chip icon={AlertCircle} tone="amber" />
            <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
              We could not read your account
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You are still signed in — only the account lookup failed. Check your connection and
              pull to refresh.
            </p>
          </Panel>
        )}

        {status === 'signed-in' && load.kind === 'error' && (
          <Panel>
            <Chip icon={AlertCircle} tone="amber" />
            <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
              Could not load your request
            </h2>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{load.message}</p>
            <Button onClick={() => {
              setRequestLoad({ kind: 'loading' })
              void listOwnRequests()
                .then((rows) => { setRequests(rows); setRequestLoad({ kind: 'ready' }) })
                .catch(applyError)
            }}>
              Try again
            </Button>
          </Panel>
        )}

        {/* Approved: the database says wholesale_vip. */}
        {status === 'signed-in' && load.kind === 'ready' && isVip && (
          <div className="space-y-4">
            <Panel>
              <Chip icon={Crown} tone="primary" />
              <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
                Wholesale access is active
              </h2>
              <p className="mb-1.5 text-sm leading-relaxed text-muted-foreground">
                {profile?.full_name ? `${profile.full_name}, your` : 'Your'} account is on Wholesale
                VIP pricing. Wholesale prices are already applied throughout the store — you will
                see them on every product that has one, and the retail price everywhere else.
              </p>
              {profile?.vip_expires_at && (
                <p className="mt-3 flex items-center gap-2 rounded-xl border border-mint/70 dark:border-border bg-card px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
                  <CalendarDays size={13} className="shrink-0" />
                  Your wholesale pricing runs until {formatDate(profile.vip_expires_at)}.
                </p>
              )}
              <Link href="/categories" className="mt-5 block">
                <Button fullWidth size="lg">
                  Start shopping
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
            </Panel>

            <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" />
              Wholesale prices are resolved by the database for your account. They are never
              calculated on this device.
            </p>
          </div>
        )}

        {/* Signed in, not VIP. */}
        {status === 'signed-in' && load.kind === 'ready' && !isVip && (
          <div className="space-y-4">
            {vipExpired && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <Clock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-[13px] leading-snug text-foreground">
                  Your wholesale pricing has expired, so your account is back on retail prices.
                  Apply again below to have it renewed.
                </p>
              </div>
            )}

            {pending ? (
              <Panel>
                <Chip icon={Clock} tone="amber" />
                <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
                  Your request is under review
                </h2>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  We received your application for{' '}
                  <strong className="font-semibold text-foreground">{pending.business_name}</strong>{' '}
                  on {formatDate(pending.created_at)}. Apple Expert reviews each one by hand, and
                  wholesale prices appear automatically once it is approved.
                </p>
                <p className="text-[12.5px] text-muted-foreground">
                  You are shopping at retail prices until then.
                </p>
                <Link href="/categories" className="mt-5 block">
                  <Button fullWidth variant="secondary">Continue shopping</Button>
                </Link>
              </Panel>
            ) : decision?.status === 'rejected' ? (
              <>
                <Panel>
                  <Chip icon={XCircle} tone="muted" />
                  <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
                    Your last request was not approved
                  </h2>
                  <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                    Reviewed on {decision.reviewed_at ? formatDate(decision.reviewed_at) : formatDate(decision.updated_at)}.
                  </p>
                  {decision.review_note && (
                    <p className="rounded-xl border border-mint/70 dark:border-border bg-card px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
                      {decision.review_note}
                    </p>
                  )}
                  <p className="mt-3 text-[12.5px] text-muted-foreground">
                    You are welcome to apply again with updated details.
                  </p>
                </Panel>
                {userId && (
                  <WholesaleRequestForm
                    profileId={userId}
                    onSubmitted={(request) => setRequests((prev) => [request, ...prev])}
                  />
                )}
              </>
            ) : (
              userId && (
                <WholesaleRequestForm
                  profileId={userId}
                  onSubmitted={(request) => setRequests((prev) => [request, ...prev])}
                />
              )
            )}

            <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" />
              Submitting a request does not change your pricing. Wholesale VIP is granted only by an
              Apple Expert administrator after review.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
