"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Grid, Search, ShoppingBag, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '@/context/CartContext'

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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.2)]">
      <nav className="flex items-center w-full h-[72px] max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center w-1/5 h-full space-y-1 transition-colors duration-200 min-h-[44px] min-w-[44px]",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative flex items-center justify-center h-8 w-8">
                <Icon size={28} strokeWidth={isActive ? 2.5 : 2} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[11px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center border border-background">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[13px] font-medium tracking-tight">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
