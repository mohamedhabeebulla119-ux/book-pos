"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Camera, LoaderCircle, Printer, ScanBarcode, Trash2, ReceiptText, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/utils/formatPrice'
import { centsToRupees } from '@/lib/admin/pricing'
import { AdminPageHeading } from '@/components/admin/AdminPage'
import { CameraScanner, cameraScanSupported } from '@/components/admin/inventory/CameraScanner'
import { ErrorNote, SuccessNote, TH, TABLE_CARD, SELECT_CLASS, parseRupees } from '@/components/admin/inventory/shared'
import { useAdminAuth } from '@/context/AdminAuthContext'
import { useStoreSettings } from '@/lib/store/settings'
import { buildBillPdf } from '@/lib/admin/bill'
import { openPdf } from '@/lib/admin/labels'
import {
  lookupUnit, createPosSale, loadPosSale, listPosSales, canSell, newRequestId, normalizeCode,
  describeUnitError, formatDateTime, paymentLabel, PAYMENT_METHODS, UNIT_STATUS_LABEL,
  type ScannedUnit, type PaymentMethod, type PosSaleListItem, type PosSaleResult, type UnitStatus,
} from '@/lib/admin/units'

const INPUT =
  'focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45 disabled:opacity-60'

const noop = () => () => {}

/** Short beep: the cashier hears a scan land without looking at the screen. */
function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 1200 : 220
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.25))
    osc.onended = () => void ctx.close()
  } catch { /* sound is a nicety */ }
}

/**
 * Shop counter (POS). Scan each item's barcode label — or its box IMEI — and
 * those exact units are sold when the bill is completed. Prices come from the
 * database, never from this screen.
 */
