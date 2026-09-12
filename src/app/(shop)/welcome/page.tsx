"use client"

import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { ShoppingBag, Store, ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setExperience, type ShoppingExperience } from '@/utils/experience'

/**
 * Customer entry: "How would you like to continue?"
 *
 * The choice made here is a PREFERENCE about which screens to show. It does not
 * touch public.profiles.customer_type and cannot — that column's UPDATE
 * privilege is revoked from `authenticated`, so the browser has no write path
 * to it at all. Picking "Wholesale Customer" routes into the wholesale
 * gateway, where the DATABASE decides whether this person actually holds a
 * Wholesale VIP grant.
 */

const EASE = [0.22, 1, 0.36, 1] as const

interface ExperienceOption {
  id: ShoppingExperience
  title: string
  description: string
  icon: typeof ShoppingBag
  cta: string
  destination: string
  points: readonly string[]
  /** Retail leads with the house green; wholesale sits one shade deeper. */
  accent: string
  iconChip: string
}

const OPTIONS: readonly ExperienceOption[] = [
  {
    id: 'retail',
    title: 'Retail Customer',
    description: 'Shop Apple products and accessories for personal purchases.',
    icon: ShoppingBag,
    cta: 'Continue as Retail Customer',
    destination: '/',
    points: ['Full Apple catalogue', 'Genuine replacement parts', 'Standard retail pricing'],
    accent: 'from-primary-soft to-transparent',
    iconChip: 'bg-well-strong border-mint-deep text-primary',
  },
  {
    id: 'wholesale',
    title: 'Wholesale Customer',
    description: 'Access business purchasing, bulk orders and wholesale pricing.',
    icon: Store,
    cta: 'Continue as Wholesale Customer',
    destination: '/wholesale',
    points: ['Business purchasing', 'Bulk and repeat orders', 'Wholesale pricing once approved'],
    accent: 'from-mint to-transparent',
    iconChip: 'bg-mint border-mint-deep text-primary-strong',
  },
]

export default function WelcomePage() {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()

  function choose(option: ExperienceOption) {
    setExperience(option.id)
    router.replace(option.destination)
  }

  return (
    <div className="flex min-h-screen flex-col px-5 py-10">
      <motion.header
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="text-center mb-8"
      >
        <span className="inline-flex items-center rounded-full border border-mint-deep bg-primary-soft px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          Apple Expert
        </span>
        <h1 className="mt-5 text-[27px] sm:text-[32px] font-bold tracking-tight leading-[1.15] text-foreground text-balance">
          How would you like to continue?
        </h1>
        <p className="mx-auto mt-2.5 max-w-xs text-[14px] leading-relaxed text-muted-foreground text-balance">
          Choose the shopping experience that best fits you.
        </p>
      </motion.header>

      <div className="flex flex-1 flex-col justify-center gap-4">
        {OPTIONS.map((option, index) => {
          const Icon = option.icon
          return (
            <motion.button
              key={option.id}
              type="button"
              onClick={() => choose(option)}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.1 + index * 0.09 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.975 }}
              className="focus-ring group relative overflow-hidden rounded-[28px] border border-mint/80 dark:border-border bg-surface p-5 text-left shadow-card transition-shadow duration-300 hover:shadow-float"
            >
              {/* Light-mode only gradient wash; dark mode keeps the flat surface
                  so the card never glows against the dark theme. */}
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b opacity-80 dark:hidden',
                  option.accent,
                )}
              />

              <div className="relative">
                <span
                  aria-hidden="true"
                  className={cn(
                    'mb-4 flex h-13 w-13 items-center justify-center rounded-2xl border shadow-card transition-transform duration-300 group-hover:scale-[1.04]',
                    option.iconChip,
                  )}
                >
                  <Icon size={25} strokeWidth={1.9} />
                </span>

                <h2 className="text-[19px] font-bold tracking-tight text-foreground">{option.title}</h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  {option.description}
                </p>

                <ul className="mt-3.5 space-y-1.5">
                  {option.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                      <Check size={13} className="shrink-0 text-primary" strokeWidth={2.6} />
                      {point}
                    </li>
                  ))}
                </ul>

                <span className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-cta px-5 text-[14px] font-semibold text-white shadow-glow transition-shadow duration-300 group-hover:shadow-float">
                  {option.cta}
                  <ArrowRight size={16} strokeWidth={2.4} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>

      <motion.p
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.34 }}
        className="mt-8 flex items-start justify-center gap-2 text-center text-[11.5px] leading-relaxed text-muted-foreground"
      >
        <ShieldCheck size={13} className="mt-0.5 shrink-0" />
        <span className="max-w-[19rem]">
          You can switch at any time from your profile. Wholesale pricing is granted by Apple
          Expert after review — choosing it here does not apply it.
        </span>
      </motion.p>
    </div>
  )
}
