"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, X, LoaderCircle, AlertCircle, Check, Lock, Tags, PackageSearch, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/utils/formatPrice'
import { AdminPageHeading } from '@/components/admin/AdminPage'
import { PriceEditor } from '@/components/admin/pricing/PriceEditor'
import { useAdminAuth } from '@/context/AdminAuthContext'
import {
  loadPricing, canEditPrices, centsToRupees,
  type PricingTarget,
} from '@/lib/admin/pricing'

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }
type Scope = 'published' | 'unpriced' | 'all'

export default function AdminPricingPage() {
  const { role } = useAdminAuth()
  const canEdit = canEditPrices(role)

  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [targets, setTargets] = useState<PricingTarget[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [scope, setScope] = useState<Scope>('published')
  // The open editor is identified by KEY, never held as a snapshot of the row.
  // `editing` is re-derived from `targets` on every render, so the refresh that
  // follows a save flows straight into the open drawer.
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const fetchAll = useCallback(() => loadPricing(), [])

  const applyData = useCallback((data: { targets: PricingTarget[]; categories: { id: string; name: string }[] }) => {
    setTargets(data.targets)
    setCategories(data.categories)
    setLoad({ kind: 'ready' })
  }, [])

  const applyError = useCallback((err: unknown) => {
    setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Could not load prices.' })
  }, [])

  const refresh = useCallback(() => {
    fetchAll().then(applyData).catch(applyError)
  }, [fetchAll, applyData, applyError])

  // State is written only from promise callbacks, never synchronously here.
  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then((data) => { if (!cancelled) applyData(data) })
      .catch((err) => { if (!cancelled) applyError(err) })
    return () => { cancelled = true }
  }, [fetchAll, applyData, applyError])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(id)
  }, [toast])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return targets.filter((t) => {
      if (categoryId !== 'all' && t.categoryId !== categoryId) return false
      if (scope === 'published' && !t.isActive) return false
      if (scope === 'unpriced' && t.retailCents !== null) return false
      if (!q) return true
      return (
        t.productName.toLowerCase().includes(q) ||
        t.productId.toLowerCase().includes(q) ||
        (t.variantLabel?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [targets, query, categoryId, scope])

  // Always the CURRENT row for that key, so a saved price reaches the drawer
  // without closing it and without reloading the page.
  const editing = useMemo(
    () => (editingKey === null ? null : (targets.find((t) => t.key === editingKey) ?? null)),
    [targets, editingKey],
  )

  const vipCount = targets.filter((t) => t.vipCents !== null).length
  const pricedCount = targets.filter((t) => t.retailCents !== null).length

  return (
    <>
      <AdminPageHeading
        title="Pricing"
        subtitle={
          load.kind === 'ready'
            ? `${pricedCount} priced · ${vipCount} with a Wholesale VIP price · all changes are audited`
            : 'Retail and Wholesale VIP prices, per product and per variant.'
        }
      />

      {!canEdit && load.kind === 'ready' && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <Lock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[13px] leading-snug text-foreground">
            You have read-only access. The database refuses price changes for your role.
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted-foreground">
            <Search size={16} />
          </span>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product, id or variant…" aria-label="Search prices"
            className="focus-ring h-11 w-full rounded-xl border border-mint-deep dark:border-border bg-card pl-11 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45 transition-colors" />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
              className="focus-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          )}
        </div>

        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter by category"
          className="focus-ring h-11 rounded-xl border border-mint-deep dark:border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:border-primary/45">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="flex rounded-xl border border-mint-deep dark:border-border bg-card p-1">
          {([['published', 'Published'], ['unpriced', 'No price'], ['all', 'All']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setScope(value)} aria-pressed={scope === value}
              className={cn('focus-ring rounded-lg px-3 h-9 text-[13px] font-semibold whitespace-nowrap transition-colors',
                scope === value ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {scope === 'unpriced' && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[13px] leading-snug text-foreground">
            These have no confirmed business price and stay hidden from customers. Enter a real rupee
            amount only — never an estimate or a converted figure.
          </p>
        </div>
      )}

      {load.kind === 'loading' && (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted-foreground">
          <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" /> Loading prices…
        </div>
      )}

      {load.kind === 'error' && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/8 border border-red-500/20 text-red-500">
            <AlertCircle size={24} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">Could not load prices</h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">{load.message}</p>
          <Button onClick={() => { setLoad({ kind: 'loading' }); refresh() }}>Try again</Button>
        </div>
      )}

      {load.kind === 'ready' && filtered.length === 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-14 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-well-strong border border-mint-deep text-primary">
            <PackageSearch size={24} strokeWidth={1.8} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">Nothing matches</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">Try a different search term or change the filters.</p>
        </div>
      )}

      {load.kind === 'ready' && filtered.length > 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mint/70 dark:border-border bg-muted/60">
                  <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Item</th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">Retail</th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">Wholesale VIP</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.key} className="border-b border-mint/50 dark:border-border/70 last:border-0 hover:bg-primary-soft/40 transition-colors">
                    <td className={cn('px-4 py-3 min-w-[240px]', t.variantId && 'pl-8')}>
                      <span className="flex items-center gap-2">
                        {t.variantId && <span className="rounded-full border border-mint-deep bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">{t.variantLegacyKey}</span>}
                        <span className="font-semibold text-foreground leading-tight">
                          {t.variantId ? t.variantLabel : t.productName}
                        </span>
                        {!t.isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            <EyeOff size={10} /> Hidden
                          </span>
                        )}
                      </span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {t.variantId ? t.productId : `${t.productId} · ${t.categoryName}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {t.retailCents === null
                        ? <span className="text-[12px] text-muted-foreground">—</span>
                        : <span className="font-semibold text-foreground">{formatPrice(centsToRupees(t.retailCents))}</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {t.vipCents === null
                        ? <span className="text-[12px] text-muted-foreground">not set</span>
                        : <span className="font-semibold text-primary">{formatPrice(centsToRupees(t.vipCents))}</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="secondary" onClick={() => setEditingKey(t.key)}>
                        {canEdit ? 'Edit' : 'View'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {editing && (
        <PriceEditor
          key={editing.key}
          target={editing}
          canEdit={canEdit}
          onClose={() => setEditingKey(null)}
          onSaved={() => { setToast('Price saved. Previous price kept in history.'); refresh() }}
        />
      )}

      {load.kind === 'ready' && (
        <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Tags size={13} className="shrink-0" />
          Every change goes through the audited database function. Old prices are retired, never deleted.
        </p>
      )}
    </>
  )
}
