"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Grid, Search, ShoppingBag, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '@/context/CartContext'
import { BOTTOM_NAV_HEIGHT } from './navConstants'

export function BottomNavigation() {
  const pathname = usePathname()
  const { cartCount } = useCart()

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Categories', href: '/categories', icon: Grid },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Cart', href: '/cart', icon: ShoppingBag, badge: cartCount },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-xl border-t border-x border-border/70 rounded-t-[28px] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.35)]">
      <nav className="flex items-center w-full max-w-[480px] mx-auto" style={{ height: BOTTOM_NAV_HEIGHT }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-label={item.name}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center w-1/5 h-full space-y-[2px] transition-colors duration-200 min-h-[44px] min-w-[44px] touch-manipulation active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative flex items-center justify-center h-8 w-8 mb-1">
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/20 to-sky-400/20 shadow-[0_0_16px_rgba(124,92,255,0.3)]"
                  />
                )}
                <Icon size={26} strokeWidth={isActive ? 2.5 : 2} className={cn("relative", isActive && "text-primary")} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[11px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center border border-background shadow-sm">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={cn("text-[11px] sm:text-[12px] font-medium tracking-tight", isActive ? "text-primary font-semibold" : "")}>{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
