"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Store, LoaderCircle, AlertCircle, Clock, XCircle, ShieldCheck, LifeBuoy, Search, Crown, Send,
} from 'lucide-react'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { WholesaleRequestForm } from '@/components/account/WholesaleRequestForm'
import { Panel, Chip, formatDate } from '@/components/account/wholesaleUi'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import {
  listOwnRequests, openRequest, latestDecision, inputFromRequest, saveApplication, describeSaveError,
  REQUEST_STATUS_LABEL, isRequestStatus, EMPTY_REQUEST_INPUT,
  type WholesaleRequest, type SaveAction,
} from '@/lib/customer/wholesale'

/**
 * Wholesale application + status page.
 *
 * Every state shown here comes from the customer's own rows in
 * wholesale_access_requests (RLS: own rows only), and every write goes through
 * customer_save_wholesale_application(). None of it grants access: the
 * Wholesale Portal opens only for an account the database resolves as
 * wholesale_vip, which happens solely when an administrator approves the
 * application (admin_review_wholesale_request() → admin_set_customer_type()).
 */

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }

const ASSISTANCE_SENT =
  'Your request has been sent to our admin team. We will review your details and help complete your wholesale application.'

function StatusLine({ status }: { status: string }) {
  return (
    <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      Status: <span className="text-foreground">{isRequestStatus(status) ? REQUEST_STATUS_LABEL[status] : status}</span>
    </p>
  )
}

