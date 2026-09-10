import React from 'react'

interface AtmosphericBackgroundProps {
  /** 'ambient' = faint, constant, whole-app wash. 'strong' = a section-local feature glow. */
  variant?: 'ambient' | 'strong'
  className?: string
}

/**
 * Cheap, static (non-animating) blurred green orbs that give every surface a soft
 * "alive" atmosphere, so content floats on a green/white sky rather than plain
 * white. Deliberately capped at 3 orbs and a moderate blur radius — this renders
 * behind every screen via AppShell, so it must stay cheap on lower-end Android
 * WebViews (no animated filter/blur properties).
 *
 * Deliberately no negative z-index: this must render as the first child of a
 * container whose other children are `relative` (or otherwise positioned) so DOM
 * order — not z-index — keeps it behind everything. Negative z-index nested
 * inside an `overflow-hidden` ancestor fails to paint in some Chromium versions.
 */
export function AtmosphericBackground({ variant = 'ambient', className = '' }: AtmosphericBackgroundProps) {
  const opacity = variant === 'ambient' ? 'opacity-50 dark:opacity-35' : 'opacity-75 dark:opacity-50'

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className={`absolute -top-28 -left-20 w-80 h-80 rounded-full bg-emerald-200 dark:bg-emerald-600 blur-[95px] ${opacity}`} />
      <div className={`absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-green-200 dark:bg-green-700 blur-[105px] ${opacity}`} />
      <div className={`absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-teal-100 dark:bg-teal-800 blur-[110px] ${opacity}`} />
    </div>
  )
}
