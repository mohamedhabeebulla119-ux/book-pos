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

  const menuItems = [
    { icon: Package, label: 'My Orders', description: 'View and track your orders', chip: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300' },
    { icon: Heart, label: 'Wishlist', description: `${wishlist.length} saved item${wishlist.length === 1 ? '' : 's'}`, chip: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', href: '/wishlist' },
    { icon: CreditCard, label: 'Payment Methods', description: 'Manage your saved cards', chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { icon: Settings, label: 'Account Settings', description: 'Personal details and security', chip: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300' },
    { icon: HelpCircle, label: 'Help & Support', description: 'FAQ and contact information', chip: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
  ]

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <Header />

      <main className="px-4 py-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-10">
          <Avatar name={PROFILE_NAME} size={64} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{PROFILE_NAME}</h1>
            <p className="text-muted-foreground text-sm">{PROFILE_EMAIL}</p>
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-6 flex items-center justify-between shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground">
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
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
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${theme === 'dark' ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          >
            <div 
              className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} 
            />
          </button>
        </div>

        {/* Menu Items */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card mb-6">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const rowClassName = `w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 active:bg-muted transition-colors min-h-[44px] ${
              index !== menuItems.length - 1 ? 'border-b border-border' : ''
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
        <button className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-semibold bg-red-500/10 hover:bg-red-500/20 active:scale-[0.98] rounded-2xl transition-all min-h-[44px]">
          <LogOut size={20} />
          Sign Out
        </button>
      </main>
    </div>
  )
}
