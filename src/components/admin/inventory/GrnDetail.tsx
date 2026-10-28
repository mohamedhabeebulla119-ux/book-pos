"use client"

import { useEffect, useMemo, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { formatPrice } from '@/utils/formatPrice'
import { centsToRupees } from '@/lib/admin/pricing'
import { AdminDrawer } from '@/components/admin/settings/AdminDrawer'
import { loadGrn, describeUnitError, formatDate, type GrnDetail as GrnData } from '@/lib/admin/units'
import { unitToLabel } from '@/lib/admin/labels'
import { ErrorNote, SuccessNote, PrintLabels, UnitStatusBadge } from './shared'

/** One GRN: what arrived, every unit it created, and its barcode labels. */
export function GrnDetail({ grnId, justPosted, onClose }: {
  grnId: string
  /** Shown once, right after posting. */
  justPosted?: string | null
  onClose: () => void
}) {
  const [data, setData] = useState<GrnData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lineFilter, setLineFilter] = useState<string>('all')

  useEffect(() => {
    let cancelled = false
    loadGrn(grnId)
      .then((d) => { if (!cancelled) setData(d) })
      .catch((err) => { if (!cancelled) setError(describeUnitError(err, 'Could not load this GRN.')) })
    return () => { cancelled = true }
  }, [grnId])

  const units = useMemo(
    () => (data?.units ?? []).filter((u) => lineFilter === 'all' || u.grn_line_id === lineFilter),
    [data, lineFilter],
  )

  return (
    <AdminDrawer
      title={data ? data.grn.grn_number : 'GRN'}
      subtitle={data ? `${data.grn.supplier_name} · ${formatDate(data.grn.received_on)}` : undefined}
      onClose={onClose}
    >
      {justPosted && <SuccessNote message={justPosted} />}
      {error && <ErrorNote message={error} />}
      {!data && !error && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" /> Loading…
        </div>
      )}

      {data && (
        <>
          <dl className="grid grid-cols-2 gap-3 rounded-[22px] border border-mint/80 dark:border-border bg-surface p-4 text-[13px] shadow-card">
            <div><dt className="text-muted-foreground text-[11.5px]">Units received</dt><dd className="font-bold tabular-nums">{data.grn.total_units}</dd></div>
            <div><dt className="text-muted-foreground text-[11.5px]">Total cost</dt><dd className="font-bold tabular-nums">{formatPrice(centsToRupees(data.grn.total_cost_cents))}</dd></div>
            <div><dt className="text-muted-foreground text-[11.5px]">Supplier invoice</dt><dd>{data.grn.supplier_invoice || '—'}</dd></div>
            <div><dt className="text-muted-foreground text-[11.5px]">Received on</dt><dd>{formatDate(data.grn.received_on)}</dd></div>
            {data.grn.note && <div className="col-span-2"><dt className="text-muted-foreground text-[11.5px]">Note</dt><dd>{data.grn.note}</dd></div>}
          </dl>

          <section className="rounded-[22px] border border-mint/80 dark:border-border bg-surface p-4 shadow-card space-y-2.5">
            <h3 className="text-[14px] font-bold text-foreground">Products</h3>
            {data.lines.map((l) => (
              <div key={l.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground truncate">{l.product_name_snapshot}</span>
                  {l.variant_label_snapshot && <span className="block text-[11.5px] text-muted-foreground">{l.variant_label_snapshot}</span>}
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block font-semibold">× {l.quantity}</span>
                  <span className="block text-[11.5px] text-muted-foreground">{formatPrice(centsToRupees(l.unit_cost_cents))} each</span>
                </span>
              </div>
            ))}
          </section>

          <section className="rounded-[22px] border border-mint/80 dark:border-border bg-surface p-4 shadow-card space-y-3">
            <div>
              <h3 className="text-[14px] font-bold text-foreground">Barcode labels</h3>
              <p className="text-[12px] text-muted-foreground">Stick one label on each item. The counter scanner reads the barcode; a phone camera reads the QR.</p>
            </div>
            {data.lines.length > 1 && (
              <select aria-label="Which product" value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}
                className="focus-ring h-11 w-full rounded-xl border border-mint-deep dark:border-border bg-card px-3 text-sm">
                <option value="all">All products ({data.units.length})</option>
                {data.lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.product_name_snapshot}{l.variant_label_snapshot ? ` · ${l.variant_label_snapshot}` : ''} ({l.quantity})
                  </option>
                ))}
              </select>
            )}
            <PrintLabels items={units.map(unitToLabel)} fileName={`${data.grn.grn_number}-labels.pdf`} />
          </section>

          <section className="rounded-[22px] border border-mint/80 dark:border-border bg-surface shadow-card overflow-hidden">
            <h3 className="px-4 pt-4 pb-2 text-[14px] font-bold text-foreground">Units ({units.length})</h3>
            <ul className="divide-y divide-mint/50 dark:divide-border/70">
              {units.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-mono text-[13px] font-semibold text-foreground">{u.barcode}</span>
                    <span className="block text-[11.5px] text-muted-foreground truncate">
                      {u.variantName ?? u.productName}{u.serial_number ? ` · ${u.serial_number}` : ''}
                    </span>
                  </span>
                  <UnitStatusBadge status={u.status} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </AdminDrawer>
  )
}
