"use client"

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  CONDITION_OPTIONS, WARRANTY_TYPE_OPTIONS, BRAND_NEW_FIELDS, parseAddOnInput,
  createConditionGrade, updateConditionGrade, deleteConditionGrade,
  type ConditionFields, type ConditionRow, type ConditionGradeRow,
  type PlanFields, type WarrantyOptionRow, type WarrantyPlanRow,
} from '@/lib/admin/warranty'
import { rupeesToCents, centsToRupees } from '@/lib/admin/pricing'
import { durationLabel } from '@/lib/catalog'
import { describeAdminError } from '@/lib/admin/errors'
import { TextField, NumberField, TextAreaField, SelectField, FieldLabel } from './fields'

/**
 * Condition and warranty editing blocks for the product editor.
 *
 *   ConditionEditor – one item's condition: the product's (no variants) or a
 *                     single variant's. Editing one never touches another.
 *   PlanEditor      – one warranty plan: the product default or a variant's
 *                     override, with its own options.
 *
 * Scalar fields are saved with "Save changes"; adding, deleting, defaulting and
 * reordering warranty options are written immediately — the same split the
 * editor already uses for variants.
 */

const INPUT = 'focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/45 disabled:opacity-60'

// ---------------------------------------------------------------------------
// Condition
// ---------------------------------------------------------------------------

/** One item's condition as edited; rowId is the product_conditions row, if any. */
export type ConditionDraft = ConditionFields & { rowId: string | null }

/** A row's fields, or Brand New when there is no row. */
export function conditionDraftFrom(row: ConditionRow | undefined): ConditionDraft {
  if (!row) return { ...BRAND_NEW_FIELDS, rowId: null }
  return {
    rowId: row.id,
    condition: row.condition,
    condition_grade_id: row.condition_grade_id,
    battery_health: row.battery_health,
    cycle_count: row.cycle_count,
    physical_condition: row.physical_condition,
    accessories_included: row.accessories_included,
    device_notes: row.device_notes,
  }
}

/** True when the draft differs from what is stored (no row = Brand New). */
export function conditionChanged(draft: ConditionDraft, row: ConditionRow | undefined): boolean {
  const stored = conditionDraftFrom(row)
  return (Object.keys(BRAND_NEW_FIELDS) as (keyof ConditionFields)[]).some((k) => draft[k] !== stored[k])
}

/** True when a draft holds pre-owned data that switching to Brand New would clear. */
export function holdsPreOwnedData(draft: ConditionDraft): boolean {
  return draft.condition === 'pre_owned'
}

/**
 * Brand New / Pre-Owned for ONE item, plus its pre-owned details. Choosing
 * Brand New on a pre-owned item is not applied here: `onRequestBrandNew` lets
 * the editor confirm first, because it clears that item's details.
 */
