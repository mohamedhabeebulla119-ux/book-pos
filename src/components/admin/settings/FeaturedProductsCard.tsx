"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ExternalLink, LoaderCircle, Plus, Search, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { listCategories, listProducts, type AdminProductListItem } from '@/lib/admin/products'
import {
  addFeatured, listFeatured, removeFeatured, reorderFeatured, setFeaturedActive, type FeaturedRow,
} from '@/lib/admin/storefront'
import { describeAdminError, logAdminError } from '@/lib/admin/errors'
import { productHref } from '@/lib/catalog'
import { AdminDrawer, SaveFeedback, SettingsCard, type SaveState } from './AdminDrawer'

/**
 * Featured products — the homepage carousel, read by the storefront from
 * featured_products (slot 'home', active rows, by position). Nothing is
 * duplicated: rows reference products by their canonical id, and the unique
 * (slot, product_id) key refuses the same product twice.
 */
export function FeaturedProductsCard({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<FeaturedRow[] | null>(null)
  const [products, setProducts] = useState<AdminProductListItem[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  const [picking, setPicking] = useState(false)
  const busy = state.kind === 'saving'

  const load = useCallback(async () => {
    try {
      const [featured, categories] = await Promise.all([listFeatured(), listCategories()])
      setProducts(await listProducts(categories))
      setRows(featured)
      setLoadError(null)
    } catch (err) {
      logAdminError('settings.featured.load', err)
      setLoadError(describeAdminError(err, 'Could not load featured products.'))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([listFeatured(), listCategories()])
      .then(async ([featured, categories]) => {
        const all = await listProducts(categories)
        if (!cancelled) { setProducts(all); setRows(featured) }
      })
      .catch((err) => {
        logAdminError('settings.featured.load', err)
        if (!cancelled) setLoadError(describeAdminError(err, 'Could not load featured products.'))
      })
    return () => { cancelled = true }
  }, [])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  async function run(action: () => Promise<void>, success: string, failure: string) {
    setState({ kind: 'saving' })
    try {
      await action()
      await load()
      setState({ kind: 'saved', message: success })
    } catch (err) {
      logAdminError('settings.featured', err)
      setState({ kind: 'error', message: describeAdminError(err, failure) })
      await load()
    }
  }

  function move(index: number, delta: -1 | 1) {
    if (!rows) return
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(index + delta, 0, row)
    setRows(next)
    void run(() => reorderFeatured(next.map((r) => r.id)), 'Order saved.', 'Could not save the new order.')
  }

  return (
    <SettingsCard
      title="Featured Products"
      description="The “Featured Products” carousel on the Retail home, in this order."
      action={canEdit && (
        <Button size="sm" onClick={() => setPicking(true)} disabled={busy || rows === null}>
          <Plus size={15} className="mr-1" /> Add product
        </Button>
      )}
    >
      <div className="mb-3"><SaveFeedback state={state} /></div>

      {loadError && <p role="alert" className="text-[13px] text-red-500 break-words">{loadError}</p>}
      {!loadError && rows === null && (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" /> Loading…
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-mint-deep dark:border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
          No featured products. The Featured section is hidden on the storefront until one is added.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ol className="divide-y divide-mint/70 dark:divide-border rounded-2xl border border-mint/70 dark:border-border bg-card">
          {rows.map((row, index) => {
            const product = byId.get(row.product_id)
            const unpublished = product && !product.is_active
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                <span className="w-6 shrink-0 text-center text-[12px] font-bold tabular-nums text-muted-foreground">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13.5px] font-semibold ${row.is_active ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                    {product?.name ?? row.product_id}
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{row.product_id}</p>
                  {unpublished && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={11} /> Product is unpublished — it will not show until published.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton label="Move up" disabled={!canEdit || busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></IconButton>
                  <IconButton label="Move down" disabled={!canEdit || busy || index === rows.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></IconButton>
                  <a href={productHref(row.product_id)} target="_blank" rel="noopener noreferrer" aria-label="Preview product"
                    className="focus-ring flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary-soft hover:text-primary">
                    <ExternalLink size={15} />
                  </a>
                  <button
                    type="button" role="switch" aria-checked={row.is_active} aria-label={row.is_active ? 'Disable' : 'Enable'}
                    disabled={!canEdit || busy}
                    onClick={() => void run(() => setFeaturedActive(row.id, !row.is_active), row.is_active ? 'Disabled.' : 'Enabled.', 'Could not change it.')}
                    className={`focus-ring relative ml-1 flex h-6 w-10 items-center rounded-full px-0.5 transition-colors disabled:opacity-60 ${row.is_active ? 'bg-gradient-cta' : 'bg-mint-deep dark:bg-border'}`}
                  >
                    <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${row.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <IconButton label="Remove" tone="danger" disabled={!canEdit || busy}
                    onClick={() => { if (window.confirm(`Remove ${product?.name ?? row.product_id} from Featured?`)) void run(() => removeFeatured(row.id), 'Removed.', 'Could not remove it.') }}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {picking && rows && (
        <ProductPicker
          products={products}
          featuredIds={new Set(rows.map((r) => r.product_id))}
          onClose={() => setPicking(false)}
          onPick={(product) => {
            setPicking(false)
            const position = rows.reduce((max, r) => Math.max(max, r.position), 0) + 1
            void run(() => addFeatured(product.id, position).then(() => undefined), `${product.name} added.`, 'Could not add the product.')
          }}
        />
      )}
    </SettingsCard>
  )
}

function IconButton({
  label, onClick, disabled, tone, children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'danger'
  children: React.ReactNode
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`focus-ring flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-35 ${tone === 'danger' ? 'text-red-500 hover:bg-red-500/10' : 'text-muted-foreground hover:bg-primary-soft hover:text-primary'}`}>
      {children}
    </button>
  )
}

function ProductPicker({
  products, featuredIds, onClose, onPick,
}: {
  products: AdminProductListItem[]
  featuredIds: Set<string>
  onClose: () => void
  onPick: (product: AdminProductListItem) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = products
    .filter((p) => q === '' || p.name.toLowerCase().includes(q) || p.id.includes(q) || p.categoryName.toLowerCase().includes(q))
    .slice(0, 60)

  return (
    <AdminDrawer title="Add a featured product" subtitle="Search the catalog by name, id or category." onClose={onClose}>
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          className="focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </label>
      <ul className="divide-y divide-mint/70 dark:divide-border rounded-2xl border border-mint/70 dark:border-border bg-card">
        {matches.map((p) => {
          const already = featuredIds.has(p.id)
          return (
            <li key={p.id}>
              <button type="button" disabled={already} onClick={() => onPick(p)}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-primary-soft/60 disabled:cursor-not-allowed disabled:opacity-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-foreground">{p.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{p.categoryName} · <span className="font-mono">{p.id}</span>{!p.is_active && ' · unpublished'}</span>
                </span>
                <span className="shrink-0 text-[11.5px] font-semibold text-primary">{already ? 'Featured' : 'Add'}</span>
              </button>
            </li>
          )
        })}
        {matches.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">No products match.</li>}
      </ul>
    </AdminDrawer>
  )
}
