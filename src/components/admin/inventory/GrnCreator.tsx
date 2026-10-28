"use client"

import { useMemo, useState } from 'react'
import { LoaderCircle, Plus, Trash2, ScanBarcode } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/utils/formatPrice'
import { centsToRupees } from '@/lib/admin/pricing'
import { AdminDrawer } from '@/components/admin/settings/AdminDrawer'
import { TextField, TextAreaField, FieldLabel } from '@/components/admin/products/fields'
import {
  postGrn, newRequestId, describeUnitError, todayInColombo, splitCodes, isValidSerial, isValidImei,
  type GrnProductOption, type GrnResult,
} from '@/lib/admin/units'
import { ErrorNote, parseRupees } from './shared'

const CONTROL =
  'focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45 transition-colors disabled:opacity-60'

interface LineDraft {
  key: string
  productId: string
  variantId: string
  quantity: string
  cost: string
  serialText: string
}

function emptyLine(): LineDraft {
  return { key: newRequestId(), productId: '', variantId: '', quantity: '1', cost: '', serialText: '' }
}

interface LineCheck {
  product: GrnProductOption | undefined
  qty: number | null
  costCents: number | null
  serials: string[]
  problems: string[]
}

function checkLine(line: LineDraft, products: Map<string, GrnProductOption>): LineCheck {
  const product = products.get(line.productId)
  const qty = /^\d+$/.test(line.quantity.trim()) ? Number(line.quantity) : null
  const costCents = parseRupees(line.cost)
  const serials = splitCodes(line.serialText)
  const problems: string[] = []

  if (!product) problems.push('Choose a product.')
  if (product && product.variants.length > 0 && !line.variantId) problems.push('Choose the variant (colour / storage).')
  if (qty === null || qty < 1 || qty > 500) problems.push('Quantity must be 1 to 500.')
  if (costCents === null) problems.push('Unit cost must be an amount in rupees.')

  if (product?.requiresSerial && qty !== null && serials.length !== qty) {
    problems.push(`Scan ${qty} IMEI / serial number${qty === 1 ? '' : 's'} — ${serials.length} entered.`)
  } else if (!product?.requiresSerial && serials.length > 0 && qty !== null && serials.length !== qty) {
    problems.push(`Serial numbers are optional, but if given there must be one per unit (${serials.length} for ${qty}).`)
  }
  const bad = serials.filter((s) => !isValidSerial(s) || (product?.requiresSerial && /^\d{15}$/.test(s) && !isValidImei(s)))
  if (bad.length) problems.push(`Check ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? ` and ${bad.length - 3} more` : ''} — not a valid IMEI / serial.`)
  const dupes = serials.filter((s, i) => serials.indexOf(s) !== i)
  if (dupes.length) problems.push(`Scanned twice: ${[...new Set(dupes)].slice(0, 3).join(', ')}.`)

  return { product, qty, costCents, serials, problems }
}

/**
 * New GRN — record a delivery. Posting creates one barcoded unit per item and
 * raises stock through the ledger. One request id per open drawer, so pressing
 * Post again after a lost response never receives the goods twice.
 */
