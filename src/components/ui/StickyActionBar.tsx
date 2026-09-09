import React from 'react'
import { Button } from './Button'

interface StickyActionBarProps {
  title: string
  price: string
  onAddToCart: () => void
  ctaLabel?: string
}

export function StickyActionBar({ title, price, onAddToCart, ctaLabel = 'Add to Cart' }: StickyActionBarProps) {
  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t border-border px-4 py-3 pb-safe shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.4)]">
      <div className="max-w-md mx-auto flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{title}</div>
          <div className="text-xs text-muted-foreground">{price}</div>
        </div>
        <Button className="w-auto px-8 h-12 shrink-0 bg-gradient-cta text-white border-0 shadow-[0_8px_20px_-6px_rgba(99,60,255,0.5)]" onClick={onAddToCart}>
          {ctaLabel}
        </Button>
      </div>
    </div>
  )
}
