"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Package, Search, X, LoaderCircle, AlertCircle, Check,
  Eye, EyeOff, Lock, PackageSearch, Plus, Tags, FolderTree,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { AdminPageHeading } from '@/components/admin/AdminPage'
import { ProductEditor } from '@/components/admin/products/ProductEditor'
import { ProductCreator } from '@/components/admin/products/ProductCreator'
import { useAdminAuth } from '@/context/AdminAuthContext'
import {
  listCategories, listProducts, setProductActive, canEditCatalog,
  listRetailPricedProductIds,
  type AdminProductListItem, type CategoryRow,
} from '@/lib/admin/products'

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }
type ActiveFilter = 'all' | 'active' | 'inactive'

export default function AdminProductsPage() {
  const { role } = useAdminAuth()
  const canEdit = canEditCatalog(role)

  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [rows, setRows] = useState<AdminProductListItem[]>([])
  /** Products with a live retail price. Anything else cannot reach a customer. */
  const [priced, setPriced] = useState<Set<string>>(new Set())

  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<AdminProductListItem | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [toastWarning, setToastWarning] = useState(false)
  const showToast = (message: string, warning = false) => { setToast(message); setToastWarning(warning) }

  /** Reads categories then products. Pure fetch — sets no state itself. */
  const fetchAll = useCallback(async () => {
    const cats = await listCategories()
    const products = await listProducts(cats)
    const pricedIds = await listRetailPricedProductIds()
    return { cats, products, pricedIds }
  }, [])

  const applyData = useCallback(
    (cats: CategoryRow[], products: AdminProductListItem[], pricedIds: Set<string>) => {
      setCategories(cats)
      setRows(products)
      setPriced(pricedIds)
      setLoad({ kind: 'ready' })
    },
    [],
  )

  const applyError = useCallback((err: unknown) => {
    setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Could not load products.' })
  }, [])

  /** Used by the retry button and after a save — both event-driven, not effects. */
  const refresh = useCallback(() => {
    fetchAll()
      .then(({ cats, products, pricedIds }) => applyData(cats, products, pricedIds))
      .catch(applyError)
  }, [fetchAll, applyData, applyError])

  // State is written only from the promise callbacks, never synchronously in
  // the effect body — a synchronous throw from getSupabaseClient() would
  // otherwise set state during render.
  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then(({ cats, products, pricedIds }) => { if (!cancelled) applyData(cats, products, pricedIds) })
      .catch((err) => { if (!cancelled) applyError(err) })
    return () => { cancelled = true }
  }, [fetchAll, applyData, applyError])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (categoryId !== 'all' && row.category_id !== categoryId) return false
      if (activeFilter === 'active' && !row.is_active) return false
      if (activeFilter === 'inactive' && row.is_active) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        (row.model?.toLowerCase().includes(q) ?? false) ||
        (row.conditionSummary?.toLowerCase().includes(q) ?? false) ||
        row.subcategory.toLowerCase().includes(q)
      )
    })
  }, [rows, query, categoryId, activeFilter])

  async function applyActive(row: AdminProductListItem, next: boolean) {
    setConfirming(null)
    setPendingId(row.id)
    try {
      await setProductActive(row.id, next)
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)))
      showToast(`${row.name} is now ${next ? 'published' : 'unpublished'}.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not change publication state.')
    } finally {
      setPendingId(null)
    }
  }

  useEffect(() => {
    if (!toast) return
    // A warning (a kept draft, unrecorded opening stock) stays long enough to read.
    const id = window.setTimeout(() => { setToast(null); setToastWarning(false) }, toastWarning ? 15000 : 4000)
    return () => window.clearTimeout(id)
  }, [toast, toastWarning])

  const activeCount = rows.filter((r) => r.is_active).length

  return (
    <>
      <AdminPageHeading
        title="Products"
        subtitle={
          load.kind === 'ready'
            ? `${rows.length} products · ${activeCount} published · ${rows.length - activeCount} unpublished`
            : 'Catalog, variants, images and specifications.'
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Button onClick={() => setCreating(true)} disabled={!canEdit || load.kind !== 'ready'}>
          <Plus size={16} className="mr-1.5" />
          Add product
        </Button>
        <Link href="/admin/categories">
          <Button variant="secondary">
            <FolderTree size={15} className="mr-1.5" />
            Categories
          </Button>
        </Link>
      </div>

      {!canEdit && load.kind === 'ready' && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <Lock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[13px] leading-snug text-foreground">
            You have read-only access. The database refuses catalog writes for your role.
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
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, id, model or subcategory…"
            aria-label="Search products"
            className="focus-ring h-11 w-full rounded-xl border border-mint-deep dark:border-border bg-card pl-11 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45 transition-colors"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
              className="focus-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          )}
        </div>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter by category"
          className="focus-ring h-11 rounded-xl border border-mint-deep dark:border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:border-primary/45"
        >
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="flex rounded-xl border border-mint-deep dark:border-border bg-card p-1">
          {(['all', 'active', 'inactive'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveFilter(value)}
              aria-pressed={activeFilter === value}
              className={cn(
                'focus-ring rounded-lg px-3 h-9 text-[13px] font-semibold capitalize transition-colors',
                activeFilter === value ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'active' ? 'Published' : value === 'inactive' ? 'Hidden' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {load.kind === 'loading' && (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted-foreground">
          <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" /> Loading products…
        </div>
      )}

      {load.kind === 'error' && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/8 border border-red-500/20 text-red-500">
            <AlertCircle size={24} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">Could not load products</h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">{load.message}</p>
          <Button onClick={() => { setLoad({ kind: 'loading' }); refresh() }}>Try again</Button>
        </div>
      )}

      {load.kind === 'ready' && filtered.length === 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-14 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-well-strong border border-mint-deep text-primary">
            <PackageSearch size={24} strokeWidth={1.8} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">No products match</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">Try a different search term or clear the filters.</p>
        </div>
      )}

      {load.kind === 'ready' && filtered.length > 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mint/70 dark:border-border bg-muted/60">
                  {['Product', 'Category', 'Stock', 'State', ''].map((h, i) => (
                    <th key={h || i} scope="col"
                      className={cn('px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap',
                        h === 'Stock' && 'text-right')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-mint/50 dark:border-border/70 last:border-0 hover:bg-primary-soft/40 transition-colors">
                    <td className="px-4 py-3 min-w-[220px]">
                      <button type="button" onClick={() => setEditingId(row.id)}
                        className="focus-ring rounded-lg text-left">
                        <span className="block font-semibold text-foreground leading-tight">{row.name}</span>
                        <AdminConditionChip row={row} />
                        <span className="block font-mono text-[11px] text-muted-foreground">{row.id}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-foreground">{row.categoryName}</span>
                      <span className="block text-[11px] text-muted-foreground">{row.subcategory}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      <span className={cn(row.stock <= 0 ? 'text-red-500 font-semibold' : row.stock <= 5 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-foreground')}>
                        {row.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                        row.is_active
                          ? 'border-mint-deep bg-primary-soft text-primary'
                          : 'border-border bg-muted text-muted-foreground')}>
                        {row.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                        {row.is_active ? 'Published' : 'Hidden'}
                      </span>
                      {/* Published is not the same as visible: the storefront
                          will not list a product it cannot price. */}
                      {row.is_active && !priced.has(row.id) && (
                        <span className="mt-1 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          <Tags size={11} /> No price — not shown
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setEditingId(row.id)}>
                          {canEdit ? 'Edit' : 'View'}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={!canEdit || pendingId === row.id}
                          onClick={() => setConfirming(row)}>
                          {pendingId === row.id
                            ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" />
                            : row.is_active ? 'Unpublish' : 'Publish'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activation confirmation */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <button type="button" aria-label="Cancel" onClick={() => setConfirming(null)}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
          <div role="dialog" aria-modal="true"
            className="relative w-full max-w-sm rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 shadow-float">
            <h2 className="text-lg font-bold tracking-tight text-foreground mb-2">
              {confirming.is_active ? 'Unpublish this product?' : 'Publish this product?'}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {confirming.is_active
                ? `“${confirming.name}” will stop appearing in the customer catalog. Nothing is deleted, and existing orders are unaffected.`
                : `“${confirming.name}” will appear in the customer catalog again.`}
            </p>
            <div className="flex gap-2.5">
              <Button variant="ghost" fullWidth onClick={() => setConfirming(null)}>Cancel</Button>
              <Button fullWidth onClick={() => void applyActive(confirming, !confirming.is_active)}>
                {confirming.is_active ? 'Unpublish' : 'Publish'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite"
          className={cn('fixed bottom-5 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 border bg-surface px-4 py-2.5 shadow-float',
            toastWarning ? 'w-[min(92vw,34rem)] items-start rounded-2xl border-amber-500/40' : 'rounded-full border-mint-deep')}>
          {toastWarning
            ? <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            : <Check size={15} className="shrink-0 text-primary" />}
          <span className="text-[13px] font-medium text-foreground">{toast}</span>
          {toastWarning && (
            <button type="button" aria-label="Dismiss" onClick={() => { setToast(null); setToastWarning(false) }}
              className="focus-ring ml-auto shrink-0 rounded-full text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {creating && (
        <ProductCreator
          categories={categories}
          onClose={() => setCreating(false)}
          onCreated={(message, warning) => { setCreating(false); showToast(message, Boolean(warning)); refresh() }}
        />
      )}

      {editingId && (
        <ProductEditor
          key={editingId}
          productId={editingId}
          categories={categories}
          canEdit={canEdit}
          onClose={() => setEditingId(null)}
          onSaved={refresh}
          onDeleted={(name) => { setEditingId(null); showToast(`${name} was deleted.`); refresh() }}
        />
      )}

      {load.kind === 'ready' && (
        <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Package size={13} className="shrink-0" />
          Product IDs and variant keys are fixed once created — they anchor links and saved carts.
          New products reach customers straight from the database, with no app update.
        </p>
      )}
    </>
  )
}

/**
 * The product's condition in the list — the same summary customers see on the
 * card ("Brand New", "Pre-Owned · Grade A", "New & Pre-Owned"), plus a flag
 * when older product-level condition data is still waiting to be assigned to
 * the right variant.
 */
function AdminConditionChip({ row }: { row: AdminProductListItem }) {
  return (
    <span className="my-1 flex flex-wrap gap-1">
      {row.conditionSummary && (
        <span className={cn(
          'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap',
          row.hasPreOwned ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'border-border bg-muted text-muted-foreground',
        )}>
          {row.conditionSummary}
        </span>
      )}
      {row.legacyCondition && (
        <span className="inline-flex w-fit items-center rounded-full border border-amber-500/40 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
          Condition needs review
        </span>
      )}
    </span>
  )
}
