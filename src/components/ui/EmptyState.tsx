import React from 'react'
import Link from 'next/link'
import { LucideIcon } from 'lucide-react'
import { Button } from './Button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  ctaLabel?: string
  ctaHref?: string
  compact?: boolean
}

export function EmptyState({ icon: Icon, title, subtitle, ctaLabel, ctaHref, compact = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-16' : 'py-20'} px-4`}>
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
        <Icon size={compact ? 24 : 32} className="text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-bold mb-2 tracking-tight">{title}</h2>
      {subtitle && (
        <p className="text-muted-foreground mb-8 max-w-xs">{subtitle}</p>
      )}
      {ctaLabel && ctaHref && (
        <Link href={ctaHref}>
          <Button size="lg" className="px-8 rounded-full h-12">{ctaLabel}</Button>
        </Link>
      )}
    </div>
  )
}
