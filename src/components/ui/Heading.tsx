import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeadingProps {
  eyebrow?: string
  title: string
  subtitle?: string
  className?: string
}

export function PageHeading({ eyebrow, title, subtitle, className }: PageHeadingProps) {
  return (
    <div className={cn('mb-6', className)}>
      {eyebrow && (
        <span className="text-xs font-semibold tracking-widest text-primary uppercase mb-2 block">
          {eyebrow}
        </span>
      )}
      <h1 className="text-[32px] sm:text-[40px] font-bold tracking-tight leading-[1.1] text-foreground">
        {title}
      </h1>
      {subtitle && (
        <p className="text-muted-foreground mt-2 text-base leading-relaxed max-w-lg">
          {subtitle}
        </p>
      )}
    </div>
  )
}

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  subtitle?: string
  seeAllHref?: string
  seeAllLabel?: string
  className?: string
}

export function SectionHeading({ eyebrow, title, subtitle, seeAllHref, seeAllLabel = 'See All', className }: SectionHeadingProps) {
  return (
    <div className={cn('flex items-end justify-between gap-4 mb-6', className)}>
      <div>
        {eyebrow && (
          <span className="text-xs font-semibold tracking-widest text-primary uppercase mb-1.5 block">
            {eyebrow}
          </span>
        )}
        <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">{subtitle}</p>
        )}
      </div>
      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="shrink-0 flex items-center gap-0.5 text-[13px] font-semibold text-primary bg-primary-soft border border-mint-deep rounded-full pl-3.5 pr-2.5 h-9 hover:bg-mint active:scale-95 transition-all duration-300 mb-1"
        >
          {seeAllLabel} <ChevronRight size={16} className="ml-0.5" />
        </Link>
      )}
    </div>
  )
}
