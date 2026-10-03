"use client"

import { Crown, CalendarDays } from 'lucide-react'
import { Header } from '@/components/ui/Header'
import { formatDate } from '@/components/account/wholesaleUi'
import { VipBadge } from '@/components/account/VipBadge'
import { HomeProductSections } from '@/components/home/HomeProductSections'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { PromoBanners, StoreClosedNotice } from '@/components/ui/PromoBanners'

/**
 * The Wholesale storefront home.
 *
 * CustomerRouteGuard renders this page only for an account the database
 * resolves as wholesale_vip (profiles.customer_type, with an unexpired grant);
 * everyone else is redirected before it renders. Retail accounts apply for
 * access at /account/wholesale-request instead.
 *
 * There is no separate wholesale catalog. A Wholesale VIP shops the same
 * catalog; my_effective_prices returns their VIP rows, which RLS physically
 * withholds from every other caller.
 */
export default function WholesalePage() {
  const { profile, isWholesaleVip } = useCustomerAuth()
  const firstName = profile?.full_name?.trim().split(/\s+/)[0]

  return (
    <div className="flex min-h-screen flex-col pb-10">
      <Header />
      <StoreClosedNotice />

      {/* Welcome + VIP identity */}
      <section className="px-4 pt-6">
        <div className="max-w-4xl mx-auto">
          {isWholesaleVip && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-medium text-muted-foreground">
                Welcome back{firstName ? `, ${firstName}` : ''}
              </p>
              <VipBadge />
            </div>
          )}
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">Wholesale</h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
            Business purchasing, bulk orders and wholesale pricing.
          </p>

          {/* Compact VIP status — the database resolves every price; this only says so. */}
          {isWholesaleVip && (
            <div className="mt-4 flex items-start gap-3 rounded-[22px] border border-mint/80 dark:border-border bg-surface px-4 py-3 shadow-card">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-cta text-white shadow-glow" aria-hidden="true">
                <Crown size={16} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold tracking-tight text-foreground">Wholesale VIP Active</p>
                <p className="text-[12.5px] leading-snug text-muted-foreground">
                  VIP pricing is automatically applied to eligible products.
                </p>
                {profile?.vip_expires_at && (
                  <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <CalendarDays size={12} className="shrink-0" />
                    Active until {formatDate(profile.vip_expires_at)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Wholesale-only promotions (slot 'wholesale'), managed in /admin/settings. */}
      <PromoBanners slot="wholesale" />

      <HomeProductSections />
    </div>
  )
}
