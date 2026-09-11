import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminPageHeading({
  title,
  subtitle,
  className,
}: {
  title: string
  subtitle?: string
  className?: string
}) {
  return (
    <div className={cn('mb-6', className)}>
      <h1 className="text-[26px] sm:text-[32px] font-bold tracking-tight leading-tight text-foreground text-balance">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>
      )}
    </div>
  )
}

/**
 * Dashboard statistic tile.
 *
 * `value` is intentionally a string so this phase can render a placeholder
 * em-dash. No fabricated figures: nothing here is wired to the database yet,
 * and the tile says so rather than inventing a number.
 */
export function StatCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string
  value: string
  note: string
  icon: LucideIcon
}) {
  return (
    <div className="bg-surface border border-mint/80 dark:border-border rounded-[22px] p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft border border-mint-deep text-primary"
          aria-hidden="true"
        >
          <Icon size={17} strokeWidth={2} />
        </span>
      </div>
      <div className="mt-3 text-[30px] font-bold tracking-tight text-foreground tabular-nums leading-none">
        {value}
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground leading-snug">{note}</p>
    </div>
  )
}

/** Placeholder body for the sections that arrive in later steps. */
export function AdminPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-14 text-center">
      <span
        className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-well-strong border border-mint-deep text-primary"
        aria-hidden="true"
      >
        <Icon size={24} strokeWidth={1.8} />
      </span>
      <h2 className="text-lg font-bold tracking-tight text-foreground mb-2">{title}</h2>
      <p className="mx-auto max-w-md text-sm text-muted-foreground leading-relaxed">{description}</p>
      <p className="mt-5 inline-flex items-center rounded-full border border-mint-deep bg-primary-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
        Coming in a later step
      </p>
    </div>
  )
}
