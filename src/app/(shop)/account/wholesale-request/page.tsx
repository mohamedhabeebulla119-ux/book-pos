"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Store, LoaderCircle, AlertCircle, Clock, XCircle, ShieldCheck } from 'lucide-react'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { WholesaleRequestForm } from '@/components/account/WholesaleRequestForm'
import { Panel, Chip, formatDate } from '@/components/account/wholesaleUi'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import {
  listOwnRequests, pendingRequest, latestDecision,
  type WholesaleRequest,
} from '@/lib/customer/wholesale'

/**
 * Wholesale access request — part of the RETAIL account area.
 *
 * CustomerRouteGuard lets only accounts the database resolves as `retail`
 * reach this page, and keeps them out of the Wholesale storefront itself.
 * Applying writes a row to wholesale_access_requests (RLS: own rows, customer
 * columns only) and changes nothing else: Wholesale VIP is granted solely by an
 * administrator through admin_review_wholesale_request() →
 * admin_set_customer_type().
 */

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }

export default function WholesaleRequestPage() {
  const { userId, vipExpired } = useCustomerAuth()

  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [requests, setRequests] = useState<WholesaleRequest[]>([])

  const applyError = useCallback((err: unknown) => {
    setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Could not load your request.' })
  }, [])

  // State is written only from the promise callbacks, never synchronously here.
  useEffect(() => {
    let cancelled = false
    listOwnRequests()
      .then((rows) => { if (!cancelled) { setRequests(rows); setLoad({ kind: 'ready' }) } })
      .catch((err) => { if (!cancelled) applyError(err) })
    return () => { cancelled = true }
  }, [applyError])

  const pending = pendingRequest(requests)
  const decision = latestDecision(requests)

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="px-4 py-6">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-mint-deep bg-mint text-primary-strong shadow-card">
            <Store size={26} strokeWidth={1.9} />
          </span>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground text-balance">
            Wholesale access
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground text-balance">
            Business purchasing, bulk orders and wholesale pricing — granted after review.
          </p>
        </div>

        {load.kind === 'loading' && (
          <div className="flex items-center justify-center gap-2.5 py-14 text-sm text-muted-foreground">
            <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" /> Checking your account…
          </div>
        )}

        {load.kind === 'error' && (
          <Panel>
            <Chip icon={AlertCircle} tone="amber" />
            <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
              Could not load your request
            </h2>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{load.message}</p>
            <Button onClick={() => {
              setLoad({ kind: 'loading' })
              void listOwnRequests()
                .then((rows) => { setRequests(rows); setLoad({ kind: 'ready' }) })
                .catch(applyError)
            }}>
              Try again
            </Button>
          </Panel>
        )}

        {load.kind === 'ready' && (
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
