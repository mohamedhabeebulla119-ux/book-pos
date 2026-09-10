import React from 'react'
import { motion } from 'framer-motion'
import { getCategoryTheme } from '@/lib/categoryTheme'

interface CategoryHeroProps {
  eyebrow: string
  title: string
  subtitle: string
  image?: string
  category: string
  className?: string
}

const EASE = [0.22, 1, 0.36, 1] as const

export function CategoryHero({ eyebrow, title, subtitle, image, category, className = '' }: CategoryHeroProps) {
  const theme = getCategoryTheme(category)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={`relative overflow-hidden rounded-[30px] border border-mint/80 dark:border-border bg-gradient-to-br ${theme.hero} shadow-card ${className}`}
    >
      {/* Soft green glow. Plain `absolute` with no z-index: DOM order keeps it
          behind the `relative` content row below. */}
      <div className="pointer-events-none absolute -top-16 -right-10 w-52 h-52 rounded-full bg-emerald-300/40 dark:bg-emerald-500/20 blur-[70px]" aria-hidden="true" />

      <div className="relative flex items-center gap-4 px-5 sm:px-7 py-7 sm:py-9">
        <div className="flex-1 min-w-0">
          <span className="text-[11px] sm:text-xs font-bold tracking-[0.18em] text-primary uppercase mb-2 block">
            {eyebrow}
          </span>
          <h1 className="text-[26px] sm:text-4xl font-bold tracking-tight text-foreground leading-[1.08] mb-2">
            {title}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-snug max-w-xs">
            {subtitle}
          </p>
        </div>
        {image && (
          <div className="relative shrink-0 flex flex-col items-center">
            <img
              src={image}
              alt=""
              aria-hidden="true"
              className="w-20 sm:w-28 h-auto max-h-28 sm:max-h-36 object-contain drop-shadow-xl mix-blend-multiply dark:mix-blend-normal"
            />
            {/* Curved glossy shelf beneath the product */}
            <div className="mt-1 h-6 w-24 sm:w-32 rounded-[100%] bg-pedestal blur-[6px]" aria-hidden="true" />
          </div>
        )}
      </div>
    </motion.div>
  )
}