export default function AdminPosPage() {
  const { role } = useAdminAuth()
  const { settings } = useStoreSettings()
  const allowed = canSell(role)
  const cameraOk = useSyncExternalStore(noop, cameraScanSupported, () => false)

  const [requestId, setRequestId] = useState(newRequestId)
  const [cart, setCart] = useState<ScannedUnit[]>([])
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [camera, setCamera] = useState(false)

  const [discount, setDiscount] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [saleError, setSaleError] = useState<string | null>(null)
  const [done, setDone] = useState<PosSaleResult | null>(null)

  const [sales, setSales] = useState<PosSaleListItem[] | null>(null)
  const [salesError, setSalesError] = useState<string | null>(null)
  const [printing, setPrinting] = useState<string | null>(null)

  const scanRef = useRef<HTMLInputElement>(null)
  const cartRef = useRef(cart)
  useEffect(() => { cartRef.current = cart }, [cart])

  const refreshSales = useCallback(() => {
    listPosSales()
      .then((rows) => { setSales(rows); setSalesError(null) })
      .catch((err) => setSalesError(describeUnitError(err, 'Could not load recent bills.')))
  }, [])

  useEffect(() => {
    let cancelled = false
    listPosSales()
      .then((rows) => { if (!cancelled) setSales(rows) })
      .catch((err) => { if (!cancelled) setSalesError(describeUnitError(err, 'Could not load recent bills.')) })
    return () => { cancelled = true }
  }, [])

  const subtotal = cart.reduce((sum, u) => sum + (u.price_cents ?? 0), 0)
  const discountCents = parseRupees(discount)
  const total = subtotal - (discountCents ?? 0)

  const addCode = useCallback(async (raw: string) => {
    const value = normalizeCode(raw)
    if (!value) return
    setScanError(null)
    setDone(null)
    if (cartRef.current.some((u) => u.barcode === value || u.serial_number === value)) {
      setScanError(`${value} is already on this bill.`)
      beep(false)
      return
    }
    setScanning(true)
    try {
      const unit = await lookupUnit(value)
      if (cartRef.current.some((u) => u.unit_id === unit.unit_id)) {
        setScanError(`${unit.barcode} is already on this bill.`)
        beep(false)
      } else if (unit.status !== 'in_stock') {
        setScanError(`${unit.barcode} (${unit.product_name}) is ${UNIT_STATUS_LABEL[unit.status as UnitStatus]?.toLowerCase() ?? unit.status} — it cannot be sold.`)
        beep(false)
      } else if (unit.price_cents === null) {
        setScanError(`${unit.product_name} has no retail price. Set a price in Pricing first.`)
        beep(false)
      } else {
        setCart((prev) => [...prev, unit])
        beep(true)
      }
    } catch (err) {
      setScanError(describeUnitError(err, 'That code could not be looked up.'))
      beep(false)
    } finally {
      setScanning(false)
      setCode('')
      scanRef.current?.focus()
    }
  }, [])

  function newSale() {
    setCart([])
    setDiscount('')
    setPayment('cash')
    setCustomerName('')
    setCustomerPhone('')
    setNote('')
    setSaleError(null)
    setScanError(null)
    setRequestId(newRequestId())
    scanRef.current?.focus()
  }

  async function completeSale() {
    if (cart.length === 0) { setSaleError('Scan at least one item.'); return }
    if (discountCents === null) { setSaleError('The discount must be an amount in rupees.'); return }
    if (discountCents > subtotal) { setSaleError('The discount cannot be more than the subtotal.'); return }
    setBusy(true)
    setSaleError(null)
    try {
      const result = await createPosSale({
        codes: cart.map((u) => u.barcode),
        paymentMethod: payment,
        discountCents,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        note: note.trim(),
        requestId,
      })
      setDone(result)
      newSale()
      refreshSales()
      void printBill(result.id)
    } catch (err) {
      setSaleError(describeUnitError(err, 'The sale could not be completed.'))
    } finally {
      setBusy(false)
    }
  }

  async function printBill(saleId: string) {
    setPrinting(saleId)
    try {
      const detail = await loadPosSale(saleId)
      const blob = await buildBillPdf(detail, {
        name: settings.store_name || 'Apple Expert',
        phone: settings.contact_phone,
        address: settings.address,
      })
      openPdf(blob, `${detail.sale.bill_number}.pdf`)
    } catch (err) {
      setSalesError(describeUnitError(err, 'The bill could not be printed.'))
    } finally {
      setPrinting(null)
    }
  }

  if (!allowed) {
    return (
      <>
        <AdminPageHeading title="Shop counter (POS)" />
        <ErrorNote message="Your role cannot bill at the counter." />
      </>
    )
  }

  return (
    <>
      <AdminPageHeading title="Shop counter (POS)"
        subtitle="Scan each item's barcode label or box IMEI. Completing the bill sells exactly those items and lowers stock." />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Scan + cart */}
        <div className="space-y-4">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void addCode(code) }}>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted-foreground">
                {scanning ? <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" /> : <ScanBarcode size={17} />}
              </span>
              <input ref={scanRef} autoFocus value={code} onChange={(e) => setCode(e.target.value)} disabled={busy}
                aria-label="Scan barcode or IMEI" placeholder="Scan barcode or type AE… / IMEI and press Enter"
                className="focus-ring h-12 w-full rounded-xl border border-mint-deep dark:border-border bg-card pl-11 pr-3 font-mono text-[15px] text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:border-primary/45" />
            </div>
            <Button type="submit" disabled={busy || scanning || !code.trim()}>Add</Button>
            {cameraOk && (
              <Button type="button" variant="secondary" size="icon" aria-label="Scan with camera" onClick={() => setCamera((c) => !c)}>
                <Camera size={17} />
              </Button>
            )}
          </form>

          {camera && <CameraScanner onCode={(c) => void addCode(c)} onClose={() => setCamera(false)} />}
          {scanError && <ErrorNote message={scanError} />}
          {done && (
            <SuccessNote message={done.replayed
              ? `Bill ${done.bill_number} had already been saved — nothing was sold twice.`
              : `Bill ${done.bill_number} completed · ${formatPrice(centsToRupees(done.total_cents))}. The bill is opening for printing.`} />
          )}

          <div className={TABLE_CARD}>
            {cart.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">No items yet — scan the first one.</p>
            ) : (
              <ul className="divide-y divide-mint/50 dark:divide-border/70">
                {cart.map((u, i) => (
                  <li key={u.unit_id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 shrink-0 text-[12px] text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground truncate">{u.product_name}</span>
                      <span className="block text-[11.5px] text-muted-foreground truncate">
                        {[u.variant_name, u.barcode, u.serial_number].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatPrice(centsToRupees(u.price_cents ?? 0))}</span>
                    <button type="button" aria-label={`Remove ${u.barcode}`} disabled={busy}
                      onClick={() => setCart((prev) => prev.filter((x) => x.unit_id !== u.unit_id))}
                      className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Payment */}
        <aside className="h-fit space-y-3 rounded-[26px] border border-mint/80 dark:border-border bg-surface p-5 shadow-card lg:sticky lg:top-4">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal ({cart.length})</span><span className="tabular-nums">{formatPrice(centsToRupees(subtotal))}</span></div>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Discount (Rs.)</span>
            <input inputMode="decimal" className={cn(INPUT, 'tabular-nums')} placeholder="0" value={discount} disabled={busy}
              onChange={(e) => { setDiscount(e.target.value); setSaleError(null) }} />
          </label>
          <div className="flex items-baseline justify-between border-t border-mint/70 dark:border-border pt-3">
            <span className="font-bold">Total</span>
            <span className="text-2xl font-bold tabular-nums">{formatPrice(centsToRupees(Math.max(total, 0)))}</span>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Payment</span>
            <select className={cn(SELECT_CLASS, 'w-full')} value={payment} disabled={busy} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <input className={INPUT} placeholder="Customer name (optional)" value={customerName} disabled={busy} onChange={(e) => setCustomerName(e.target.value)} />
          <input className={INPUT} inputMode="tel" placeholder="Customer phone (optional)" value={customerPhone} disabled={busy} onChange={(e) => setCustomerPhone(e.target.value)} />
          <input className={INPUT} placeholder="Note (optional)" value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} />
          {saleError && <ErrorNote message={saleError} />}
          <Button fullWidth size="lg" onClick={() => void completeSale()} disabled={busy || cart.length === 0}>
            {busy ? <><LoaderCircle size={16} className="mr-1.5 animate-spin motion-reduce:animate-none" /> Saving…</> : 'Complete sale & print bill'}
          </Button>
          {cart.length > 0 && (
            <Button fullWidth variant="ghost" onClick={newSale} disabled={busy}><RotateCcw size={15} className="mr-1.5" /> Clear bill</Button>
          )}
        </aside>
      </div>

      {/* Recent bills */}
      <h2 className="mt-8 mb-3 flex items-center gap-2 text-lg font-bold tracking-tight"><ReceiptText size={18} /> Recent counter bills</h2>
      {salesError && <ErrorNote message={salesError} className="mb-3" />}
      {sales === null && !salesError && <p className="text-sm text-muted-foreground">Loading…</p>}
      {sales && sales.length === 0 && <p className="text-sm text-muted-foreground">No counter sales yet.</p>}
      {sales && sales.length > 0 && (
        <div className={TABLE_CARD}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mint/70 dark:border-border bg-muted/60">
                  <th scope="col" className={TH}>Bill</th>
                  <th scope="col" className={TH}>Customer</th>
                  <th scope="col" className={`${TH} text-right`}>Items</th>
                  <th scope="col" className={`${TH} text-right`}>Total</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-mint/50 dark:border-border/70 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="block font-semibold">{s.bill_number}</span>
                      <span className="block text-[11px] text-muted-foreground">{formatDateTime(s.created_at)}{s.cashierName ? ` · ${s.cashierName}` : ''}</span>
                    </td>
                    <td className="px-4 py-3 min-w-[140px] text-muted-foreground">{s.customer_name || s.customer_phone || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.itemCount}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="block font-semibold tabular-nums">{formatPrice(centsToRupees(s.total_cents))}</span>
                      <span className="block text-[11px] text-muted-foreground">{paymentLabel(s.payment_method)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="secondary" disabled={printing === s.id} onClick={() => void printBill(s.id)}>
                        {printing === s.id ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" /> : <Printer size={14} className="mr-1" />} Bill
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
