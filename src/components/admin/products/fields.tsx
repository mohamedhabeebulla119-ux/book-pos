"use client"

import { cn } from '@/lib/utils'

const CONTROL =
  'focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline gap-2">
      <span className="text-[13px] font-semibold text-foreground">{children}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </span>
  )
}

export function TextField({
  label, value, onChange, disabled, hint, placeholder, id,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  hint?: string
  placeholder?: string
  id: string
}) {
  return (
    <label htmlFor={id} className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        id={id}
        type="text"
        className={CONTROL}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function NumberField({
  label, value, onChange, disabled, hint, id, min,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  disabled?: boolean
  hint?: string
  id: string
  min?: number
}) {
  return (
    <label htmlFor={id} className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        id={id}
        type="number"
        min={min}
        className={cn(CONTROL, 'tabular-nums')}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </label>
  )
}

export function TextAreaField({
  label, value, onChange, disabled, rows = 4, id,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  rows?: number
  id: string
}) {
  return (
    <label htmlFor={id} className="block">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        id={id}
        rows={rows}
        className={cn(CONTROL, 'leading-relaxed resize-y')}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function SelectField({
  label, value, onChange, options, disabled, hint, id, allowEmpty,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly { value: string; label: string }[]
  disabled?: boolean
  hint?: string
  id: string
  allowEmpty?: boolean
}) {
  return (
    <label htmlFor={id} className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <select
        id={id}
        className={CONTROL}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

/** Read-only value, used for identifiers that must never be edited. */
export function LockedField({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="w-full rounded-xl border border-dashed border-mint-deep dark:border-border bg-muted px-3 py-2.5 font-mono text-[13px] text-muted-foreground break-all">
        {value}
      </div>
    </div>
  )
}

export function CheckboxField({
  label, checked, onChange, disabled, id, hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  id: string
  hint?: string
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer select-none">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="focus-ring mt-0.5 h-4 w-4 shrink-0 rounded border-mint-deep accent-[var(--primary)] disabled:opacity-60"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-foreground leading-tight">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">{hint}</span>}
      </span>
    </label>
  )
}

export function EditorSection({
  title, description, children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-surface border border-mint/80 dark:border-border rounded-[22px] shadow-card p-5">
      <h3 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 mb-4 text-[12.5px] text-muted-foreground leading-relaxed">{description}</p>
      )}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </section>
  )
}