export default function WholesaleRequestPage() {
  const { vipExpired, isWholesaleVip, access, refresh } = useCustomerAuth()

  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [requests, setRequests] = useState<WholesaleRequest[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [helpBusy, setHelpBusy] = useState(false)
  const [helpError, setHelpError] = useState<string | null>(null)

  const applyError = useCallback((err: unknown) => {
    setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Could not load your application.' })
  }, [])

  // State is written only from the promise callbacks, never synchronously here.
  useEffect(() => {
    let cancelled = false
    listOwnRequests()
      .then((rows) => { if (!cancelled) { setRequests(rows); setLoad({ kind: 'ready' }) } })
      .catch((err) => { if (!cancelled) applyError(err) })
    return () => { cancelled = true }
  }, [applyError])

  const open = openRequest(requests)
  const decision = latestDecision(requests)

  // Approved while this account was signed in: the cached profile still says
  // retail. Re-read it, so the database decides what the customer sees next.
  // Only once: if the database still says retail afterwards (VIP was revoked
  // later), the customer may simply apply again.
  const [profileRechecked, setProfileRechecked] = useState(false)
  const approvedButStale =
    !open && decision?.status === 'approved' && access === 'retail' && !vipExpired && !profileRechecked
  useEffect(() => {
    if (!approvedButStale) return
    let cancelled = false
    void refresh().finally(() => { if (!cancelled) setProfileRechecked(true) })
    return () => { cancelled = true }
  }, [approvedButStale, refresh])

  function upsert(request: WholesaleRequest) {
    setRequests((prev) => [request, ...prev.filter((r) => r.id !== request.id)])
  }

  function handleSaved(request: WholesaleRequest, action: SaveAction) {
    upsert(request)
    setNotice(action === 'assistance' ? ASSISTANCE_SENT : null)
  }

  async function requestHelpForSubmitted(current: WholesaleRequest) {
    setHelpError(null)
    setHelpBusy(true)
    try {
      upsert(await saveApplication(inputFromRequest(current), 'assistance'))
      setNotice(ASSISTANCE_SENT)
    } catch (err) {
      setHelpError(describeSaveError(err))
    } finally {
      setHelpBusy(false)
    }
  }

  function renderBody() {
    // Approved and the database prices this account as Wholesale VIP.
    if (isWholesaleVip) {
      return (
        <Panel>
          <Chip icon={Crown} tone="primary" />
          <StatusLine status="approved" />
          <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
            Your wholesale account has been approved.
          </h2>
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            Wholesale VIP pricing is applied automatically to eligible products.
          </p>
          <Link href="/wholesale" className="block">
            <Button fullWidth>Enter Wholesale Portal</Button>
          </Link>
        </Panel>
      )
    }

    if (open?.status === 'draft') {
      return (
        <>
          <Panel>
            <Chip icon={Clock} tone="muted" />
            <StatusLine status="draft" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your application is saved but has not been sent yet. Finish it below, or ask our team for help.
            </p>
          </Panel>
          <WholesaleRequestForm key={open.id} initial={inputFromRequest(open)} onSaved={handleSaved} />
        </>
      )
    }

    if (open) {
      const copy =
        open.status === 'assistance_requested'
          ? { icon: LifeBuoy, title: 'Our admin team has been asked to help complete your application.',
              body: 'An Apple Expert team member will review your details, complete anything missing and contact you if they need more information.' }
          : open.status === 'under_review'
            ? { icon: Search, title: 'Your application is currently being reviewed.',
                body: 'An administrator is reviewing your application. You will see the decision here.' }
            : { icon: Clock, title: 'Your wholesale application has been submitted and is awaiting review.',
                body: `We received it on ${formatDate(open.submitted_at ?? open.created_at)}. Apple Expert reviews every application by hand.` }

      return (
        <Panel>
          <Chip icon={copy.icon} tone="amber" />
          <StatusLine status={open.status} />
          <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">{copy.title}</h2>
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
          {open.business_name.trim() && (
            <p className="mb-3 text-[13px] text-muted-foreground">
              Business: <strong className="font-semibold text-foreground">{open.business_name}</strong>
            </p>
          )}
          <p className="text-[12.5px] text-muted-foreground">
            Your application has not yet been approved, so you are shopping at retail prices.
          </p>

          {open.status === 'pending' && (
            <div className="mt-4 rounded-2xl border border-mint-deep/70 dark:border-border bg-card px-4 py-3.5">
              <p className="text-[13px] font-semibold text-foreground">Need help with your application?</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                Our team can review and complete it with you.
              </p>
              {helpError && <p role="alert" className="mt-2 text-[12.5px] text-red-500">{helpError}</p>}
              <Button variant="secondary" size="sm" className="mt-2.5" disabled={helpBusy}
                onClick={() => void requestHelpForSubmitted(open)}>
                {helpBusy ? 'Sending…' : 'Request Admin Assistance'}
              </Button>
            </div>
          )}

          <Link href="/categories" className="mt-5 block">
            <Button fullWidth variant="secondary">Continue shopping</Button>
          </Link>
        </Panel>
      )
    }

    if (decision?.status === 'rejected') {
      return (
        <>
          <Panel>
            <Chip icon={XCircle} tone="muted" />
            <StatusLine status="rejected" />
            <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
              Your application requires changes.
            </h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Reviewed on {formatDate(decision.reviewed_at ?? decision.updated_at)}.
            </p>
            {decision.review_note && (
              <div className="rounded-xl border border-mint/70 dark:border-border bg-card px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Reason</p>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground">{decision.review_note}</p>
              </div>
            )}
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              Update your details below and resubmit. An administrator will review it again.
            </p>
          </Panel>
          <WholesaleRequestForm
            key={decision.id} title="Update and resubmit"
            initial={inputFromRequest(decision)} onSaved={handleSaved}
          />
        </>
      )
    }

    if (approvedButStale) {
      return (
        <div className="flex items-center justify-center gap-2.5 py-14 text-sm text-muted-foreground">
          <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" /> Updating your account…
        </div>
      )
    }

    return <WholesaleRequestForm initial={EMPTY_REQUEST_INPUT} onSaved={handleSaved} />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="px-4 py-6">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-mint-deep bg-mint text-primary-strong shadow-card">
            <Store size={26} strokeWidth={1.9} />
          </span>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground text-balance">
            Your Wholesale Access
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
              Could not load your application
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
            {notice && (
              <div role="status" className="flex items-start gap-2.5 rounded-2xl border border-mint-deep bg-primary-soft px-4 py-3">
                <Send size={15} className="mt-0.5 shrink-0 text-primary" />
                <p className="text-[13px] leading-snug text-foreground">{notice}</p>
              </div>
            )}

            {vipExpired && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <Clock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-[13px] leading-snug text-foreground">
                  Your wholesale pricing has expired, so your account is back on retail prices.
                  Apply again below to have it renewed.
                </p>
              </div>
            )}

            {renderBody()}

            <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" />
              Applying does not change your pricing. Wholesale VIP is granted only by an Apple Expert
              administrator after review.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
