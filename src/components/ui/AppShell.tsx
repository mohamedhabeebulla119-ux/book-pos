"use client"

import { usePathname } from 'next/navigation'
import { BottomNavigation } from './BottomNavigation'
import { AtmosphericBackground } from './AtmosphericBackground'
import { GuestModeBanner } from './GuestModeBanner'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Full-bleed entry screens: onboarding and the experience chooser both come
  // before the customer is "in" the store, so neither gets the bottom nav or
  // the space reserved for it.
  const isEntryScreen =
    (pathname?.startsWith('/onboarding') ?? false) || (pathname?.startsWith('/welcome') ?? false)

  return (
    <div
      className="flex flex-col min-h-screen bg-background w-full max-w-[480px] mx-auto sm:border-x sm:border-border sm:shadow-float sm:my-0 relative overflow-hidden"
      style={isEntryScreen ? undefined : { paddingBottom: 'var(--nav-safe-pad)' }}
    >
      {/* Light mode is a pure white canvas — green is an accent, never a page
          wash. The atmospheric orbs stay in dark mode, where they give the dark
          theme its depth. */}
      <AtmosphericBackground variant="ambient" className="hidden dark:block" />
      {/* Renders only while a Guest Test Mode session is active, which is only
          possible in a build made with NEXT_PUBLIC_ENABLE_GUEST_MODE=true. */}
      <GuestModeBanner />
      <main className="relative flex-1 w-full h-full overflow-x-hidden">
        {children}
      </main>
      {!isEntryScreen && <BottomNavigation />}
    </div>
  )
}
