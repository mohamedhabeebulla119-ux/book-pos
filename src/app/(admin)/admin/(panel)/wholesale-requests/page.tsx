"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search, X, LoaderCircle, AlertCircle, Check, Lock, Inbox, Crown,
  Mail, Phone, Building2, ShieldCheck, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { AdminPageHeading, StatCard } from '@/components/admin/AdminPage'
import { useAdminAuth } from '@/context/AdminAuthContext'
import { describeAdminError, logAdminError } from '@/lib/admin/errors'
import {
  listWholesaleRequests, reviewRequest, canReviewRequests, matchesRequestQuery,
  REQUEST_STATUS_LABEL,
  type AdminWholesaleRequest, type ReviewDecision,
} from '@/lib/admin/wholesaleRequests'

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }
type Scope = 'pending' | 'approved' | 'rejected' | 'all'

const SCOPES: readonly [Scope, string][] = [
  ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All'],
]

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'approved' ? 'border-mint-deep bg-primary-soft text-primary'
    : status === 'rejected' ? 'border-red-500/25 bg-red-500/8 text-red-500'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap', tone)}>
      {REQUEST_STATUS_LABEL[status] ?? status}
    </span>
  )
}

/** One labelled detail inside a request card. */
function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-foreground break-words">{value}</dd>
    </div>
  )
}

