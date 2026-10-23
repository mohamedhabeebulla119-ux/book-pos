"use client"

import { useState } from 'react'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  setStock, newRequestId, describeStockError, ADJUST_REASONS, MAX_STOCK,
  type AdjustReason, type StockResult,
} from '@/lib/admin/inventory'
import { NumberField, SelectField, TextAreaField } from './fields'

/**
 * Adjust stock — the only stock-changing control in the admin app.
 *
 * Sends the quantity the admin is looking at as the expected value, so a
 * change made by someone else in the meantime is refused rather than
 * overwritten. One request id per open dialog: pressing Save again after a
 * lost response replays the first result instead of applying it twice.
 */
export function StockAdjustDialog({
  productId, variantId, label, current, onClose, onDone,
}: {
  productId: string
  /** null = the product's own stock (shared by variants that inherit it). */
  variantId: string | null
  label: string
  current: number
  onClose: () => void
  /** Called only after the database accepted (or replayed) the adjustment. */
  onDone: (result: StockResult) => void
}) {
  const [requestId] = useState(newRequestId)
  const [next, setNext] = useState<number | null>(current)
  const [reason, setReason] = useState<AdjustReason>('stock_count')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const delta = next === null ? null : next - current
  const rule = ADJUST_REASONS.find((r) => r.value === reason)

  function validate(): string | null {
    if (next === null || !Number.isInteger(next) || next < 0 || next > MAX_STOCK) {
      return `Enter a whole number from 0 to ${MAX_STOCK.toLocaleString('en-US')}.`
    }
    if (next === current) return 'That is already the current stock.'
    if (rule?.direction === 'up' && next < current) return `“${rule.label}” can only increase stock.`
    if (rule?.direction === 'down' && next > current) return `“${rule.label}” can only decrease stock.`
    const trimmed = note.trim()
    if (trimmed.length < 3 || trimmed.length > 500) return 'Add a note of 3 to 500 characters explaining the change.'
    return null
  }

  async function submit() {
    const problem = validate()
    if (problem) { setError(problem); return }
    setBusy(true)
    setError(null)
    try {
      const result = await setStock({
        productId, variantId, expected: current, next: next as number, reason, note: note.trim(), requestId,
      })
      onDone(result)
    } catch (err) {
      setError(describeStockError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-5">
      <button type="button" aria-label="Cancel" onClick={busy ? undefined : onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div role="dialog" aria-modal="true" aria-label="Adjust stock"
        className="relative w-full max-w-sm rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 shadow-float">
        <h3 className="mb-1 text-lg font-bold tracking-tight text-foreground">Adjust stock</h3>
        <p className="mb-4 text-[13px] leading-snug text-muted-foreground">
          {label} · currently <strong className="text-foreground tabular-nums">{current}</strong>
        </p>

        <div className="grid gap-3.5">
          <NumberField id="adj-next" label="New stock" min={0} value={next} disabled={busy}
            hint={delta === null || delta === 0 ? undefined : `${delta > 0 ? '+' : ''}${delta}`}
            onChange={(v) => { setNext(v); setError(null) }} />
          <SelectField id="adj-reason" label="Reason" value={reason} disabled={busy}
            options={ADJUST_REASONS}
            onChange={(v) => { setReason(v as AdjustReason); setError(null) }} />
          <TextAreaField id="adj-note" label="Note (required)" rows={3} value={note} disabled={busy}
            onChange={(v) => { setNote(v); setError(null) }} />
          <p className="text-[11.5px] leading-snug text-muted-foreground">
            Every change is recorded with your name, the reason and the note, and cannot be edited later.
          </p>
        </div>

        {error && (
          <div className="mt-3.5 flex items-start gap-2 rounded-2xl border border-red-500/25 bg-red-500/8 px-3.5 py-2.5">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-[12.5px] text-foreground">{error}</p>
          </div>
        )}

        <div className="mt-5 flex gap-2.5">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={busy}>Cancel</Button>
          <Button fullWidth onClick={() => void submit()} disabled={busy}>
            {busy ? <><LoaderCircle size={15} className="mr-1.5 animate-spin motion-reduce:animate-none" /> Saving…</> : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
