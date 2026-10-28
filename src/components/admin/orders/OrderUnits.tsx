"use client"

import { useEffect, useState } from 'react'
import { ScanBarcode } from 'lucide-react'
import { listOrderUnits, formatDate, type UnitView } from '@/lib/admin/units'
import { UnitStatusBadge } from '@/components/admin/inventory/shared'

/**
 * The barcoded units an online order holds — what staff pick from the shelf
 * and pack. They were chosen oldest-first when the order was placed. Staff
 * only: the customer never sees a barcode or an IMEI.
 */
export function OrderUnits({ orderId, version }: { orderId: string; version: string }) {
  const [units, setUnits] = useState<UnitView[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    listOrderUnits(orderId)
      .then((u) => { if (!cancelled) { setUnits(u); setFailed(false) } })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [orderId, version])

  // Orders of items without barcodes (or placed before barcodes) show nothing.
  if (failed || !units || units.length === 0) return null

  return (
    <section className="bg-surface border border-mint/80 dark:border-border rounded-[22px] shadow-card p-5">
      <h3 className="mb-1 flex items-center gap-2 text-[15px] font-bold tracking-tight text-foreground">
        <ScanBarcode size={16} className="text-muted-foreground" /> Units to pack
      </h3>
      <p className="mb-3 text-[12px] text-muted-foreground leading-relaxed">
        Reserved oldest-first when the order was placed. Pick these exact items from the shelf.
      </p>
      <ul className="space-y-2">
        {units.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0">
              <span className="block font-mono font-semibold">{u.barcode}</span>
              <span className="block truncate text-[11.5px] text-muted-foreground">
                {[u.productName, u.variantName, u.serial_number, `received ${formatDate(u.received_on)}`].filter(Boolean).join(' · ')}
              </span>
            </span>
            <UnitStatusBadge status={u.status} />
          </li>
        ))}
      </ul>
    </section>
  )
}
