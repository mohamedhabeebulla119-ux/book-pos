import React from 'react'
import { cn } from '@/lib/utils'

type BadgeTone = 'new' | 'current' | 'neutral' | 'accent'

interface BadgeProps {
  tone?: BadgeTone
  className?: string
  children: React.ReactNode
}

const toneClasses: Record<BadgeTone, string> = {
  new: 'bg-gradient-cta text-white shadow-glow',
  current: 'bg-white/85 dark:bg-black/40 backdrop-blur-sm text-primary border border-mint-deep',
  neutral: 'bg-white/80 dark:bg-black/35 backdrop-blur-sm text-muted-foreground border border-border',
  accent: 'bg-foreground text-background',
}

export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide leading-tight',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function statusTone(status?: string): BadgeTone {
  if (status === 'NEW') return 'new'
  if (status === 'CURRENT') return 'current'
  return 'neutral'
}
