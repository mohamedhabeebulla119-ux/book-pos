"use client"

import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Avatar } from '@/components/ui/Avatar'
import { useTheme } from '@/context/ThemeContext'
import { useWishlist } from '@/context/WishlistContext'
import { Moon, Sun, ChevronRight, Package, CreditCard, Settings, HelpCircle, LogOut, Heart } from 'lucide-react'

const PROFILE_NAME = 'John Doe'
const PROFILE_EMAIL = 'john.doe@example.com'

export default function ProfilePage() {
  const { theme, toggleTheme } = useTheme()
  const { wishlist } = useWishlist()

  const CHIP = 'bg-well-strong border border-mint-deep text-primary'

  const menuItems = [
    { icon: Package, label: 'My Orders', description: 'View and track your orders', chip: CHIP },
    { icon: Heart, label: 'Wishlist', description: `${wishlist.length} saved item${wishlist.length === 1 ? '' : 's'}`, chip: CHIP, href: '/wishlist' },
    { icon: CreditCard, label: 'Payment Methods', description: 'Manage your saved cards', chip: CHIP },
    { icon: Settings, label: 'Account Settings', description: 'Personal details and security', chip: CHIP },
    { icon: HelpCircle, label: 'Help & Support', description: 'FAQ and contact information', chip: CHIP },
  ]

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <Header />

      <main className="px-4 py-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-6 bg-surface border border-mint/80 dark:border-border rounded-[26px] p-4 shadow-card">
          <Avatar name={PROFILE_NAME} size={62} />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">{PROFILE_NAME}</h1>
            <p className="text-muted-foreground text-[13px] truncate">{PROFILE_EMAIL}</p>
          </div>
        </div>

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

        {/* Logout */}
        <button className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-semibold bg-red-500/8 border border-red-500/20 hover:bg-red-500/15 active:scale-[0.98] rounded-[26px] transition-all duration-300 min-h-[44px]">
          <LogOut size={20} />
          Sign Out
        </button>
      </main>
    </div>
  )
}
