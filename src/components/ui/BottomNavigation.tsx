"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Grid, Search, ShoppingBag, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '@/context/CartContext'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { homeFor } from '@/lib/customer/access'

/** Movement required before the bar changes state, so a jittery finger or a
 *  rubber-band bounce doesn't toggle it. */
const SCROLL_THRESHOLD = 14
/** Near the top the bar is always full size, whatever the last direction was. */
const TOP_ZONE = 24

/**
 * True while the user is scrolling down. Reads scroll position inside a single
 * rAF frame and only calls setState when the answer actually flips, so a long
 * scroll costs no React re-renders at all.
 */
function useScrollingDown(): boolean {
  const [down, setDown] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false

    const measure = () => {
      ticking = false
      const y = window.scrollY
      if (y <= TOP_ZONE) {
        lastY = y
        setDown(false)
        return
      }
      const delta = y - lastY
      // Below the threshold the anchor is left alone, so small movements
      // accumulate instead of being discarded.
      if (Math.abs(delta) < SCROLL_THRESHOLD) return
      lastY = y
      setDown(delta > 0)
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(measure)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return down
}

export function BottomNavigation() {
  const pathname = usePathname()
  const { cartCount } = useCart()
  const compact = useScrollingDown()
  // "Home" is the account's own storefront: Retail home or Wholesale home.
  const { access } = useCustomerAuth()

  const navItems = [
    { name: 'Home', href: homeFor(access), icon: Home },
    { name: 'Shop', href: '/categories', icon: Grid },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Cart', href: '/cart', icon: ShoppingBag, badge: cartCount },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  return (
    <div
      className="fixed left-3 right-3 z-50 mx-auto w-auto max-w-[456px] rounded-[30px] bg-nav shadow-nav-glow overflow-hidden"
      style={{ bottom: 'calc(var(--nav-gap) + env(safe-area-inset-bottom))' }}
    >
      {/* Inner lighting: a soft highlight across the top edge and a gentle bloom
          in the corner, painted before the nav so DOM order keeps them behind. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40" aria-hidden="true" />
      <div className="pointer-events-none absolute -top-6 -left-4 w-28 h-16 rounded-full bg-white/14 blur-2xl" aria-hidden="true" />

      <nav
        className="relative flex items-stretch px-1.5 transition-[height] duration-300 ease-out motion-reduce:transition-none"
        style={{ height: compact ? 'var(--nav-h-compact)' : 'var(--nav-h)' }}
      >
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
                'relative flex flex-1 flex-col items-center justify-center min-w-0 rounded-[18px] touch-manipulation active:scale-95 transition-all duration-300 ease-out motion-reduce:transition-none',
                compact ? 'gap-0' : 'gap-[3px]'
              )}
            >
              {/* White squircle behind the selected tab. `layoutId` slides it
                  between tabs instead of cross-fading two separate boxes. */}
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-active-chip"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className={cn(
                    'absolute inset-x-[3px] rounded-[18px] bg-white shadow-[0_4px_12px_rgba(6,48,28,0.22)] transition-all duration-300 ease-out motion-reduce:transition-none',
                    compact ? 'inset-y-[5px]' : 'inset-y-[7px]'
                  )}
                  aria-hidden="true"
                />
              )}

              <span className="relative flex items-center justify-center h-[22px] w-[22px]">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={cn('transition-colors duration-200', isActive ? 'text-[#1f8a4d]' : 'text-white')}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1.5 -right-2 text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-sm',
                      isActive ? 'bg-[#1f8a4d] text-white' : 'bg-white text-[#1f8a4d]'
                    )}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>

              <span
                aria-hidden={compact}
                className={cn(
                  'relative text-[10px] leading-none tracking-tight truncate max-w-full px-0.5 overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none',
                  compact ? 'h-0 opacity-0' : 'h-[11px] opacity-100',
                  isActive ? 'text-[#1f8a4d] font-semibold' : 'text-white/90 font-medium'
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
