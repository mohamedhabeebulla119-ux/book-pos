"use client"

import Link from 'next/link'
import { Search, ShoppingBag } from 'lucide-react'
import { useCart } from '@/context/CartContext'

export function Header() {
  const { cartCount } = useCart()

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border shadow-sm">
      <div className="flex items-center justify-between h-16 px-5 max-w-md mx-auto">
        <Link href="/" className="flex items-center">
          <div className="bg-white rounded-2xl px-3 py-1.5 shadow-sm flex items-center justify-center transition-transform hover:scale-[1.02]">
            <img 
              src="/logo.jpg" 
              alt="Apple EXPERT Logo" 
              className="h-9 sm:h-11 w-auto object-contain mix-blend-normal"
            />
          </div>
        </Link>
        
        <div className="flex items-center space-x-5">
          <Link href="/search" className="text-foreground/90 hover:text-primary transition-colors">
            <Search size={24} strokeWidth={2} />
          </Link>
          <Link href="/cart" className="relative text-foreground/90 hover:text-primary transition-colors">
            <ShoppingBag size={24} strokeWidth={2} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center border border-background">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
