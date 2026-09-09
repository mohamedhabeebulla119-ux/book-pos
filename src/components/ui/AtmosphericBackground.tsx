import React from 'react'

interface AtmosphericBackgroundProps {
  /** 'ambient' = faint, constant, whole-app wash. 'strong' = a section-local feature glow. */
  variant?: 'ambient' | 'strong'
  className?: string
}

/**
 * Cheap, static (non-animating) blurred color orbs used to give surfaces a soft
 * "alive" atmosphere. Deliberately capped at 2 orbs and a moderate blur radius —
 * this renders behind every screen via AppShell, so it must stay cheap on
 * lower-end Android WebViews (no animated filter/blur properties).
 *
 * Deliberately no negative z-index: this must render as the first child of a
 * container whose other children are `relative` (or otherwise positioned) so DOM
 * order — not z-index — keeps it behind everything. Negative z-index nested
 * inside an `overflow-hidden` ancestor fails to paint in some Chromium versions.
 */
export function AtmosphericBackground({ variant = 'ambient', className = '' }: AtmosphericBackgroundProps) {
  const opacity = variant === 'ambient' ? 'opacity-40 dark:opacity-30' : 'opacity-70 dark:opacity-50'

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className={`absolute -top-24 -left-16 w-72 h-72 rounded-full bg-violet-300 dark:bg-violet-600 blur-[90px] ${opacity}`} />
      <div className={`absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-sky-300 dark:bg-sky-600 blur-[100px] ${opacity}`} />
    </div>
  )
}
