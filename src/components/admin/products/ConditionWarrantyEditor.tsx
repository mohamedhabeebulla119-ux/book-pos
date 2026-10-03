"use client"

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, Settings2, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { ProductPatch } from '@/lib/admin/products'
import {
  CONDITION_OPTIONS, WARRANTY_TYPE_OPTIONS, parseAddOnInput,
  createConditionGrade, updateConditionGrade, deleteConditionGrade,
  type ConditionGradeRow, type WarrantyOptionRow,
} from '@/lib/admin/warranty'
import { rupeesToCents, centsToRupees } from '@/lib/admin/pricing'
import { warrantyNoun, durationLabel } from '@/lib/catalog'
import { describeAdminError } from '@/lib/admin/errors'
import {
  TextField, NumberField, TextAreaField, SelectField, EditorSection, FieldLabel,
} from './fields'

/**
 * The Condition and Warranty sections of the product editor.
 *
 * Scalar fields (condition, pre-owned details, warranty type and terms) are
 * part of the product form and saved with "Save changes". Warranty OPTIONS are
 * rows of their own: edits to an option's duration, add-on or enabled flag are
 * saved with "Save changes" too, while add / delete / default / reorder are
 * written immediately — the same split the editor already uses for variants.
 */

type Patch = <K extends keyof ProductPatch>(key: K, value: ProductPatch[K]) => void

const INPUT = 'focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/45 disabled:opacity-60'

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

// ---------------------------------------------------------------------------
// Condition
// ---------------------------------------------------------------------------

export function ConditionEditor({
  form, patchForm, grades, gradesError, disabled, canEdit, onGradesChanged,
}: {
  form: ProductPatch
  patchForm: Patch
  grades: ConditionGradeRow[]
  gradesError: string | null
  disabled: boolean
  canEdit: boolean
  onGradesChanged: () => Promise<void>
}) {
  const [managing, setManaging] = useState(false)
  // Keep an unexpected stored value selectable rather than silently replacing it.
  const options: { value: string; label: string }[] = [...CONDITION_OPTIONS]
  if (!options.some((o) => o.value === form.condition)) options.push({ value: form.condition, label: form.condition })

  return (
    <EditorSection title="Condition"
      description="Condition is separate from category: a Pre-Owned iPhone stays in iPhone. Customers see it as a badge on the card and product page.">
      <div className="grid gap-4">
        <SelectField id="p-cond" label="Condition" value={form.condition} disabled={disabled}
          onChange={(v) => patchForm('condition', v)} options={options} />

        {form.condition === 'pre_owned' && (
          <>
            <div>
              <SelectField id="p-grade" label="Condition grade" value={form.condition_grade_id ?? ''} disabled={disabled}
                allowEmpty onChange={(v) => patchForm('condition_grade_id', v || null)}
                hint={grades.length === 0 ? 'no grades defined yet' : undefined}
                options={grades.map((g) => ({ value: g.id, label: g.is_active ? `${g.code} — ${g.label}` : `${g.code} — ${g.label} (hidden)` }))} />
              {gradesError && <p className="mt-1.5 text-[12px] text-red-500">{gradesError}</p>}
              {canEdit && (
                <button type="button" onClick={() => setManaging((m) => !m)}
                  className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-full text-[12.5px] font-semibold text-primary">
                  <Settings2 size={13} /> {managing ? 'Close grade list' : 'Manage grades'}
                </button>
              )}
              {managing && <GradesManager grades={grades} onChanged={onGradesChanged} />}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <NumberField id="p-batt" label="Battery health" hint="%, 0–100" min={0} value={form.battery_health} disabled={disabled}
                onChange={(v) => patchForm('battery_health', v)} />
              <NumberField id="p-cycles" label="Cycle count" min={0} value={form.cycle_count} disabled={disabled}
                onChange={(v) => patchForm('cycle_count', v)} />
            </div>
            <TextField id="p-phys" label="Physical condition" value={form.physical_condition ?? ''} disabled={disabled}
              placeholder="e.g. Light scratches on the back glass"
              onChange={(v) => patchForm('physical_condition', v || null)} />
            <TextField id="p-acc" label="Accessories included" value={form.accessories_included ?? ''} disabled={disabled}
              placeholder="e.g. Original box, USB-C cable"
              onChange={(v) => patchForm('accessories_included', v || null)} />
            <TextAreaField id="p-notes" label="Device notes" rows={3} value={form.device_notes ?? ''} disabled={disabled}
              onChange={(v) => patchForm('device_notes', v || null)} />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Upload photos of this actual unit in the Images section below — front, back, sides, camera,
              battery health screen and any marks.
            </p>
          </>
        )}
      </div>
    </EditorSection>
  )
}

