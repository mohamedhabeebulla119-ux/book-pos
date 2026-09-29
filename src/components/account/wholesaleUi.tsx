import type { Crown } from 'lucide-react'

/** Shared chrome for the wholesale storefront and the wholesale-access request page. */

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 shadow-card">
      {children}
    </div>
  )
}

export function Chip({ icon: Icon, tone }: { icon: typeof Crown; tone: 'primary' | 'amber' | 'muted' }) {
  const classes =
    tone === 'primary' ? 'border-mint-deep bg-well-strong text-primary'
    : tone === 'amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
    : 'border-border bg-muted text-muted-foreground'
  return (
    <span className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full border ${classes}`}>
      <Icon size={25} strokeWidth={1.8} />
    </span>
  )
}
