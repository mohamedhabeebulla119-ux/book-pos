"use client"

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { markOnboardingCompleted } from '@/utils/onboarding'
import { onboardingScreens } from './onboardingData'

const SWIPE_THRESHOLD = 60

export function Onboarding() {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [[index, direction], setIndexState] = useState<[number, number]>([0, 0])

  const total = onboardingScreens.length
  const isLast = index === total - 1
  const screen = onboardingScreens[index]

  const goTo = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex > total - 1) return
      setIndexState(([current]) => [nextIndex, nextIndex > current ? 1 : -1])
    },
    [total]
  )

  const finish = useCallback(() => {
    markOnboardingCompleted()
    router.replace('/')
  }, [router])

  const handlePrimary = () => {
    if (isLast) {
      finish()
    } else {
      goTo(index + 1)
    }
  }

  const handleSkip = () => finish()

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x <= -SWIPE_THRESHOLD) {
      goTo(index + 1)
    } else if (info.offset.x >= SWIPE_THRESHOLD) {
      goTo(index - 1)
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(index + 1)
      else if (e.key === 'ArrowLeft') goTo(index - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, goTo])

  const offset = shouldReduceMotion ? 0 : 36
  const variants = {
    enter: (dir: number) => ({ x: dir >= 0 ? offset : -offset, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir >= 0 ? -offset : offset, opacity: 0 }),
  }
  const transition = { duration: shouldReduceMotion ? 0.15 : 0.4, ease: [0.22, 1, 0.36, 1] as const }

  const Visual = screen.Visual

  return (
    <div className="relative flex flex-col h-full min-h-screen overflow-hidden bg-background">
      {/* Atmospheric background, swaps per screen. Note: deliberately position:absolute with
          no z-index (relies on DOM order, not negative z-index) — negative z-index nested inside
          an overflow-hidden ancestor fails to paint in some Chromium versions. Siblings below are
          explicitly `relative` so they still stack above this in DOM order. */}
      <div
        className={`absolute inset-0 pointer-events-none transition-colors duration-700 bg-gradient-to-b ${screen.bg}`}
        aria-hidden="true"
      />

      {/* Top bar */}
      <div className="relative flex items-center justify-end shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] h-[calc(env(safe-area-inset-top)+3.25rem)]">
        {!isLast && (
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Skip onboarding"
            className="min-h-[44px] min-w-[44px] px-3 flex items-center justify-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-full"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slides */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={screen.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6 sm:px-10 text-center touch-pan-y"
          >
            <Visual />

            <div className="max-w-sm">
              <span className="text-xs sm:text-sm font-semibold tracking-widest text-primary uppercase mb-3 block">
                {screen.eyebrow}
              </span>
              <h1 className="text-[28px] sm:text-4xl font-bold tracking-tight text-foreground leading-tight mb-3">
                {screen.headline}
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
                {screen.subtitle}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="relative shrink-0 flex flex-col items-center gap-6 px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.75rem)]">
        <div
          className="flex items-center gap-2"
          role="group"
          aria-label={`Onboarding step ${index + 1} of ${total}`}
        >
          {onboardingScreens.map((s, i) => (
            <motion.span
              key={s.id}
              animate={{ width: i === index ? 22 : 6, opacity: i === index ? 1 : 0.3 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-1.5 rounded-full bg-primary"
            />
          ))}
        </div>

        <Button
          size="lg"
          fullWidth
          onClick={handlePrimary}
          className="max-w-sm h-14 rounded-full text-base font-semibold bg-gradient-cta text-white border-0 shadow-[0_10px_28px_-8px_rgba(99,60,255,0.5)]"
        >
          {isLast ? 'Start Shopping' : index === 0 ? 'Get Started' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
