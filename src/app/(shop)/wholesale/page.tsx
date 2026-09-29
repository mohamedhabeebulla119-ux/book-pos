"use client"

import Link from 'next/link'
import { Store, Crown, ShieldCheck, ArrowRight, CalendarDays } from 'lucide-react'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { Panel, Chip, formatDate } from '@/components/account/wholesaleUi'
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
  const { profile } = useCustomerAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <StoreClosedNotice />
      {/* Wholesale-only promotions (slot 'wholesale'), managed in /admin/settings. */}
      <PromoBanners slot="wholesale" />

      <main className="px-4 py-6">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-mint-deep bg-mint text-primary-strong shadow-card">
            <Store size={26} strokeWidth={1.9} />
          </span>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground text-balance">
            Wholesale
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground text-balance">
            Business purchasing, bulk orders and wholesale pricing.
          </p>
        </div>

        <div className="space-y-4">
          <Panel>
            <Chip icon={Crown} tone="primary" />
            <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground">
              Wholesale access is active
            </h2>
            <p className="mb-1.5 text-sm leading-relaxed text-muted-foreground">
              {profile?.full_name ? `${profile.full_name}, your` : 'Your'} account is on Wholesale
              VIP pricing. Wholesale prices are already applied throughout the store — you will
              see them on every product that has one, and the retail price everywhere else.
            </p>
            {profile?.vip_expires_at && (
              <p className="mt-3 flex items-center gap-2 rounded-xl border border-mint/70 dark:border-border bg-card px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
                <CalendarDays size={13} className="shrink-0" />
                Your wholesale pricing runs until {formatDate(profile.vip_expires_at)}.
              </p>
            )}
            <Link href="/categories" className="mt-5 block">
              <Button fullWidth size="lg">
                Start shopping
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
          </Panel>
          <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" />
            Wholesale prices are resolved by the database for your account. They are never
            calculated on this device.
          </p>
        </div>
      </main>
    </div>
  )
}
