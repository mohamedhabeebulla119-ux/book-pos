import React from 'react'
import { Button } from './Button'

interface StickyActionBarProps {
  title: string
  price: string
  onAddToCart: () => void
  ctaLabel?: string
}

/** Floats just above the bottom navigation, sharing its geometry tokens so the
 *  two never overlap each other or the page content. */
export function StickyActionBar({ title, price, onAddToCart, ctaLabel = 'Add to Cart' }: StickyActionBarProps) {
  return (
    <div
      className="fixed left-3 right-3 z-40 mx-auto w-auto max-w-[456px] rounded-[26px] border border-white/60 dark:border-white/8 bg-glass shadow-nav px-3 py-2.5"
      style={{ bottom: 'calc(var(--nav-offset) + 0.5rem)' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate text-foreground">{title}</div>
          <div className="text-xs font-medium text-primary">{price}</div>
        </div>
        <Button className="w-auto px-6 h-11 shrink-0 text-sm" onClick={onAddToCart}>
          {ctaLabel}
        </Button>
      </div>
    </div>
  )
}
