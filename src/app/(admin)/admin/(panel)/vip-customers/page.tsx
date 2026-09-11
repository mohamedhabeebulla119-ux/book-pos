"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search, X, LoaderCircle, AlertCircle, Check, Lock, Crown, User,
  Mail, Phone, UsersRound, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { AdminPageHeading } from '@/components/admin/AdminPage'
import { useAdminAuth } from '@/context/AdminAuthContext'
import {
  listCustomers, setCustomerType, canManageVip, matchesCustomerQuery,
  vipStatus, CUSTOMER_TYPE_LABEL,
  type AdminCustomer, type VipStatus,
} from '@/lib/admin/customers'

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }
type Scope = 'all' | 'vip' | 'retail'

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: VipStatus }) {
  if (status === 'vip') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-deep bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary whitespace-nowrap">
        <Crown size={12} /> Wholesale VIP
      </span>
    )
  }
  if (status === 'vip_expired') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
        <Crown size={12} /> VIP expired
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
      <User size={12} /> Retail
    </span>
  )
}

export default function AdminVipCustomersPage() {
  const { role } = useAdminAuth()
  const canManage = canManageVip(role)

  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>('all')

  const [confirming, setConfirming] = useState<{ customer: AdminCustomer; grant: boolean } | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchAll = useCallback(() => listCustomers(), [])
  const applyData = useCallback((rows: AdminCustomer[]) => {
    setCustomers(rows)
    setLoad({ kind: 'ready' })
  }, [])
  const applyError = useCallback((err: unknown) => {
    setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Could not load customers.' })
  }, [])

  const refresh = useCallback(() => {
    fetchAll().then(applyData).catch(applyError)
  }, [fetchAll, applyData, applyError])

  // State is written only from the promise callbacks, never synchronously in
  // the effect body.
  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then((rows) => { if (!cancelled) applyData(rows) })
      .catch((err) => { if (!cancelled) applyError(err) })
    return () => { cancelled = true }
  }, [fetchAll, applyData, applyError])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(id)
  }, [toast])

  // Client-side filtering: the customer list is small enough that a server
  // round-trip per keystroke would be slower than filtering in place, so no
  // debounce or server-side search index is warranted.
  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const status = vipStatus(c)
      if (scope === 'vip' && status === 'retail') return false
      if (scope === 'retail' && status !== 'retail') return false
      return matchesCustomerQuery(c, query)
    })
  }, [customers, query, scope])

  // vip_approved_by is a profile id; resolve it to a name from the rows already
  // loaded rather than issuing another query.
  const nameById = useMemo(
    () => new Map(customers.map((c) => [c.id, c.full_name || c.email || 'an administrator'])),
    [customers],
  )

  const vipCount = customers.filter((c) => vipStatus(c) === 'vip').length

  async function applyChange(customer: AdminCustomer, grant: boolean) {
    setConfirming(null)
    setActionError(null)
    setPendingId(customer.id)
    const label = customer.full_name || customer.email || 'This customer'
    try {
      await setCustomerType(customer.id, grant ? 'wholesale_vip' : 'retail')
      // Re-read from the database rather than trusting local state, so the badge
      // reflects what was actually stored.
      const rows = await listCustomers()
      applyData(rows)
      setToast(grant
        ? `${label} now receives Wholesale VIP pricing.`
        : `${label} has returned to Retail pricing.`)
    } catch (err) {
      // Never claim success when the RPC refused.
      setActionError(err instanceof Error ? err.message : 'The database refused the change.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <AdminPageHeading
        title="VIP Customers"
        subtitle={
          load.kind === 'ready'
            ? `${customers.length} customer${customers.length === 1 ? '' : 's'} · ${vipCount} on Wholesale VIP pricing`
            : 'Grant and revoke Wholesale VIP status.'
        }
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-mint/70 dark:border-border bg-muted px-4 py-3">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Wholesale VIP customers see the Wholesale VIP price wherever one has been set, and fall
          back to the Retail price everywhere else. VIP is granted by hand — it is never earned
          automatically by order quantity, spend or purchase count.
        </p>
      </div>

      {!canManage && load.kind === 'ready' && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <Lock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[13px] leading-snug text-foreground">
            You can view customers but not change VIP status. The database refuses that for your role.
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
            placeholder="Search name, email or phone…" aria-label="Search customers"
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
          {([['all', 'All'], ['vip', 'VIP'], ['retail', 'Retail']] as const).map(([value, label]) => (
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
          <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" /> Loading customers…
        </div>
      )}

      {load.kind === 'error' && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/8 border border-red-500/20 text-red-500">
            <AlertCircle size={24} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">Could not load customers</h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">{load.message}</p>
          <Button onClick={() => { setLoad({ kind: 'loading' }); refresh() }}>Try again</Button>
        </div>
      )}

      {load.kind === 'ready' && filtered.length === 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-14 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-well-strong border border-mint-deep text-primary">
            <UsersRound size={24} strokeWidth={1.8} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">
            {customers.length === 0 ? 'No customers yet' : 'No customers match'}
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {customers.length === 0
              ? 'Customer accounts appear here once people sign up in the store.'
              : 'Try a different search term or change the filter.'}
          </p>
        </div>
      )}

      {load.kind === 'ready' && filtered.length > 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mint/70 dark:border-border bg-muted/60">
                  <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Customer</th>
                  <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">Contact</th>
                  <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">Status</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const status = vipStatus(c)
                  const isVip = c.customer_type === 'wholesale_vip'
                  const approvedOn = formatDate(c.vip_approved_at)
                  const busy = pendingId === c.id
                  return (
                    <tr key={c.id} className="border-b border-mint/50 dark:border-border/70 last:border-0 hover:bg-primary-soft/40 transition-colors">
                      <td className="px-4 py-3 min-w-[200px]">
                        <span className="block font-semibold text-foreground leading-tight">
                          {c.full_name || <span className="text-muted-foreground font-normal">No name</span>}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {CUSTOMER_TYPE_LABEL[isVip ? 'wholesale_vip' : 'retail']}
                          {approvedOn && isVip && <> · since {approvedOn}</>}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-[190px]">
                        {c.email && (
                          <span className="flex items-center gap-1.5 text-[13px] text-foreground">
                            <Mail size={12} className="shrink-0 text-muted-foreground" />
                            <span className="truncate">{c.email}</span>
                          </span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground mt-0.5">
                            <Phone size={12} className="shrink-0" /> {c.phone}
                          </span>
                        )}
                        {!c.email && !c.phone && <span className="text-[12px] text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={status} />
                        {isVip && c.vip_approved_by && (
                          <span className="mt-1 block text-[10.5px] text-muted-foreground">
                            by {nameById.get(c.vip_approved_by) ?? 'an administrator'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant={isVip ? 'ghost' : 'secondary'}
                          disabled={!canManage || busy}
                          onClick={() => setConfirming({ customer: c, grant: !isVip })}
                        >
                          {busy
                            ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" />
                            : isVip ? 'Remove VIP' : 'Make VIP'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <button type="button" aria-label="Cancel" onClick={() => setConfirming(null)}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
          <div role="dialog" aria-modal="true" aria-labelledby="vip-confirm-title"
            className="relative w-full max-w-sm rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 shadow-float">
            <span className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-full border',
              confirming.grant
                ? 'border-mint-deep bg-primary-soft text-primary'
                : 'border-border bg-muted text-muted-foreground')}>
              <Crown size={22} strokeWidth={1.9} />
            </span>

            <h2 id="vip-confirm-title" className="text-lg font-bold tracking-tight text-foreground mb-2">
              {confirming.grant ? 'Grant Wholesale VIP?' : 'Remove Wholesale VIP?'}
            </h2>

            <div className="mb-3 rounded-xl border border-mint/70 dark:border-border bg-card px-3 py-2.5">
              <span className="block text-[13px] font-semibold text-foreground truncate">
                {confirming.customer.full_name || 'No name'}
              </span>
              {confirming.customer.email && (
                <span className="block text-[12px] text-muted-foreground truncate">{confirming.customer.email}</span>
              )}
              {confirming.customer.phone && (
                <span className="block text-[12px] text-muted-foreground truncate">{confirming.customer.phone}</span>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {confirming.grant
                ? 'This customer will immediately receive Wholesale VIP pricing on every product that has a VIP price, and the Retail price everywhere else.'
                : 'This customer will return to Retail pricing immediately and lose access to Wholesale VIP prices.'}
            </p>

            <div className="flex gap-2.5">
              <Button variant="ghost" fullWidth onClick={() => setConfirming(null)}>Cancel</Button>
              <Button fullWidth onClick={() => void applyChange(confirming.customer, confirming.grant)}>
                {confirming.grant ? 'Make VIP' : 'Remove VIP'}
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

      {load.kind === 'ready' && (
        <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Crown size={13} className="shrink-0" />
          VIP status is changed only through the audited database function — never written directly.
        </p>
      )}
    </>
  )
}
