"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, LoaderCircle, Boxes, Ban, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { AdminPageHeading } from '@/components/admin/AdminPage'
import { ErrorNote, SuccessNote, PrintLabels, UnitStatusBadge, TH, TABLE_CARD, SELECT_CLASS } from '@/components/admin/inventory/shared'
import { useAdminAuth } from '@/context/AdminAuthContext'
import { unitToLabel } from '@/lib/admin/labels'
import {
  listUnits, loadUnitSummary, listProductsForGrn, writeOffUnits, returnPosUnit, canReceiveStock,
  describeUnitError, formatDate, UNIT_STATUSES, UNIT_STATUS_LABEL, UNIT_FETCH_LIMIT,
  type UnitView, type UnitSummaryRow, type UnitStatus, type GrnProductOption,
} from '@/lib/admin/units'

type Tab = 'summary' | 'units'

export default function AdminInventoryPage() {
  const { role } = useAdminAuth()
  const isAdmin = canReceiveStock(role)
  const [tab, setTab] = useState<Tab>('summary')

  const [products, setProducts] = useState<GrnProductOption[]>([])
  const [summary, setSummary] = useState<UnitSummaryRow[] | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [status, setStatus] = useState<UnitStatus | 'all'>('in_stock')
  const [productId, setProductId] = useState('')
  const [code, setCode] = useState('')
  const [units, setUnits] = useState<UnitView[] | null>(null)
  const [unitsError, setUnitsError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [action, setAction] = useState<null | { kind: 'write_off' } | { kind: 'return'; unit: UnitView }>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    const p = await listProductsForGrn()
    const s = await loadUnitSummary(p)
    return [p, s] as const
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSummary()
      .then(([p, s]) => { if (!cancelled) { setProducts(p); setSummary(s) } })
      .catch((err) => { if (!cancelled) setSummaryError(describeUnitError(err, 'Could not load stock.')) })
    return () => { cancelled = true }
  }, [loadSummary])

  const searchUnits = useCallback(() => {
    setUnitsError(null)
    setSelected(new Set())
    listUnits({ status, productId: productId || null, code })
      .then(setUnits)
      .catch((err) => setUnitsError(describeUnitError(err, 'Could not load units.')))
  }, [status, productId, code])

  // Status / product filters apply straight away; the code box on Enter.
  useEffect(() => {
    if (tab !== 'units') return
    let cancelled = false
    listUnits({ status, productId: productId || null, code: '' })
      .then((rows) => { if (!cancelled) { setUnits(rows); setSelected(new Set()); setUnitsError(null) } })
      .catch((err) => { if (!cancelled) setUnitsError(describeUnitError(err, 'Could not load units.')) })
    return () => { cancelled = true }
  }, [tab, status, productId])

  function refreshAll() {
    searchUnits()
    loadSummary().then(([p, s]) => { setProducts(p); setSummary(s) }).catch(() => {})
  }

  const selectedUnits = useMemo(() => (units ?? []).filter((u) => selected.has(u.id)), [units, selected])
  const writable = selectedUnits.filter((u) => u.status === 'in_stock')

  function showUnitsFor(row: UnitSummaryRow) {
    setProductId(row.productId)
    setStatus('in_stock')
    setCode('')
    setTab('units')
  }

  const totals = (summary ?? []).reduce(
    (t, r) => ({ inStock: t.inStock + r.inStock, reserved: t.reserved + r.reserved, sold: t.sold + r.sold }),
    { inStock: 0, reserved: 0, sold: 0 },
  )

  return (
    <>
      <AdminPageHeading title="Inventory"
        subtitle="Every barcoded item: what is on the shelf, held for online orders, sold or written off. Oldest stock goes out first." />

      <div role="tablist" className="mb-4 inline-flex rounded-full border border-mint-deep dark:border-border bg-card p-1">
        {([['summary', 'Stock by product'], ['units', 'Units & barcodes']] as const).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
            className={cn('focus-ring rounded-full px-4 py-2 text-[13px] font-semibold transition',
              tab === value ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>

      {notice && <SuccessNote message={notice} className="mb-4" />}

      {tab === 'summary' && (
        <>
          {summaryError && <ErrorNote message={summaryError} />}
          {summary === null && !summaryError && (
            <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted-foreground">
              <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" /> Loading stock…
            </div>
          )}
          {summary && summary.length === 0 && (
            <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-14 text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-well-strong border border-mint-deep text-primary"><Boxes size={24} /></span>
              <h2 className="text-lg font-bold mb-1.5">No barcoded stock yet</h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">Post a GRN to receive items. Each one gets a barcode and appears here.</p>
            </div>
          )}
          {summary && summary.length > 0 && (
            <>
              <p className="mb-3 text-[13px] text-muted-foreground tabular-nums">
                {totals.inStock} on the shelf · {totals.reserved} held for online orders · {totals.sold} sold
              </p>
              <div className={TABLE_CARD}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-mint/70 dark:border-border bg-muted/60">
                        <th scope="col" className={TH}>Product</th>
                        <th scope="col" className={`${TH} text-right`}>On shelf</th>
                        <th scope="col" className={`${TH} text-right`}>Reserved</th>
                        <th scope="col" className={`${TH} text-right`}>Sold</th>
                        <th scope="col" className={`${TH} text-right`}>Written off</th>
                        <th scope="col" className={TH}>Oldest unit</th>
                        <th scope="col" className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((r) => (
                        <tr key={`${r.productId}:${r.variantId ?? ''}`} className="border-b border-mint/50 dark:border-border/70 last:border-0">
                          <td className="px-4 py-3 min-w-[200px]">
                            <span className="block font-semibold">{r.productName}</span>
                            {r.variantName && <span className="block text-[11.5px] text-muted-foreground">{r.variantName}</span>}
                          </td>
                          <td className={cn('px-4 py-3 text-right tabular-nums font-bold', r.inStock <= 5 && 'text-amber-600 dark:text-amber-400')}>{r.inStock}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{r.reserved}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.sold}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.writtenOff}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.oldestReceivedOn ? formatDate(r.oldestReceivedOn) : '—'}</td>
                          <td className="px-4 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => showUnitsFor(r)}>Units</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'units' && (
        <>
          <div className="mb-4 flex flex-col lg:flex-row gap-2.5">
            <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); searchUnits() }}>
              <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted-foreground"><Search size={16} /></span>
              <input type="search" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Find by barcode or IMEI"
                placeholder="Scan or type a barcode / IMEI, then Enter"
                className="focus-ring h-11 w-full rounded-xl border border-mint-deep dark:border-border bg-card pl-11 pr-3 font-mono text-sm placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:border-primary/45" />
            </form>
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as UnitStatus | 'all')} className={SELECT_CLASS}>
              <option value="all">All statuses</option>
              {UNIT_STATUSES.map((s) => <option key={s} value={s}>{UNIT_STATUS_LABEL[s]}</option>)}
            </select>
            <select aria-label="Product" value={productId} onChange={(e) => setProductId(e.target.value)} className={cn(SELECT_CLASS, 'lg:max-w-[260px]')}>
              <option value="">All products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {selectedUnits.length > 0 && (
            <div className="mb-4 space-y-3 rounded-[22px] border border-mint/80 dark:border-border bg-surface p-4 shadow-card">
              <p className="text-[13px] font-semibold">{selectedUnits.length} selected</p>
              <PrintLabels items={selectedUnits.map(unitToLabel)} fileName="unit-labels.pdf" label="Reprint labels" />
              {isAdmin && (
                <Button variant="outline" disabled={writable.length === 0} onClick={() => setAction({ kind: 'write_off' })}>
                  <Ban size={15} className="mr-1.5" /> Write off {writable.length} on-shelf unit{writable.length === 1 ? '' : 's'}
                </Button>
              )}
            </div>
          )}

          {unitsError && <ErrorNote message={unitsError} />}
          {units === null && !unitsError && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
          {units && units.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No units match.</p>}
          {units && units.length > 0 && (
            <div className={TABLE_CARD}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mint/70 dark:border-border bg-muted/60">
                      <th scope="col" className="px-4 py-3 w-10">
                        <input type="checkbox" aria-label="Select all"
                          checked={units.length > 0 && selected.size === units.length}
                          onChange={(e) => setSelected(e.target.checked ? new Set(units.map((u) => u.id)) : new Set())} />
                      </th>
                      <th scope="col" className={TH}>Barcode</th>
                      <th scope="col" className={TH}>Item</th>
                      <th scope="col" className={TH}>Received</th>
                      <th scope="col" className={TH}>Status</th>
                      <th scope="col" className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u.id} className="border-b border-mint/50 dark:border-border/70 last:border-0">
                        <td className="px-4 py-3">
                          <input type="checkbox" aria-label={`Select ${u.barcode}`} checked={selected.has(u.id)}
                            onChange={(e) => setSelected((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(u.id); else next.delete(u.id)
                              return next
                            })} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="block font-mono font-semibold">{u.barcode}</span>
                          {u.serial_number && <span className="block font-mono text-[11px] text-muted-foreground">{u.serial_number}</span>}
                        </td>
                        <td className="px-4 py-3 min-w-[180px]">
                          <span className="block">{u.productName}</span>
                          {u.variantName && <span className="block text-[11.5px] text-muted-foreground">{u.variantName}</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          <span className="block">{formatDate(u.received_on)}</span>
                          {u.grnNumber && <span className="block text-[11px]">{u.grnNumber}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <UnitStatusBadge status={u.status} />
                          {u.status_note && <span className="mt-1 block max-w-[220px] truncate text-[11px] text-muted-foreground">{u.status_note}</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && u.status === 'sold' && u.pos_sale_id && (
                            <Button size="sm" variant="secondary" onClick={() => setAction({ kind: 'return', unit: u })}>
                              <Undo2 size={14} className="mr-1" /> Return
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {units && units.length >= UNIT_FETCH_LIMIT && (
            <p className="mt-3 text-[12px] text-muted-foreground">Showing the first {UNIT_FETCH_LIMIT}. Narrow by product or search a barcode.</p>
          )}
        </>
      )}

      {action && (
        <UnitActionDialog
          title={action.kind === 'write_off' ? `Write off ${writable.length} unit${writable.length === 1 ? '' : 's'}` : `Counter return · ${action.unit.barcode}`}
          description={action.kind === 'write_off'
            ? 'The units leave stock permanently (damaged, lost, or received by mistake). The history is kept.'
            : 'The customer brought this item back. It returns to the shelf and stock rises by one. Write it off afterwards if it is damaged.'}
          withReason={action.kind === 'write_off'}
          onClose={() => setAction(null)}
          onConfirm={async (reason, note) => {
            if (action.kind === 'write_off') {
              const n = await writeOffUnits(writable.map((u) => u.id), reason, note)
              setNotice(`${n} unit${n === 1 ? '' : 's'} written off.`)
            } else {
              await returnPosUnit(action.unit.id, note)
              setNotice(`${action.unit.barcode} is back on the shelf.`)
            }
            setAction(null)
            refreshAll()
          }}
        />
      )}
    </>
  )
}

function UnitActionDialog({ title, description, withReason, onClose, onConfirm }: {
  title: string
  description: string
  withReason: boolean
  onClose: () => void
  onConfirm: (reason: 'damage' | 'correction', note: string) => Promise<void>
}) {
  const [reason, setReason] = useState<'damage' | 'correction'>('damage')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = note.trim()
    if (trimmed.length < 3 || trimmed.length > 500) { setError('Add a note of 3 to 500 characters.'); return }
    setBusy(true)
    setError(null)
    try {
      await onConfirm(reason, trimmed)
    } catch (err) {
      setError(describeUnitError(err, 'The change was not saved.'))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <button type="button" aria-label="Cancel" onClick={busy ? undefined : onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div role="dialog" aria-modal="true" aria-label={title}
        className="relative w-full max-w-sm rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 shadow-float space-y-3.5">
        <div>
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{description}</p>
        </div>
        {withReason && (
          <select aria-label="Reason" value={reason} disabled={busy} onChange={(e) => setReason(e.target.value as 'damage' | 'correction')} className={cn(SELECT_CLASS, 'w-full')}>
            <option value="damage">Damaged / lost</option>
            <option value="correction">Received by mistake (GRN correction)</option>
          </select>
        )}
        <textarea rows={3} value={note} disabled={busy} onChange={(e) => { setNote(e.target.value); setError(null) }}
          placeholder="Note (required)"
          className="focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:border-primary/45" />
        {error && <ErrorNote message={error} />}
        <div className="flex gap-2.5">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={busy}>Cancel</Button>
          <Button fullWidth onClick={() => void submit()} disabled={busy}>
            {busy ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" /> : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}
