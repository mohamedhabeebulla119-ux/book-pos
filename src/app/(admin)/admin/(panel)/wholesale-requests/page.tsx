"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search, X, LoaderCircle, AlertCircle, Check, Lock, Inbox, Crown,
  Mail, Phone, Building2, ShieldCheck, Clock, LifeBuoy, FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { AdminPageHeading, StatCard } from '@/components/admin/AdminPage'
import { useAdminAuth } from '@/context/AdminAuthContext'
import { describeAdminError, logAdminError } from '@/lib/admin/errors'
import { WholesaleApplicationEditor } from '@/components/admin/wholesale/WholesaleApplicationEditor'
import {
  listWholesaleRequests, canReviewRequests, matchesRequestQuery, isDecidable, missingFields,
  REQUEST_STATUS_LABEL,
  type AdminWholesaleRequest,
} from '@/lib/admin/wholesaleRequests'

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }
type Scope = 'all' | 'pending' | 'assistance_requested' | 'under_review' | 'approved' | 'rejected'

/** "Pending" = submitted and awaiting a decision (submitted, assistance requested or under review). */
const SCOPES: readonly [Scope, string][] = [
  ['all', 'All'], ['pending', 'Pending'], ['assistance_requested', 'Assistance Requested'],
  ['under_review', 'Under Review'], ['approved', 'Approved'], ['rejected', 'Rejected'],
]

function inScope(status: string, scope: Scope): boolean {
  if (scope === 'all') return true
  if (scope === 'pending') return isDecidable(status)
  return status === scope
}

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'approved' ? 'border-mint-deep bg-primary-soft text-primary'
    : status === 'rejected' ? 'border-red-500/25 bg-red-500/8 text-red-500'
    : status === 'draft' ? 'border-border bg-muted text-muted-foreground'
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

  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

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
    if (!inScope(request.status, scope)) return false
    return matchesRequestQuery(request, query)
  }), [requests, scope, query])

  const counts = useMemo(() => ({
    pending: requests.filter((r) => isDecidable(r.status)).length,
    assistance: requests.filter((r) => r.status === 'assistance_requested').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  }), [requests])

  // Looked up by id so the editor always shows the freshly re-read row.
  const opened = openId ? requests.find((r) => r.id === openId) ?? null : null

  /** After any write: re-read rather than trusting local state — on approval the
   *  database also changed the customer's tier, and the queue shows it. */
  async function handleChanged(message: string) {
    try {
      applyData(await listWholesaleRequests())
      setOpenId(null)
      setToast(message)
    } catch (err) {
      applyError(err)
    }
  }

  return (
    <>
      <AdminPageHeading
        title="Wholesale Requests"
        subtitle={
          load.kind === 'ready'
            ? `${counts.pending} awaiting a decision · ${counts.assistance} need assistance · ${requests.length} in total.`
            : 'Business applications for Wholesale VIP pricing.'
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
        <StatCard label="Pending" icon={Clock}
          value={load.kind === 'ready' ? String(counts.pending) : '—'} note="Awaiting a decision" />
        <StatCard label="Assistance" icon={LifeBuoy}
          value={load.kind === 'ready' ? String(counts.assistance) : '—'} note="Customer asked for help" />
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

        <div className="flex overflow-x-auto rounded-xl border border-mint-deep dark:border-border bg-card p-1">
          {SCOPES.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setScope(value)} aria-pressed={scope === value}
              className={cn('focus-ring rounded-lg px-3 h-9 text-[13px] font-semibold whitespace-nowrap transition-colors',
                scope === value ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>
      </div>

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
            const decidable = isDecidable(request.status)
            const assistance = request.status === 'assistance_requested'
            const missing = missingFields(request)
            return (
              <article key={request.id}
                className={cn('bg-surface border rounded-[26px] shadow-card p-5',
                  assistance ? 'border-amber-500/45 ring-1 ring-amber-500/25' : 'border-mint/80 dark:border-border')}>
                {assistance && (
                  <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[12.5px] font-medium leading-snug text-foreground">
                    <LifeBuoy size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    Customer requested assistance with wholesale application
                    {request.assistance_requested_at ? ` · ${dateTime(request.assistance_requested_at)}` : ''}
                  </p>
                )}
                <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-[16px] font-bold tracking-tight text-foreground">
                      <Building2 size={16} className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{request.business_name.trim() || 'Business name not provided'}</span>
                    </h2>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {request.status === 'draft' ? 'Draft started' : 'Applied'} {dateTime(request.submitted_at ?? request.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={request.status} />
                    {decidable && missing.length > 0 && (
                      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        {missing.length} missing
                      </span>
                    )}
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

                {(request.status === 'approved' || request.status === 'rejected') && (
                  <div className="mb-4 rounded-xl border border-mint/70 dark:border-border bg-card px-3.5 py-3">
                    <p className="text-[12px] text-muted-foreground">
                      Reviewed {request.reviewed_at ? dateTime(request.reviewed_at) : dateTime(request.updated_at)}
                    </p>
                    {request.review_note && (
                      <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{request.review_note}</p>
                    )}
                  </div>
                )}

                <Button variant={decidable && canReview ? 'primary' : 'secondary'} size="sm"
                  onClick={() => setOpenId(request.id)}>
                  <FolderOpen size={14} className="mr-1.5" /> Open Application
                </Button>
              </article>
            )
          })}
        </div>
      )}

      {opened && (
        <WholesaleApplicationEditor
          key={`${opened.id}:${opened.updated_at}:${opened.adminNotesUpdatedAt ?? ''}`}
          request={opened} canReview={canReview}
          onClose={() => setOpenId(null)} onChanged={handleChanged}
        />
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
