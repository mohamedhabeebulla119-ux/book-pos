export type CategoryToneKey =
  | 'iphone' | 'ipad' | 'mac' | 'watch' | 'airpods'
  | 'parts' | 'displays' | 'batteries' | 'accessories' | 'default'

export interface CategoryTheme {
  key: CategoryToneKey
  /** Gradient background for a product image well (light + dark variants baked in) */
  well: string
  /** Soft colored drop-shadow for cards in this tone (light + dark variants baked in) */
  glow: string
  /** Icon-chip background + icon color (light + dark variants baked in) */
  chip: string
  /** Tint overlay used on top of real photography (CategoryCard), light + dark */
  overlay: string
  /** Richer, more saturated gradient for large category-hero banners */
  hero: string
}

const THEMES: Record<CategoryToneKey, CategoryTheme> = {
  iphone: {
    key: 'iphone',
    well: 'bg-gradient-to-br from-violet-100 to-pink-100 dark:from-violet-500/20 dark:to-pink-500/10',
    glow: 'shadow-[0_10px_32px_-10px_rgba(168,85,247,0.35)] dark:shadow-[0_10px_32px_-10px_rgba(168,85,247,0.25)]',
    chip: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    overlay: 'bg-gradient-to-br from-violet-500/40 via-fuchsia-500/15 to-transparent',
    hero: 'from-violet-200 via-fuchsia-100 to-sky-100 dark:from-violet-900/70 dark:via-fuchsia-900/40 dark:to-sky-900/30',
  },
  ipad: {
    key: 'ipad',
    well: 'bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-500/20 dark:to-cyan-500/10',
    glow: 'shadow-[0_10px_32px_-10px_rgba(14,165,233,0.35)] dark:shadow-[0_10px_32px_-10px_rgba(14,165,233,0.25)]',
    chip: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
    overlay: 'bg-gradient-to-br from-sky-500/40 via-cyan-500/15 to-transparent',
    hero: 'from-sky-200 via-cyan-100 to-blue-50 dark:from-sky-900/70 dark:via-cyan-900/40 dark:to-blue-900/30',
  },
  mac: {
    key: 'mac',
    well: 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/10',
    glow: 'shadow-[0_10px_32px_-10px_rgba(16,185,129,0.35)] dark:shadow-[0_10px_32px_-10px_rgba(16,185,129,0.25)]',
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    overlay: 'bg-gradient-to-br from-emerald-500/40 via-teal-500/15 to-transparent',
    hero: 'from-emerald-200 via-teal-100 to-slate-100 dark:from-emerald-900/60 dark:via-teal-900/40 dark:to-slate-900/30',
  },
  watch: {
    key: 'watch',
    well: 'bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-500/20 dark:to-pink-500/10',
    glow: 'shadow-[0_10px_32px_-10px_rgba(244,63,94,0.35)] dark:shadow-[0_10px_32px_-10px_rgba(244,63,94,0.25)]',
    chip: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
    overlay: 'bg-gradient-to-br from-rose-500/40 via-pink-500/15 to-transparent',
    hero: 'from-rose-200 via-pink-100 to-fuchsia-50 dark:from-rose-900/70 dark:via-pink-900/40 dark:to-fuchsia-900/30',
  },
  airpods: {
    key: 'airpods',
    well: 'bg-gradient-to-br from-amber-100 to-violet-100 dark:from-amber-500/20 dark:to-violet-500/10',
    glow: 'shadow-[0_10px_32px_-10px_rgba(245,158,11,0.3)] dark:shadow-[0_10px_32px_-10px_rgba(245,158,11,0.2)]',
    chip: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    overlay: 'bg-gradient-to-br from-amber-500/35 via-violet-500/15 to-transparent',
    hero: 'from-amber-100 via-orange-50 to-violet-100 dark:from-amber-900/60 dark:via-orange-900/30 dark:to-violet-900/30',
  },
  parts: {
    key: 'parts',
    well: 'bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-500/20 dark:to-blue-500/10',
    glow: 'shadow-[0_10px_32px_-10px_rgba(99,102,241,0.35)] dark:shadow-[0_10px_32px_-10px_rgba(99,102,241,0.25)]',
    chip: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
    overlay: 'bg-gradient-to-br from-indigo-500/40 via-blue-500/15 to-transparent',
    hero: 'from-indigo-200 via-blue-100 to-sky-50 dark:from-indigo-900/70 dark:via-blue-900/40 dark:to-sky-900/30',
  },
  displays: {
    key: 'displays',
    well: 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-500/20 dark:to-cyan-500/10',
    glow: 'shadow-[0_10px_32px_-10px_rgba(59,130,246,0.35)] dark:shadow-[0_10px_32px_-10px_rgba(59,130,246,0.25)]',
    chip: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
    overlay: 'bg-gradient-to-br from-blue-500/40 via-cyan-500/15 to-transparent',
    hero: 'from-blue-200 via-cyan-100 to-sky-50 dark:from-blue-900/70 dark:via-cyan-900/40 dark:to-sky-900/30',
  },
  batteries: {
    key: 'batteries',
    well: 'bg-gradient-to-br from-emerald-100 to-lime-100 dark:from-emerald-500/20 dark:to-lime-500/10',
    glow: 'shadow-[0_10px_32px_-10px_rgba(34,197,94,0.35)] dark:shadow-[0_10px_32px_-10px_rgba(34,197,94,0.25)]',
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    overlay: 'bg-gradient-to-br from-emerald-500/40 via-lime-500/15 to-transparent',
    hero: 'from-emerald-200 via-lime-100 to-teal-50 dark:from-emerald-900/70 dark:via-lime-900/30 dark:to-teal-900/30',
  },
  accessories: {
    key: 'accessories',
    well: 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/10',
    glow: 'shadow-[0_10px_32px_-10px_rgba(249,115,22,0.3)] dark:shadow-[0_10px_32px_-10px_rgba(249,115,22,0.2)]',
    chip: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300',
    overlay: 'bg-gradient-to-br from-orange-500/35 via-amber-500/15 to-transparent',
    hero: 'from-orange-200 via-amber-100 to-violet-100 dark:from-orange-900/60 dark:via-amber-900/30 dark:to-violet-900/30',
  },
  default: {
    key: 'default',
    well: 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-500/15 dark:to-slate-500/5',
    glow: 'shadow-card',
    chip: 'bg-muted text-muted-foreground',
    overlay: 'bg-gradient-to-br from-slate-500/30 via-slate-500/10 to-transparent',
    hero: 'from-slate-200 via-slate-100 to-slate-50 dark:from-slate-800/70 dark:via-slate-800/40 dark:to-slate-900/30',
  },
}

export function normalizeCategoryTone(input?: string): CategoryToneKey {
  if (!input) return 'default'
  const s = input.toLowerCase()
  if (s.includes('iphone')) return 'iphone'
  if (s.includes('ipad')) return 'ipad'
  if (s.includes('mac')) return 'mac'
  if (s.includes('watch')) return 'watch'
  if (s.includes('airpod')) return 'airpods'
  if (s.includes('display')) return 'displays'
  if (s.includes('batter')) return 'batteries'
  if (s.includes('part')) return 'parts'
  if (s.includes('accessor')) return 'accessories'
  return 'default'
}

export function getCategoryTheme(input?: string): CategoryTheme {
  return THEMES[normalizeCategoryTone(input)]
}
