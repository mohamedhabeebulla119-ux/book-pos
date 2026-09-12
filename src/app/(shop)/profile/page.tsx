"use client"

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/context/ThemeContext'
import { useWishlist } from '@/context/WishlistContext'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { CUSTOMER_TYPE_LABEL } from '@/lib/customer/profile'
import { clearExperience } from '@/utils/experience'
import {
  Moon, Sun, ChevronRight, Package, CreditCard, Settings, HelpCircle, LogOut, Heart,
  Crown, User, LogIn, Store, Repeat, LoaderCircle,
} from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { wishlist } = useWishlist()
  // Identity comes from the Supabase session and the customer's own profile row
  // under "profiles read own" — never from a constant in this file.
  const { status, email, profile, customerType, vipExpired, signOut } = useCustomerAuth()

  const signedIn = status === 'signed-in'
  const displayName = profile?.full_name?.trim() || 'Your account'
  const displayEmail = profile?.email || email

  /** Returns to the entry screen so the customer can pick the other experience. */
  function switchExperience() {
    clearExperience()
    router.push('/welcome')
  }

  const CHIP = 'bg-well-strong border border-mint-deep text-primary'

  const menuItems = [
    { icon: Package, label: 'My Orders', description: 'View and track your orders', chip: CHIP },
    { icon: Heart, label: 'Wishlist', description: `${wishlist.length} saved item${wishlist.length === 1 ? '' : 's'}`, chip: CHIP, href: '/wishlist' },
    { icon: CreditCard, label: 'Payment Methods', description: 'Manage your saved cards', chip: CHIP },
    { icon: Settings, label: 'Account Settings', description: 'Personal details and security', chip: CHIP },
    { icon: HelpCircle, label: 'Help & Support', description: 'FAQ and contact information', chip: CHIP },
    {
      icon: Store,
      label: 'Wholesale',
      description: customerType === 'wholesale_vip'
        ? 'Wholesale pricing is active'
        : 'Apply for business pricing',
      chip: CHIP,
      href: '/wholesale',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <Header />

      <main className="px-4 py-6">
        {/* Profile Header */}
        {status === 'loading' ? (
          <div className="flex items-center justify-center gap-2.5 mb-6 bg-surface border border-mint/80 dark:border-border rounded-[26px] p-6 shadow-card text-sm text-muted-foreground">
            <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" /> Loading your account…
          </div>
        ) : signedIn ? (
          <div className="mb-6 bg-surface border border-mint/80 dark:border-border rounded-[26px] p-4 shadow-card">
            <div className="flex items-center gap-4">
              <Avatar name={displayName} size={62} />
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight truncate">{displayName}</h1>
                {displayEmail && (
                  <p className="text-muted-foreground text-[13px] truncate">{displayEmail}</p>
                )}
              </div>
            </div>
            {/* The tier the DATABASE resolved, not the experience chosen on the
                entry screen. An expired VIP grant is shown as retail, because
                that is what the customer is actually charged. */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                customerType === 'wholesale_vip'
                  ? 'border-mint-deep bg-primary-soft text-primary'
                  : 'border-border bg-muted text-muted-foreground'
              }`}>
                {customerType === 'wholesale_vip' ? <Crown size={12} /> : <User size={12} />}
                {CUSTOMER_TYPE_LABEL[customerType]}
              </span>
              {vipExpired && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  Wholesale pricing expired
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-6 bg-surface border border-mint/80 dark:border-border rounded-[26px] p-5 shadow-card text-center">
            <span className="mx-auto mb-3.5 flex h-13 w-13 items-center justify-center rounded-full bg-well-strong border border-mint-deep text-primary">
              <LogIn size={23} strokeWidth={1.8} />
            </span>
            <h1 className="text-lg font-bold tracking-tight mb-1.5">You are browsing as a guest</h1>
            <p className="mx-auto mb-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              Sign in to see your orders and the pricing set for your account.
            </p>
            <div className="flex flex-col gap-2.5">
              <Link href="/account/sign-in"><Button fullWidth>Sign in</Button></Link>
              <Link href="/account/sign-up"><Button fullWidth variant="secondary">Create an account</Button></Link>
            </div>
          </div>
        )}

        {/* Theme Toggle */}
        <div className="bg-surface rounded-[26px] border border-mint/80 dark:border-border p-4 mb-4 flex items-center justify-between shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-well-strong border border-mint-deep flex items-center justify-center text-primary">
              {theme === 'dark' ? <Moon size={19} /> : <Sun size={19} />}
            </div>
            <div>
              <div className="font-semibold text-sm">Appearance</div>
              <div className="text-xs text-muted-foreground">
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </div>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            aria-pressed={theme === 'dark'}
            className={`w-13 h-7 rounded-full transition-all duration-300 relative flex items-center px-1 ${theme === 'dark' ? 'bg-gradient-cta shadow-glow' : 'bg-mint-deep'}`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Menu Items */}
        <div className="bg-surface rounded-[26px] border border-mint/80 dark:border-border overflow-hidden shadow-card mb-4">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const rowClassName = `w-full flex items-center justify-between p-4 text-left hover:bg-primary-soft/60 active:bg-primary-soft transition-colors min-h-[44px] ${
              index !== menuItems.length - 1 ? 'border-b border-mint/70 dark:border-border' : ''
            }`
            const content = (
              <>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.chip}`}>
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted-foreground/50 shrink-0" />
              </>
            )

            return item.href ? (
              <Link key={item.label} href={item.href} className={rowClassName}>
                {content}
              </Link>
            ) : (
              <button key={item.label} className={rowClassName}>
                {content}
              </button>
            )
          })}
        </div>

        {/* Switch experience — clears only the local preference. It has never
            had any bearing on the customer's tier, so nothing about pricing
            changes here. */}
        <button
          onClick={switchExperience}
          className="w-full flex items-center justify-center gap-2 p-4 mb-4 font-semibold text-primary bg-primary-soft border border-mint-deep hover:bg-mint active:scale-[0.98] rounded-[26px] transition-all duration-300 min-h-[44px]"
        >
          <Repeat size={19} />
          Switch shopping experience
        </button>

        {/* Sign out */}
        {signedIn && (
          <button
            onClick={() => void signOut()}
            className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-semibold bg-red-500/8 border border-red-500/20 hover:bg-red-500/15 active:scale-[0.98] rounded-[26px] transition-all duration-300 min-h-[44px]"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        )}
      </main>
    </div>
  )
}
