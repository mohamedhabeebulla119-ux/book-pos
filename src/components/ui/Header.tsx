"use client"

import Link from 'next/link'
import { Search, ShoppingBag } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { homeFor } from '@/lib/customer/access'
import { VipBadge } from '@/components/account/VipBadge'

export function Header() {
  const { cartCount } = useCart()
  // The logo leads to this account's own storefront, never the other one's.
  const { access, isWholesaleVip } = useCustomerAuth()

  return (
    <header className="sticky top-0 z-40 bg-glass border-b border-mint/70 dark:border-border">
      <div className="flex items-center justify-between h-16 px-4 sm:px-5 max-w-md mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <Link href={homeFor(access)} className="flex items-center min-w-0">
            <div className="bg-white rounded-2xl px-3 py-1.5 shadow-card border border-mint/60 flex items-center justify-center transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]">
              <img
                src="/logo.jpg"
                alt="Apple EXPERT Logo"
                className="h-9 sm:h-10 w-auto object-contain"
              />
            </div>
          </Link>
          {/* Database-confirmed Wholesale VIP only (profiles.customer_type). */}
          {isWholesaleVip && <VipBadge size="sm" collapse className="shrink-0" />}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/search"
            aria-label="Search"
            className="flex items-center justify-center w-11 h-11 rounded-full bg-card/70 border border-mint/70 dark:border-border text-primary shadow-card hover:bg-primary-soft active:scale-90 transition-all duration-300"
          >
            <Search size={20} strokeWidth={2.2} />
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative flex items-center justify-center w-11 h-11 rounded-full bg-card/70 border border-mint/70 dark:border-border text-primary shadow-card hover:bg-primary-soft active:scale-90 transition-all duration-300"
          >
            <ShoppingBag size={20} strokeWidth={2.2} />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-gradient-cta text-white text-[10px] font-bold h-5 min-w-5 px-1 rounded-full flex items-center justify-center border-2 border-background shadow-glow">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
