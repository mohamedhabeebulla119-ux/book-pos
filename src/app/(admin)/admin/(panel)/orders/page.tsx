"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, X, LoaderCircle, AlertCircle, ShoppingCart, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/utils/formatPrice'
import { centsToRupees } from '@/lib/admin/pricing'
import { AdminPageHeading } from '@/components/admin/AdminPage'
import { OrderDetail, OrderStatusBadge, TierBadge } from '@/components/admin/orders/OrderDetail'
import { useAdminAuth } from '@/context/AdminAuthContext'
import {
  listOrders, matchesOrderQuery, ORDER_STATUSES, ORDER_STATUS_LABEL, ORDER_FETCH_LIMIT,
  type AdminOrderListItem,
} from '@/lib/admin/orders'

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }
type DateWindow = 'all' | 'today' | '7d' | '30d'

const DATE_WINDOWS: readonly [DateWindow, string][] = [
  ['all', 'Any date'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'],
]

function withinWindow(iso: string, window: DateWindow): boolean {
  if (window === 'all') return true
  const placed = new Date(iso).getTime()
  const now = Date.now()
  if (window === 'today') {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    return placed >= start.getTime()
  }
  const days = window === '7d' ? 7 : 30
  return placed >= now - days * 24 * 60 * 60 * 1000
}

export default function AdminOrdersPage() {
  const { role } = useAdminAuth()

  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [orders, setOrders] = useState<AdminOrderListItem[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [tier, setTier] = useState<string>('all')
  const [dateWindow, setDateWindow] = useState<DateWindow>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const fetchAll = useCallback(() => listOrders(), [])
  const applyData = useCallback((rows: AdminOrderListItem[]) => {
    setOrders(rows)
    setLoad({ kind: 'ready' })
  }, [])
  const applyError = useCallback((err: unknown) => {
    setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Could not load orders.' })
  }, [])

  const refresh = useCallback(() => {
    fetchAll().then(applyData).catch(applyError)
  }, [fetchAll, applyData, applyError])

  // State is written only from the promise callbacks, never synchronously here.
  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then((rows) => { if (!cancelled) applyData(rows) })
      .catch((err) => { if (!cancelled) applyError(err) })
    return () => { cancelled = true }
  }, [fetchAll, applyData, applyError])

  // Filtering happens over the bounded fetch above: with no checkout live yet
  // the list is small, and this avoids a round trip per keystroke.
  const filtered = useMemo(() => orders.filter((o) => {
    if (status !== 'all' && o.status !== status) return false
    if (tier !== 'all' && o.customer_type_at_purchase !== tier) return false
    if (!withinWindow(o.placed_at, dateWindow)) return false
    return matchesOrderQuery(o, query)
  }), [orders, query, status, tier, dateWindow])

  const revenueCents = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
    .reduce((sum, o) => sum + o.total_cents, 0)

  const selectClass =
    'focus-ring h-11 rounded-xl border border-mint-deep dark:border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:border-primary/45'

  return (
    <>
      <AdminPageHeading
        title="Orders"
        subtitle={
          load.kind === 'ready'
            ? `${orders.length} order${orders.length === 1 ? '' : 's'}${orders.length ? ` · ${formatPrice(centsToRupees(revenueCents))} excluding cancelled and refunded` : ''}`
            : 'Order history, status and fulfilment.'
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col lg:flex-row gap-2.5">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted-foreground">
            <Search size={16} />
          </span>
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order number, name, email or phone…" aria-label="Search orders"
            className="focus-ring h-11 w-full rounded-xl border border-mint-deep dark:border-border bg-card pl-11 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45 transition-colors"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
              className="focus-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          )}
        </div>

        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
        </select>

        <select aria-label="Filter by customer type" value={tier} onChange={(e) => setTier(e.target.value)} className={selectClass}>
          <option value="all">All customers</option>
          <option value="retail">Retail</option>
          <option value="wholesale_vip">Wholesale VIP</option>
        </select>

        <select aria-label="Filter by date" value={dateWindow}
          onChange={(e) => setDateWindow(e.target.value as DateWindow)} className={selectClass}>
          {DATE_WINDOWS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {load.kind === 'loading' && (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted-foreground">
          <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" /> Loading orders…
        </div>
      )}

      {load.kind === 'error' && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/8 border border-red-500/20 text-red-500">
            <AlertCircle size={24} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">Could not load orders</h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">{load.message}</p>
          <Button onClick={() => { setLoad({ kind: 'loading' }); refresh() }}>Try again</Button>
        </div>
      )}

      {load.kind === 'ready' && filtered.length === 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-14 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-well-strong border border-mint-deep text-primary">
            <ShoppingCart size={24} strokeWidth={1.8} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">
            {orders.length === 0 ? 'No orders yet' : 'No orders match'}
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {orders.length === 0
              ? 'Orders will appear here once customers start checking out.'
              : 'Try a different search term or clear the filters.'}
          </p>
        </div>
      )}

      {load.kind === 'ready' && filtered.length > 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mint/70 dark:border-border bg-muted/60">
                  <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Order</th>
                  <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Customer</th>
                  <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">Status</th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">Items</th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">Total</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-mint/50 dark:border-border/70 last:border-0 hover:bg-primary-soft/40 transition-colors">
                    <td className="px-4 py-3 min-w-[170px]">
                      <button type="button" onClick={() => setOpenId(o.id)} className="focus-ring rounded-lg text-left">
                        <span className="block font-semibold text-foreground leading-tight">{o.order_number}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {new Date(o.placed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 min-w-[190px]">
                      <span className="block text-foreground leading-tight truncate">
                        {o.customerName || <span className="text-muted-foreground">No name</span>}
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate">{o.customerEmail ?? o.customerPhone ?? '—'}</span>
                      <span className="mt-1 inline-block"><TierBadge tier={o.customer_type_at_purchase} /></span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><OrderStatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-foreground">{o.itemCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold text-foreground">
                      {formatPrice(centsToRupees(o.total_cents))}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="secondary" onClick={() => setOpenId(o.id)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openId && (
        <OrderDetail
          key={openId}
          orderId={openId}
          role={role}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
        />
      )}

      {load.kind === 'ready' && (
        <p className={cn('mt-4 flex items-center gap-2 text-[12px] text-muted-foreground')}>
          <ReceiptText size={13} className="shrink-0" />
          Line prices are the snapshots taken at purchase — changing a product&apos;s price never alters a past order.
          {orders.length >= ORDER_FETCH_LIMIT && <> Showing the {ORDER_FETCH_LIMIT} most recent orders.</>}
        </p>
      )}
    </>
  )
}