/** The admin-defined grading scale. Nothing is seeded: the business defines it. */
function GradesManager({ grades, onChanged }: { grades: ConditionGradeRow[]; onChanged: () => Promise<void> }) {
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
        Grades apply to every pre-owned product. Removing one leaves the products that used it ungraded.
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
// Warranty
// ---------------------------------------------------------------------------

export function WarrantyEditor({
  form, patchForm, subcategory, rows, drafts, setDrafts, optionsError, disabled, rowBusy,
  onAdd, onSetDefault, onMove, onAskDelete,
}: {
  form: ProductPatch
  patchForm: Patch
  subcategory: string
  rows: WarrantyOptionRow[]
  drafts: WarrantyOptionDraft[]
  setDrafts: (update: (prev: WarrantyOptionDraft[]) => WarrantyOptionDraft[]) => void
  optionsError: string | null
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
  const noun = warrantyNoun({ subcategory: subcategory as never })

  async function add() {
    const parsed = draftToPatch({ id: '', months: newMonths, addOn: newAddOn, isEnabled: true })
    if (!parsed.ok) { setAddError(parsed.reason); return }
    setAddError(null)
    const ok = await onAdd(parsed.patch.duration_months, parsed.patch.additional_price_cents)
    if (ok) { setNewMonths(''); setNewAddOn('') }
  }

  return (
    <EditorSection title="Warranty"
      description={`One warranty system for every product. Customers see this as “${noun}”${noun === 'Warranty' ? '' : ' (from the subcategory)'}.`}>
      <div className="grid gap-4">
        <SelectField id="p-wtype" label="Warranty type" value={form.warranty_type} disabled={disabled}
          onChange={(v) => patchForm('warranty_type', v)} options={WARRANTY_TYPE_OPTIONS} />

        {form.warranty_type === 'none' && (
          <p className="text-[12.5px] text-muted-foreground">Customers see “No warranty is offered with this product.”</p>
        )}

        {form.warranty_type === 'included' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField id="p-wdur" label="Duration" value={form.warranty_duration ?? ''} disabled={disabled}
              placeholder="1 Year" onChange={(v) => patchForm('warranty_duration', v || null)} />
            <NumberField id="p-wmon" label="Months" min={0} value={form.warranty_months} disabled={disabled}
              onChange={(v) => patchForm('warranty_months', v)} />
          </div>
        )}

        {form.warranty_type === 'optional_paid' && (
          <div>
            <FieldLabel hint="the customer chooses one; add-on is added to the product price">Warranty options</FieldLabel>
            {optionsError && <p className="mb-2 text-[12px] text-red-500">{optionsError}</p>}
            <div className="space-y-2">
              {drafts.map((draft, index) => {
                const row = rows.find((r) => r.id === draft.id)
                const isDefault = Boolean(row?.is_default)
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
                        <input type="radio" name="warranty-default" checked={isDefault} disabled={disabled || rowBusy}
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
                  No options yet — customers cannot choose a warranty until at least one is added.
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

        {form.warranty_type !== 'none' && (
          <>
            <TextField id="p-wtitle" label="Warranty title" value={form.warranty_title ?? ''} disabled={disabled}
              placeholder={`e.g. Apple Expert ${noun}`} onChange={(v) => patchForm('warranty_title', v || null)} />
            <TextAreaField id="p-wdesc" label="Warranty description" rows={3} value={form.warranty_description ?? ''} disabled={disabled}
              onChange={(v) => patchForm('warranty_description', v || null)} />
            <ListField id="p-wcov" label="Covered" value={form.warranty_covered} disabled={disabled}
              onChange={(v) => patchForm('warranty_covered', v)} />
            <ListField id="p-wexc" label="Not covered" value={form.warranty_excluded} disabled={disabled}
              onChange={(v) => patchForm('warranty_excluded', v)} />
          </>
        )}
      </div>
    </EditorSection>
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
