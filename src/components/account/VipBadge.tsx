import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The one Apple Expert VIP identity mark, reused by the header, profile,
 * wholesale home, cart and admin so every surface shows the same badge.
 *
 * PURELY PRESENTATIONAL. Rendering this grants nothing and decides nothing:
 * callers must only render it when the authoritative tier says so — on the
 * storefront `useCustomerAuth().isWholesaleVip` (session + the customer's own
 * profiles.customer_type), in the admin panel the row's own customer_type.
 */
export function VipBadge({
  label = 'VIP Customer',
  size = 'md',
  collapse = false,
  className,
}: {
  label?: string
  size?: 'sm' | 'md'
  /** Narrow phones show only "VIP", so the header never crowds its buttons. */
  collapse?: boolean
  className?: string
}) {
  const sm = size === 'sm'
  const [first, ...rest] = label.split(' ')

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-mint-deep bg-primary-soft font-semibold text-primary whitespace-nowrap shadow-card',
        sm ? 'gap-1 py-0.5 pl-0.5 pr-2 text-[10.5px]' : 'gap-1.5 py-0.5 pl-0.5 pr-2.5 text-[11px]',
        className,
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-gradient-cta text-white',
          sm ? 'h-4 w-4' : 'h-5 w-5',
        )}
        aria-hidden="true"
      >
        <Crown size={sm ? 9 : 11} strokeWidth={2.4} />
      </span>
      {collapse && rest.length > 0 ? (
        <span>
          {first}
          <span className="hidden min-[380px]:inline"> {rest.join(' ')}</span>
        </span>
      ) : (
        label
      )}
    </span>
  )
}

/**
 * "VIP Price" beside a price. Only for a price that actually came from the
 * customer's wholesale_vip row in my_effective_prices (Product.isVipPrice) —
 * a VIP shown the retail fallback for an item with no VIP price is not told
 * it is a VIP price.
 */
export function VipPriceTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary whitespace-nowrap',
        className,
      )}
    >
      <Crown size={10} strokeWidth={2.4} aria-hidden="true" />
      VIP Price
    </span>
  )
}
