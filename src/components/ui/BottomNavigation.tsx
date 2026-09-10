"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Grid, Search, ShoppingBag, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '@/context/CartContext'

export function BottomNavigation() {
  const pathname = usePathname()
  const { cartCount } = useCart()

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Shop', href: '/categories', icon: Grid },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Cart', href: '/cart', icon: ShoppingBag, badge: cartCount },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  return (
    <div
      className="fixed left-3 right-3 z-50 mx-auto w-auto max-w-[456px] rounded-[30px] border border-white/60 dark:border-white/8 bg-glass shadow-nav"
      style={{ bottom: 'calc(var(--nav-gap) + env(safe-area-inset-bottom))' }}
    >
      <nav className="flex items-center justify-between px-2" style={{ height: 'var(--nav-h)' }}>
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
                "relative flex flex-1 flex-col items-center justify-center gap-[3px] h-full min-w-0 rounded-3xl touch-manipulation transition-colors duration-200 active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative flex items-center justify-center h-9 w-9">
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-gradient-cta shadow-glow"
                  />
                )}
                <Icon
                  size={21}
                  strokeWidth={isActive ? 2.4 : 2}
                  className={cn("relative transition-colors", isActive && "text-white")}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center border border-card shadow-sm">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-none font-medium tracking-tight truncate max-w-full px-0.5",
                  isActive && "text-primary font-semibold"
                )}
              >
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
