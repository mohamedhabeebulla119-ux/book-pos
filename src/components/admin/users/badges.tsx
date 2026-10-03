import { Crown, User, KeyRound, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VipBadge } from '@/components/account/VipBadge'
import type { VipStatus } from '@/lib/admin/customers'
import { ACCOUNT_ROLE_LABEL, type AccountRole } from '@/lib/admin/users'

const PILL = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap'

/**
 * Pricing tier as the database will actually resolve it.
 *
 * `vip_expired` is shown distinctly rather than as an active VIP, because
 * private.current_customer_type() already prices an expired grant at retail —
 * a badge saying "Wholesale VIP" there would contradict the till.
 */
export function CustomerTypeBadge({ status }: { status: VipStatus }) {
  if (status === 'vip') return <VipBadge label="Wholesale VIP" />
  if (status === 'vip_expired') {
    return (
      <span className={cn(PILL, 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400')}>
        <Crown size={12} /> VIP expired
      </span>
    )
  }
  return (
    <span className={cn(PILL, 'border-border bg-muted text-muted-foreground')}>
      <User size={12} /> Retail
    </span>
  )
}

/**
 * Account role.
 *
 * `known` is false when row-level security did not return other people's
 * grants, in which case the badge says so instead of claiming the user is a
 * plain customer — the one thing it must never do is state a role it cannot see.
 */
export function RoleBadge({ role, known = true }: { role: AccountRole; known?: boolean }) {
  if (!known) {
    return (
      <span className={cn(PILL, 'border-border bg-muted text-muted-foreground')} title="Only an owner can see role grants.">
        <ShieldQuestion size={12} /> Not visible
      </span>
    )
  }

  if (role === 'customer') {
    return (
      <span className={cn(PILL, 'border-border bg-muted text-muted-foreground')}>
        <User size={12} /> Customer
      </span>
    )
  }

  const tone = role === 'owner'
    ? 'border-mint-deep bg-primary-soft text-primary'
    : role === 'admin'
      ? 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400'
      : 'border-border bg-muted text-foreground'

  return (
    <span className={cn(PILL, tone)}>
      {role === 'owner' ? <ShieldCheck size={12} /> : <KeyRound size={12} />}
      {ACCOUNT_ROLE_LABEL[role]}
    </span>
  )
}
