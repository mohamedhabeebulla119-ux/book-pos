"use client"

import { useEffect, useRef } from 'react'
import { Store } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Shown when an approved Wholesale VIP picks "Retail Customer" on the
 * experience chooser (see decideExperienceSwitch). Purely explanatory: it
 * changes no preference, tier or price, and dismissing it leaves the customer
 * exactly where they were.
 */
export function WholesaleSwitchBlockedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    okRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      <div role="alertdialog" aria-modal="true" aria-labelledby="wholesale-switch-title"
        aria-describedby="wholesale-switch-body"
        className="relative w-full max-w-sm rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 text-center shadow-float">
        <span className="mx-auto mb-4 flex h-13 w-13 items-center justify-center rounded-full border border-mint-deep bg-well-strong text-primary">
          <Store size={22} strokeWidth={1.9} />
        </span>
        <h2 id="wholesale-switch-title" className="mb-1.5 text-lg font-bold tracking-tight text-foreground">
          Wholesale Customer
        </h2>
        <p id="wholesale-switch-body" className="mb-5 text-[14px] leading-relaxed text-muted-foreground">
          You&rsquo;re currently signed in as a Wholesale customer, so you can&rsquo;t switch to the Retail experience.
        </p>
        <Button ref={okRef} size="lg" fullWidth onClick={onClose}>OK</Button>
      </div>
    </div>
  )
}