export function ConditionEditor({
  idPrefix, draft, onChange, onRequestBrandNew, grades, disabled,
}: {
  idPrefix: string
  draft: ConditionDraft
  onChange: (next: ConditionDraft) => void
  onRequestBrandNew: () => void
  grades: ConditionGradeRow[]
  disabled: boolean
}) {
  const patch = <K extends keyof ConditionFields>(key: K, value: ConditionFields[K]) => onChange({ ...draft, [key]: value })

  function choose(value: string) {
    if (value === draft.condition) return
    if (value === 'brand_new' && holdsPreOwnedData(draft)) { onRequestBrandNew(); return }
    onChange({ ...draft, condition: value })
  }

  return (
    <div className="grid gap-3">
      <fieldset>
        <legend className="mb-1.5 text-[12.5px] font-semibold text-foreground">Condition</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {CONDITION_OPTIONS.map((option) => {
            const checked = draft.condition === option.value
            return (
              <label key={option.value}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                  checked ? 'border-primary/45 bg-primary-soft text-primary' : 'border-mint-deep dark:border-border bg-card text-foreground'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
                <input type="radio" name={`${idPrefix}-condition`} value={option.value} checked={checked} disabled={disabled}
                  onChange={() => choose(option.value)} className="accent-[var(--primary)]" />
                {option.label}
              </label>
            )
          })}
        </div>
        {/* A stored value the UI does not offer (refurbished) is shown, never silently replaced. */}
        {!CONDITION_OPTIONS.some((o) => o.value === draft.condition) && (
          <p className="mt-1.5 text-[12px] text-amber-600 dark:text-amber-400">
            Saved as “{draft.condition}”, which is not offered yet. Choose Brand New or Pre-Owned to change it.
          </p>
        )}
      </fieldset>

      {draft.condition === 'pre_owned' && (
        <>
          <SelectField id={`${idPrefix}-grade`} label="Condition grade" value={draft.condition_grade_id ?? ''} disabled={disabled}
            allowEmpty onChange={(v) => patch('condition_grade_id', v || null)}
            hint={grades.length === 0 ? 'no grades defined yet' : undefined}
            options={grades.map((g) => ({ value: g.id, label: g.is_active ? `${g.code} — ${g.label}` : `${g.code} — ${g.label} (hidden)` }))} />
          <div className="grid sm:grid-cols-2 gap-3">
            <NumberField id={`${idPrefix}-batt`} label="Battery health" hint="%, 0–100" min={0} value={draft.battery_health} disabled={disabled}
              onChange={(v) => patch('battery_health', v)} />
            <NumberField id={`${idPrefix}-cycles`} label="Cycle count" min={0} value={draft.cycle_count} disabled={disabled}
              onChange={(v) => patch('cycle_count', v)} />
          </div>
          <TextField id={`${idPrefix}-phys`} label="Physical condition" value={draft.physical_condition ?? ''} disabled={disabled}
            placeholder="e.g. Light scratches on the back glass"
            onChange={(v) => patch('physical_condition', v || null)} />
          <TextField id={`${idPrefix}-acc`} label="Accessories included" value={draft.accessories_included ?? ''} disabled={disabled}
            placeholder="e.g. Original box, USB-C cable"
            onChange={(v) => patch('accessories_included', v || null)} />
          <TextAreaField id={`${idPrefix}-notes`} label="Device notes" rows={3} value={draft.device_notes ?? ''} disabled={disabled}
            onChange={(v) => patch('device_notes', v || null)} />
        </>
      )}
    </div>
  )
}