export function GrnCreator({ products, onClose, onPosted }: {
  products: GrnProductOption[]
  onClose: () => void
  onPosted: (result: GrnResult) => void
}) {
  const [requestId] = useState(newRequestId)
  const [supplier, setSupplier] = useState('')
  const [invoice, setInvoice] = useState('')
  const [receivedOn, setReceivedOn] = useState(todayInColombo)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>(() => [emptyLine()])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showProblems, setShowProblems] = useState(false)

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const checks = lines.map((l) => checkLine(l, byId))
  const totalUnits = checks.reduce((n, c) => n + (c.qty ?? 0), 0)
  const totalCost = checks.reduce((n, c) => n + (c.qty ?? 0) * (c.costCents ?? 0), 0)

  const options = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.id.includes(q))
  }, [products, search])

  function update(key: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
    setError(null)
  }

  async function submit() {
    setShowProblems(true)
    if (supplier.trim().length < 2) { setError('Enter the supplier name.'); return }
    const firstBad = checks.findIndex((c) => c.problems.length > 0)
    if (firstBad >= 0) { setError(`Line ${firstBad + 1}: ${checks[firstBad].problems[0]}`); return }

    setBusy(true)
    setError(null)
    try {
      const result = await postGrn({
        supplierName: supplier.trim(),
        supplierInvoice: invoice.trim(),
        receivedOn,
        note: note.trim(),
        requestId,
        lines: lines.map((l, i) => ({
          productId: l.productId,
          variantId: l.variantId || null,
          quantity: checks[i].qty as number,
          unitCostCents: checks[i].costCents as number,
          serials: checks[i].serials,
        })),
      })
      onPosted(result)
    } catch (err) {
      setError(describeUnitError(err, 'The GRN could not be posted.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminDrawer
      title="New GRN"
      subtitle="Goods received — every item gets its own barcode"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <span className="mr-auto text-[12.5px] text-muted-foreground tabular-nums">
            {totalUnits} unit{totalUnits === 1 ? '' : 's'} · {formatPrice(centsToRupees(totalCost))}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <><LoaderCircle size={15} className="mr-1.5 animate-spin motion-reduce:animate-none" /> Posting…</> : 'Post GRN'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        <TextField id="grn-supplier" label="Supplier" value={supplier} disabled={busy}
          placeholder="e.g. Tech Distributors (Pvt) Ltd" onChange={(v) => { setSupplier(v); setError(null) }} />
        <TextField id="grn-invoice" label="Supplier invoice no." hint="optional" value={invoice} disabled={busy}
          onChange={(v) => { setInvoice(v); setError(null) }} />
        <label htmlFor="grn-date" className="block">
          <FieldLabel>Received on</FieldLabel>
          <input id="grn-date" type="date" className={CONTROL} value={receivedOn} max={todayInColombo()} disabled={busy}
            onChange={(e) => { setReceivedOn(e.target.value); setError(null) }} />
        </label>
        <label htmlFor="grn-search" className="block">
          <FieldLabel hint="filters the product lists">Find product</FieldLabel>
          <input id="grn-search" type="search" className={CONTROL} value={search} placeholder="iPhone 14…"
            onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      {lines.map((line, i) => {
        const c = checks[i]
        const p = c.product
        const productOptions = p && !options.some((o) => o.id === p.id) ? [p, ...options] : options
        return (
          <section key={line.key} className="rounded-[22px] border border-mint/80 dark:border-border bg-surface p-4 shadow-card space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-bold text-foreground">Line {i + 1}</h3>
              {p?.requiresSerial && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:text-amber-300">
                  IMEI required
                </span>
              )}
              {lines.length > 1 && (
                <button type="button" aria-label={`Remove line ${i + 1}`} disabled={busy}
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  className="focus-ring ml-auto flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <label className="block">
              <FieldLabel>Product</FieldLabel>
              <select className={CONTROL} value={line.productId} disabled={busy}
                onChange={(e) => update(line.key, { productId: e.target.value, variantId: '' })}>
                <option value="">Choose a product…</option>
                {productOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}{o.categoryName ? ` · ${o.categoryName}` : ''}{o.isActive ? '' : ' (hidden)'}
                  </option>
                ))}
              </select>
            </label>

            {p && p.variants.length > 0 && (
              <label className="block">
                <FieldLabel>Variant</FieldLabel>
                <select className={CONTROL} value={line.variantId} disabled={busy}
                  onChange={(e) => update(line.key, { variantId: e.target.value })}>
                  <option value="">Choose colour / storage…</option>
                  {p.variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <FieldLabel hint="1–500">Quantity</FieldLabel>
                <input type="number" inputMode="numeric" min={1} max={500} className={cn(CONTROL, 'tabular-nums')}
                  value={line.quantity} disabled={busy} onChange={(e) => update(line.key, { quantity: e.target.value })} />
              </label>
              <label className="block">
                <FieldLabel hint="Rs., per unit">Cost price</FieldLabel>
                <input type="text" inputMode="decimal" className={cn(CONTROL, 'tabular-nums')} placeholder="0"
                  value={line.cost} disabled={busy} onChange={(e) => update(line.key, { cost: e.target.value })} />
              </label>
            </div>

            <label className="block">
              <FieldLabel hint={p?.requiresSerial ? `${c.serials.length} / ${c.qty ?? 0} scanned` : 'optional · one per line'}>
                <span className="inline-flex items-center gap-1.5"><ScanBarcode size={14} /> IMEI / serial numbers</span>
              </FieldLabel>
              <textarea rows={p?.requiresSerial ? 5 : 3} className={cn(CONTROL, 'font-mono text-[13px] leading-relaxed')}
                placeholder={'Scan the box barcode of each item.\nOne IMEI per line.'}
                value={line.serialText} disabled={busy}
                onChange={(e) => update(line.key, { serialText: e.target.value })} />
            </label>

            {showProblems && c.problems.length > 0 && (
              <ul className="space-y-1 text-[12px] text-red-600 dark:text-red-400">
                {c.problems.map((m) => <li key={m}>• {m}</li>)}
              </ul>
            )}
          </section>
        )
      })}

      <Button variant="secondary" fullWidth disabled={busy || lines.length >= 100}
        onClick={() => setLines((prev) => [...prev, emptyLine()])}>
        <Plus size={15} className="mr-1.5" /> Add another product
      </Button>

      <TextAreaField id="grn-note" label="Note (optional)" rows={2} value={note} disabled={busy}
        onChange={(v) => { setNote(v); setError(null) }} />

      <p className="text-[11.5px] leading-snug text-muted-foreground">
        Posting cannot be undone. A unit received by mistake is removed with a write-off from Inventory, which keeps the history.
      </p>

      {error && <ErrorNote message={error} />}
    </AdminDrawer>
  )
}
