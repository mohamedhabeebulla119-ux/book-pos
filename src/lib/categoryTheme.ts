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

/**
 * One green design language for the whole store. Every category shares the same
 * white → pale-mint → light-green gradient family; categories are separated only
 * by how deep that green sits (well strength, glow intensity, overlay weight),
 * never by hue. `bg-well*` and the `primary-*`/`mint*` colors are theme-aware
 * tokens from globals.css, so no `dark:` pair is needed for those.
 */
const SOFT_GLOW = 'shadow-[0_10px_30px_-14px_rgba(31,138,77,0.22)] dark:shadow-[0_10px_30px_-14px_rgba(88,207,131,0.16)]'
const DEEP_GLOW = 'shadow-[0_14px_36px_-14px_rgba(31,138,77,0.32)] dark:shadow-[0_14px_36px_-14px_rgba(88,207,131,0.22)]'

const CHIP = 'bg-primary-soft text-primary'

const THEMES: Record<CategoryToneKey, CategoryTheme> = {
  iphone: {
    key: 'iphone',
    well: 'bg-well-strong',
    glow: DEEP_GLOW,
    chip: CHIP,
    overlay: 'bg-gradient-to-br from-emerald-500/45 via-green-400/20 to-transparent',
    hero: 'from-[#d6f4e2] via-[#f1fbf5] to-white dark:from-emerald-900/45 dark:via-[#0f1d16] dark:to-[#0a1410]',
  },
  ipad: {
    key: 'ipad',
    well: 'bg-well',
    glow: SOFT_GLOW,
    chip: CHIP,
    overlay: 'bg-gradient-to-br from-emerald-500/35 via-teal-400/18 to-transparent',
    hero: 'from-[#dbf5e6] via-[#f2fbf6] to-white dark:from-teal-900/40 dark:via-[#0f1d17] dark:to-[#0a1410]',
  },
  mac: {
    key: 'mac',
    well: 'bg-well',
    glow: SOFT_GLOW,
    chip: CHIP,
    overlay: 'bg-gradient-to-br from-green-600/40 via-emerald-400/18 to-transparent',
    hero: 'from-[#d9f3e3] via-[#f0faf4] to-white dark:from-green-900/45 dark:via-[#101c16] dark:to-[#0a1410]',
  },
  watch: {
    key: 'watch',
    well: 'bg-well',
    glow: SOFT_GLOW,
    chip: CHIP,
    overlay: 'bg-gradient-to-br from-emerald-600/42 via-lime-400/16 to-transparent',
    hero: 'from-[#ddf6e7] via-[#f2fbf6] to-white dark:from-emerald-900/40 dark:via-[#0f1d16] dark:to-[#0a1410]',
  },
  airpods: {
    key: 'airpods',
    well: 'bg-well',
    glow: SOFT_GLOW,
    chip: CHIP,
    overlay: 'bg-gradient-to-br from-teal-500/38 via-emerald-300/18 to-transparent',
    hero: 'from-[#e2f7ec] via-[#f4fcf8] to-white dark:from-teal-900/38 dark:via-[#0f1d17] dark:to-[#0a1410]',
  },
  parts: {
    key: 'parts',
    well: 'bg-well',
    glow: SOFT_GLOW,
    chip: CHIP,
    overlay: 'bg-gradient-to-br from-green-700/45 via-emerald-500/18 to-transparent',
    hero: 'from-[#d7f2e1] via-[#eff9f3] to-white dark:from-green-950/60 dark:via-[#0f1c15] dark:to-[#0a1410]',
  },
  displays: {
    key: 'displays',
    well: 'bg-well-strong',
    glow: DEEP_GLOW,
    chip: CHIP,
    overlay: 'bg-gradient-to-br from-emerald-600/45 via-green-400/18 to-transparent',
    hero: 'from-[#d4f2e0] via-[#eefaf3] to-white dark:from-emerald-950/55 dark:via-[#0f1c15] dark:to-[#0a1410]',
  },
  batteries: {
    key: 'batteries',
    well: 'bg-well-strong',
    glow: DEEP_GLOW,
    chip: CHIP,
    overlay: 'bg-gradient-to-br from-lime-600/40 via-emerald-500/18 to-transparent',
    hero: 'from-[#dcf5e3] via-[#f1fbf4] to-white dark:from-lime-950/50 dark:via-[#0f1c15] dark:to-[#0a1410]',
  },
  accessories: {
    key: 'accessories',
    well: 'bg-well',
    glow: SOFT_GLOW,
    chip: CHIP,
    overlay: 'bg-gradient-to-br from-emerald-500/38 via-green-300/18 to-transparent',
    hero: 'from-[#e0f7e9] via-[#f3fcf7] to-white dark:from-emerald-900/38 dark:via-[#0f1d16] dark:to-[#0a1410]',
  },
  default: {
    key: 'default',
    well: 'bg-well',
    glow: SOFT_GLOW,
    chip: CHIP,
    overlay: 'bg-gradient-to-br from-emerald-600/35 via-green-400/14 to-transparent',
    hero: 'from-[#e2f7ec] via-[#f4fcf8] to-white dark:from-[#12261c] dark:via-[#0f1d16] dark:to-[#0a1410]',
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
