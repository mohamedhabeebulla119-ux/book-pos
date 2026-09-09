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
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.hero} ${className}`}
    >
      <div className="relative flex items-center gap-4 px-5 sm:px-8 py-7 sm:py-10">
        <div className="flex-1 min-w-0">
          <span className="text-[11px] sm:text-xs font-bold tracking-[0.18em] text-foreground/60 uppercase mb-2 block">
            {eyebrow}
          </span>
          <h1 className="text-[26px] sm:text-4xl font-bold tracking-tight text-foreground leading-[1.08] mb-2">
            {title}
          </h1>
          <p className="text-foreground/70 text-sm sm:text-base leading-snug max-w-xs">
            {subtitle}
          </p>
        </div>
        {image && (
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="w-20 sm:w-32 h-auto max-h-28 sm:max-h-40 object-contain shrink-0 drop-shadow-xl"
          />
        )}
      </div>
    </motion.div>
  )
}