/** The admin-defined grading scale. Nothing is seeded: the business defines it. */
export function GradesManager({ grades, onChanged }: { grades: ConditionGradeRow[]; onChanged: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await onChanged()
    } catch (err) {
      setError(describeAdminError(err, 'The database refused that change.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 space-y-2.5 rounded-2xl border border-mint/70 dark:border-border bg-card p-3.5">
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Grades apply to every pre-owned product and variant. Removing one leaves the items that used it ungraded.
      </p>
      {grades.map((g) => (
        <GradeRow key={g.id} grade={g} busy={busy} run={run} />
      ))}
      <div className="grid gap-2 sm:grid-cols-[5rem_1fr]">
        <input aria-label="New grade code" value={code} placeholder="A+" disabled={busy}
          onChange={(e) => setCode(e.target.value)} className={INPUT} />
        <input aria-label="New grade label" value={label} placeholder="Label, e.g. Excellent" disabled={busy}
          onChange={(e) => setLabel(e.target.value)} className={INPUT} />
      </div>
      <input aria-label="New grade description" value={description} disabled={busy}
        placeholder="What this grade means (shown to customers)"
        onChange={(e) => setDescription(e.target.value)} className={INPUT} />
      <Button type="button" variant="outline" size="sm" disabled={busy || !code.trim() || !label.trim()}
        onClick={() => void run(async () => {
          await createConditionGrade({ code, label, description }, grades)
          setCode(''); setLabel(''); setDescription('')
        })}>
        <Plus size={14} className="mr-1.5" /> Add grade
      </Button>
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  )
}

function GradeRow({
  grade, busy, run,
}: {
  grade: ConditionGradeRow
  busy: boolean
  run: (action: () => Promise<void>) => Promise<void>
}) {
  const [code, setCode] = useState(grade.code)
  const [label, setLabel] = useState(grade.label)
  const [description, setDescription] = useState(grade.description ?? '')
  const dirty = code !== grade.code || label !== grade.label || description !== (grade.description ?? '')

  return (
    <div className="space-y-2 rounded-xl border border-mint/60 dark:border-border p-2.5">
      <div className="grid gap-2 sm:grid-cols-[5rem_1fr]">
        <input aria-label="Grade code" value={code} disabled={busy} onChange={(e) => setCode(e.target.value)} className={INPUT} />
        <input aria-label="Grade label" value={label} disabled={busy} onChange={(e) => setLabel(e.target.value)} className={INPUT} />
      </div>
      <input aria-label="Grade description" value={description} disabled={busy} placeholder="Description"
        onChange={(e) => setDescription(e.target.value)} className={INPUT} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <input type="checkbox" checked={grade.is_active} disabled={busy}
            onChange={(e) => void run(() => updateConditionGrade(grade.id, { is_active: e.target.checked }))} />
          Visible to customers
        </label>
        <div className="ml-auto flex gap-1.5">
          {dirty && (
            <Button type="button" size="sm" disabled={busy || !code.trim() || !label.trim()}
              onClick={() => void run(() => updateConditionGrade(grade.id, {
                code: code.trim(), label: label.trim(), description: description.trim() || null,
              }))}>
              Save
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" disabled={busy}
            className="text-red-500 hover:bg-red-500/8"
            onClick={() => void run(() => deleteConditionGrade(grade.id))}>
            <Trash2 size={13} className="mr-1" /> Remove
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Warranty plans
// ---------------------------------------------------------------------------

/** One plan as edited. */
export type PlanDraft = PlanFields & { id: string }

export function planDraftFrom(row: WarrantyPlanRow): PlanDraft {
  return {
    id: row.id,
    warranty_type: row.warranty_type,
    warranty_duration: row.warranty_duration,
    warranty_months: row.warranty_months,
    warranty_title: row.warranty_title,
    warranty_description: row.warranty_description,
    warranty_covered: row.warranty_covered,
    warranty_excluded: row.warranty_excluded,
  }
}

export function planChanged(draft: PlanDraft, row: WarrantyPlanRow): boolean {
  const stored = planDraftFrom(row)
  return (Object.keys(stored) as (keyof PlanDraft)[]).some((k) =>
    JSON.stringify(draft[k]) !== JSON.stringify(stored[k]))
}

/** An option as edited in the form; months and add-on stay text until saved. */
export interface WarrantyOptionDraft {
  id: string
  months: string
  addOn: string
  isEnabled: boolean
}

export function toDraft(row: WarrantyOptionRow): WarrantyOptionDraft {
  return {
    id: row.id,
    months: String(row.duration_months),
    addOn: String(centsToRupees(row.additional_price_cents)),
    isEnabled: row.is_enabled,
  }
}

/** Validates a draft; returns the database patch, or the reason it cannot be saved. */
export function draftToPatch(draft: WarrantyOptionDraft):
  | { ok: true; patch: { duration_months: number; additional_price_cents: number; is_enabled: boolean } }
  | { ok: false; reason: string } {
  const months = Number(draft.months)
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    return { ok: false, reason: 'Warranty duration must be a whole number of months from 1 to 120.' }
  }
  const addOn = parseAddOnInput(draft.addOn)
  if (!addOn.ok) return { ok: false, reason: `${durationLabel(months)} add-on: ${addOn.reason}` }
  return {
    ok: true,
    patch: { duration_months: months, additional_price_cents: rupeesToCents(addOn.rupees), is_enabled: draft.isEnabled },
  }
}

/** One textarea line per list entry, blank lines dropped. */
function linesToList(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)
}

/**
 * One warranty plan — the product default or a variant's override — with its
 * own type, terms and options.
 */
export function PlanEditor({
  idPrefix, noun, plan, onChange, rows, drafts, setDrafts, disabled, rowBusy,
  onAdd, onSetDefault, onMove, onAskDelete,
}: {
  idPrefix: string
  /** "Warranty" / "Part Warranty" / "Battery Warranty" — what customers see. */
  noun: string
  plan: PlanDraft
  onChange: (next: PlanDraft) => void
  /** This plan's options, as stored. */
  rows: WarrantyOptionRow[]
  /** This plan's options, as edited (display order). */
  drafts: WarrantyOptionDraft[]
  setDrafts: (update: (prev: WarrantyOptionDraft[]) => WarrantyOptionDraft[]) => void
  disabled: boolean
  rowBusy: boolean
  onAdd: (months: number, addOnCents: number) => Promise<boolean>
  onSetDefault: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  onAskDelete: (id: string, label: string) => void
}) {
  const [newMonths, setNewMonths] = useState('')
  const [newAddOn, setNewAddOn] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const patch = <K extends keyof PlanFields>(key: K, value: PlanFields[K]) => onChange({ ...plan, [key]: value })

  async function add() {
    const parsed = draftToPatch({ id: '', months: newMonths, addOn: newAddOn, isEnabled: true })
    if (!parsed.ok) { setAddError(parsed.reason); return }
    setAddError(null)
    const ok = await onAdd(parsed.patch.duration_months, parsed.patch.additional_price_cents)
    if (ok) { setNewMonths(''); setNewAddOn('') }
  }

  return (
    <div className="grid gap-4">
      <SelectField id={`${idPrefix}-wtype`} label="Warranty type" value={plan.warranty_type} disabled={disabled}
        onChange={(v) => patch('warranty_type', v)} options={WARRANTY_TYPE_OPTIONS} />

      {plan.warranty_type === 'none' && (
        <p className="text-[12.5px] text-muted-foreground">Customers see “No warranty is offered with this product.”</p>
      )}

      {plan.warranty_type === 'included' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField id={`${idPrefix}-wdur`} label="Duration" value={plan.warranty_duration ?? ''} disabled={disabled}
            placeholder="1 Year" onChange={(v) => patch('warranty_duration', v || null)} />
          <NumberField id={`${idPrefix}-wmon`} label="Months" min={0} value={plan.warranty_months} disabled={disabled}
            onChange={(v) => patch('warranty_months', v)} />
        </div>
      )}

      {plan.warranty_type === 'optional_paid' && (
        <div>
          <FieldLabel hint="the customer chooses one; add-on is added to the price">Warranty options</FieldLabel>
          <div className="space-y-2">
            {drafts.map((draft, index) => {
              const isDefault = Boolean(rows.find((r) => r.id === draft.id)?.is_default)
              return (
                <div key={draft.id} className="rounded-2xl border border-mint/70 dark:border-border bg-card p-3">
                  <div className="grid grid-cols-[1fr_1.4fr] gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Months</span>
                      <input type="number" min={1} max={120} aria-label="Duration in months" value={draft.months} disabled={disabled}
                        onChange={(e) => setDrafts((p) => p.map((d) => d.id === draft.id ? { ...d, months: e.target.value } : d))}
                        className={INPUT} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Add-on (Rs., 0 = included)</span>
                      <input inputMode="numeric" aria-label="Additional price in rupees" value={draft.addOn} disabled={disabled}
                        onChange={(e) => setDrafts((p) => p.map((d) => d.id === draft.id ? { ...d, addOn: e.target.value } : d))}
                        className={INPUT} />
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <label className="flex items-center gap-1.5 text-[12px] text-foreground">
                      <input type="radio" name={`${idPrefix}-default`} checked={isDefault} disabled={disabled || rowBusy}
                        onChange={() => onSetDefault(draft.id)} />
                      Default
                    </label>
                    <label className="flex items-center gap-1.5 text-[12px] text-foreground">
                      <input type="checkbox" checked={draft.isEnabled} disabled={disabled || isDefault}
                        title={isDefault ? 'The default option is always enabled' : undefined}
                        onChange={(e) => setDrafts((p) => p.map((d) => d.id === draft.id ? { ...d, isEnabled: e.target.checked } : d))} />
                      Enabled
                    </label>
                    <div className="ml-auto flex items-center gap-1">
                      <button type="button" aria-label="Move up" disabled={disabled || rowBusy || index === 0}
                        onClick={() => onMove(draft.id, -1)}
                        className="focus-ring flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-primary-soft disabled:opacity-30">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" aria-label="Move down" disabled={disabled || rowBusy || index === drafts.length - 1}
                        onClick={() => onMove(draft.id, 1)}
                        className="focus-ring flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-primary-soft disabled:opacity-30">
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" aria-label="Delete option" disabled={disabled || rowBusy}
                        onClick={() => onAskDelete(draft.id, `${draft.months}-month option`)}
                        className="focus-ring flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-red-500/8 hover:text-red-500 disabled:opacity-30">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {drafts.length === 0 && (
              <p className="text-[12.5px] text-amber-600 dark:text-amber-400">
                No options yet — customers cannot order this until at least one enabled option is added.
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-[1fr_1.4fr_auto] items-end gap-2">
            <input type="number" min={1} max={120} aria-label="New option months" placeholder="Months" value={newMonths}
              disabled={disabled || rowBusy} onChange={(e) => setNewMonths(e.target.value)} className={INPUT} />
            <input inputMode="numeric" aria-label="New option add-on in rupees" placeholder="Add-on Rs. (0 = included)" value={newAddOn}
              disabled={disabled || rowBusy} onChange={(e) => setNewAddOn(e.target.value)} className={INPUT} />
            <Button type="button" variant="outline" size="sm" disabled={disabled || rowBusy || !newMonths || !newAddOn}
              onClick={() => void add()}>
              {rowBusy ? <LoaderCircle size={14} className="animate-spin" /> : <><Plus size={14} className="mr-1" />Add</>}
            </Button>
          </div>
          {addError && <p className="mt-1.5 text-[12px] text-red-500">{addError}</p>}
        </div>
      )}

      {plan.warranty_type !== 'none' && (
        <>
          <TextField id={`${idPrefix}-wtitle`} label="Warranty title" value={plan.warranty_title ?? ''} disabled={disabled}
            placeholder={`e.g. Apple Expert ${noun}`} onChange={(v) => patch('warranty_title', v || null)} />
          <TextAreaField id={`${idPrefix}-wdesc`} label="Warranty description" rows={3} value={plan.warranty_description ?? ''} disabled={disabled}
            onChange={(v) => patch('warranty_description', v || null)} />
          <ListField id={`${idPrefix}-wcov`} label="Covered" value={plan.warranty_covered} disabled={disabled}
            onChange={(v) => patch('warranty_covered', v)} />
          <ListField id={`${idPrefix}-wexc`} label="Not covered" value={plan.warranty_excluded} disabled={disabled}
            onChange={(v) => patch('warranty_excluded', v)} />
        </>
      )}
    </div>
  )
}

/**
 * A list edited as one entry per line. The raw text is held locally so blank
 * lines can be typed; the list sent to the form drops them.
 */
function ListField({
  id, label, value, onChange, disabled,
}: {
  id: string
  label: string
  value: string[]
  onChange: (v: string[]) => void
  disabled: boolean
}) {
  const [text, setText] = useState(value.join('\n'))
  return (
    <label htmlFor={id} className="block">
      <FieldLabel hint="one per line">{label}</FieldLabel>
      <textarea id={id} rows={3} value={text} disabled={disabled}
        onChange={(e) => { setText(e.target.value); onChange(linesToList(e.target.value)) }}
        className="focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground focus:outline-none focus:border-primary/45 disabled:opacity-60 resize-y" />
    </label>
  )
}
