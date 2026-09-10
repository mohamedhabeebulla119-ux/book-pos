"use client"

import { usePathname } from 'next/navigation'
import { BottomNavigation } from './BottomNavigation'
import { AtmosphericBackground } from './AtmosphericBackground'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isOnboarding = pathname?.startsWith('/onboarding') ?? false

  return (
    <div
      className="flex flex-col min-h-screen bg-background w-full max-w-[480px] mx-auto sm:border-x sm:border-border sm:shadow-float sm:my-0 relative overflow-hidden"
      style={isOnboarding ? undefined : { paddingBottom: 'var(--nav-safe-pad)' }}
    >
      <AtmosphericBackground variant="ambient" />
      <main className="relative flex-1 w-full h-full overflow-x-hidden">
        {children}
      </main>
      {!isOnboarding && <BottomNavigation />}
    </div>
  )
}