export default function AdminWholesaleRequestsPage() {
  const { role } = useAdminAuth()
  const canReview = canReviewRequests(role)

  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [requests, setRequests] = useState<AdminWholesaleRequest[]>([])
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>('pending')

  const [confirming, setConfirming] = useState<{ request: AdminWholesaleRequest; decision: ReviewDecision } | null>(null)
  const [note, setNote] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const applyData = useCallback((rows: AdminWholesaleRequest[]) => {
    setRequests(rows)
    setLoad({ kind: 'ready' })
  }, [])
  // Surfaces code + hint, not just message. A PostgREST embed or grant failure
  // puts the actionable fix in `hint`, and showing only `message` is what made
  // the original breakage look like an empty queue.
  const applyError = useCallback((err: unknown) => {
    logAdminError('wholesale-requests:list', err)
    setLoad({ kind: 'error', message: describeAdminError(err, 'Could not load requests.') })
  }, [])

  const refresh = useCallback(() => {
    listWholesaleRequests().then(applyData).catch(applyError)
  }, [applyData, applyError])

  // State is written only from the promise callbacks, never synchronously here.
  useEffect(() => {
    let cancelled = false
    listWholesaleRequests()
      .then((rows) => { if (!cancelled) applyData(rows) })
      .catch((err) => { if (!cancelled) applyError(err) })
    return () => { cancelled = true }
  }, [applyData, applyError])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(id)
  }, [toast])

  const filtered = useMemo(() => requests.filter((request) => {
    if (scope !== 'all' && request.status !== scope) return false
    return matchesRequestQuery(request, query)
  }), [requests, scope, query])

  const counts = useMemo(() => ({
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  }), [requests])

  async function applyDecision(request: AdminWholesaleRequest, decision: ReviewDecision) {
    setConfirming(null)
    setActionError(null)
    setPendingId(request.id)
    const who = request.customerName || request.customerEmail || request.business_name
    try {
      await reviewRequest(request.id, decision, note)
      setNote('')
      // Re-read rather than trusting local state: on approval the database also
      // changed the customer's tier, and this list shows it.
      const rows = await listWholesaleRequests()
      applyData(rows)
      setToast(decision === 'approved'
        ? `${who} now receives Wholesale VIP pricing.`
        : `${who}'s request was declined.`)
    } catch (err) {
      // Never claim success when the RPC refused.
      logAdminError('wholesale-requests:review', err)
      setActionError(describeAdminError(err, 'The database refused the decision.'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <AdminPageHeading
        title="Wholesale Requests"
        subtitle={
          load.kind === 'ready'
            ? `${counts.pending} awaiting review · ${requests.length} in total.`
            : 'Business applications for Wholesale VIP pricing.'
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        <StatCard label="Awaiting review" icon={Clock}
          value={load.kind === 'ready' ? String(counts.pending) : '—'} note="Open applications" />
        <StatCard label="Approved" icon={Crown}
          value={load.kind === 'ready' ? String(counts.approved) : '—'} note="Granted Wholesale VIP" />
        <StatCard label="Declined" icon={X}
          value={load.kind === 'ready' ? String(counts.rejected) : '—'} note="Not approved" />
      </div>

      <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-mint/70 dark:border-border bg-muted px-4 py-3">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Approving a request grants Wholesale VIP through the same audited function the VIP
          Customers page uses — the customer&apos;s pricing tier is never written directly. A
          customer choosing the &ldquo;Wholesale&rdquo; experience in the app changes nothing until
          it is approved here.
        </p>
      </div>

      {!canReview && load.kind === 'ready' && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <Lock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[13px] leading-snug text-foreground">
            You can read the queue but not decide it. The database refuses that for your role.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted-foreground">
            <Search size={16} />
          </span>
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business, name, email or phone…" aria-label="Search requests"
            className="focus-ring h-11 w-full rounded-xl border border-mint-deep dark:border-border bg-card pl-11 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45 transition-colors"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
              className="focus-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex rounded-xl border border-mint-deep dark:border-border bg-card p-1">
          {SCOPES.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setScope(value)} aria-pressed={scope === value}
              className={cn('focus-ring rounded-lg px-3 h-9 text-[13px] font-semibold whitespace-nowrap transition-colors',
                scope === value ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-[13px] leading-snug text-foreground">{actionError}</p>
        </div>
      )}

      {load.kind === 'loading' && (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted-foreground">
          <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" /> Loading requests…
        </div>
      )}

      {load.kind === 'error' && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/8 border border-red-500/20 text-red-500">
            <AlertCircle size={24} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">Could not load requests</h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">{load.message}</p>
          <Button onClick={() => { setLoad({ kind: 'loading' }); refresh() }}>Try again</Button>
        </div>
      )}

      {load.kind === 'ready' && filtered.length === 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-14 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-well-strong border border-mint-deep text-primary">
            <Inbox size={24} strokeWidth={1.8} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">
            {requests.length === 0 ? 'No requests yet' : 'Nothing here'}
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {requests.length === 0
              ? 'Applications appear here when a customer requests wholesale access from the store.'
              : 'Try a different search term or change the filter.'}
          </p>
        </div>
      )}

      {load.kind === 'ready' && filtered.length > 0 && (
        <div className="space-y-3.5">
          {filtered.map((request) => {
            const busy = pendingId === request.id
            const open = request.status === 'pending'
            return (
              <article key={request.id}
                className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card p-5">
                <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-[16px] font-bold tracking-tight text-foreground">
                      <Building2 size={16} className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{request.business_name}</span>
                    </h2>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Submitted {dateTime(request.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={request.status} />
                    {request.customerType === 'wholesale_vip' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-deep bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary whitespace-nowrap">
                        <Crown size={12} /> On VIP pricing
                      </span>
                    )}
                  </div>
                </header>

                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mb-4">
                  <Detail label="Customer" value={request.customerName || 'No name on file'} />
                  <Detail label="Business type" value={request.business_type} />
                  <Detail label="Monthly volume" value={request.monthly_volume} />
                  <Detail label="Registration" value={request.business_registration} />
                </dl>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
                  {request.customerEmail && (
                    <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground min-w-0">
                      <Mail size={12} className="shrink-0" />
                      <span className="truncate">{request.customerEmail}</span>
                    </span>
                  )}
                  {(request.contact_phone || request.customerPhone) && (
                    <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <Phone size={12} className="shrink-0" />
                      {request.contact_phone || request.customerPhone}
                    </span>
                  )}
                </div>

                {request.message && (
                  <p className="mb-4 rounded-xl border border-mint/70 dark:border-border bg-card px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
                    {request.message}
                  </p>
                )}

                {!open && (
                  <div className="rounded-xl border border-mint/70 dark:border-border bg-card px-3.5 py-3">
                    <p className="text-[12px] text-muted-foreground">
                      Reviewed {request.reviewed_at ? dateTime(request.reviewed_at) : dateTime(request.updated_at)}
                    </p>
                    {request.review_note && (
                      <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{request.review_note}</p>
                    )}
                  </div>
                )}

                {open && canReview && (
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <Button variant="ghost" disabled={busy}
                      onClick={() => { setNote(''); setConfirming({ request, decision: 'rejected' }) }}>
                      Decline
                    </Button>
                    <Button disabled={busy}
                      onClick={() => { setNote(''); setConfirming({ request, decision: 'approved' }) }}>
                      {busy
                        ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" />
                        : 'Approve and grant VIP'}
                    </Button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* Confirmation */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <button type="button" aria-label="Cancel" onClick={() => setConfirming(null)}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
          <div role="dialog" aria-modal="true" aria-labelledby="review-confirm-title"
            className="relative w-full max-w-sm rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 shadow-float">
            <span className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-full border',
              confirming.decision === 'approved'
                ? 'border-mint-deep bg-primary-soft text-primary'
                : 'border-border bg-muted text-muted-foreground')}>
              <Crown size={22} strokeWidth={1.9} />
            </span>

            <h2 id="review-confirm-title" className="text-lg font-bold tracking-tight text-foreground mb-2">
              {confirming.decision === 'approved' ? 'Approve and grant VIP?' : 'Decline this request?'}
            </h2>

            <div className="mb-3 rounded-xl border border-mint/70 dark:border-border bg-card px-3 py-2.5">
              <span className="block text-[13px] font-semibold text-foreground truncate">
                {confirming.request.business_name}
              </span>
              {confirming.request.customerEmail && (
                <span className="block text-[12px] text-muted-foreground truncate">
                  {confirming.request.customerEmail}
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {confirming.decision === 'approved'
                ? 'This customer will immediately receive Wholesale VIP pricing on every product that has a VIP price, and the Retail price everywhere else.'
                : 'The customer will be told the request was not approved. Their pricing does not change, and they may apply again.'}
            </p>

            <label htmlFor="review-note" className="mb-1.5 block text-[13px] font-semibold text-foreground">
              Note for the customer <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="review-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              className="focus-ring mb-5 w-full resize-none rounded-xl border border-mint-deep dark:border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45"
              placeholder={confirming.decision === 'approved' ? 'Welcome aboard.' : 'Why this was not approved.'}
            />

            <div className="flex gap-2.5">
              <Button variant="ghost" fullWidth onClick={() => setConfirming(null)}>Cancel</Button>
              <Button fullWidth onClick={() => void applyDecision(confirming.request, confirming.decision)}>
                {confirming.decision === 'approved' ? 'Approve' : 'Decline'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 flex max-w-[92vw] items-center gap-2 rounded-full border border-mint-deep bg-surface px-4 py-2.5 shadow-float">
          <Check size={15} className="shrink-0 text-primary" />
          <span className="truncate text-[13px] font-medium text-foreground">{toast}</span>
        </div>
      )}
    </>
  )
}
