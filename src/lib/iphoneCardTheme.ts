export interface IphoneCardTone {
  /** Gradient behind the product photo (theme-aware token from globals.css) */
  well: string
  /** Blurred colored glow blob sitting behind the product photo */
  glow: string
}

/**
 * Every tone stays inside the store's green family — models are separated by the
 * depth and warmth of the green glow behind the photo, never by a different hue,
 * so a grid of iPhone cards still reads as one surface.
 */
const DEEP_MINT: IphoneCardTone = {
  well: 'bg-well-strong',
  glow: 'bg-emerald-400/45 dark:bg-emerald-500/35',
}
const FRESH_GREEN: IphoneCardTone = {
  well: 'bg-well-strong',
  glow: 'bg-green-400/42 dark:bg-green-500/32',
}
const SOFT_TEAL: IphoneCardTone = {
  well: 'bg-well',
  glow: 'bg-teal-400/38 dark:bg-teal-500/30',
}
const PALE_MINT: IphoneCardTone = {
  well: 'bg-well',
  glow: 'bg-emerald-300/40 dark:bg-emerald-400/28',
}
const SAGE: IphoneCardTone = {
  well: 'bg-well',
  glow: 'bg-lime-400/32 dark:bg-lime-500/24',
}
const SPRING: IphoneCardTone = {
  well: 'bg-well',
  glow: 'bg-green-300/40 dark:bg-green-400/28',
}

const OLDER_GEN_ROTATION = [SAGE, SPRING, SOFT_TEAL]

/**
 * Per-model visual environment for iPhone cards. Pro Max gets the deepest mint,
 * Pro a fresh green, Air a soft teal, the plain numbered model a pale mint, and
 * everything else (mini/Plus/e, older generations) rotates through a harmonious
 * green set keyed off the model name so the same model always gets the same tone.
 */
export function getIphoneCardTone(name: string): IphoneCardTone {
  const n = name.toLowerCase()
  if (n.includes('pro max')) return DEEP_MINT
  if (n.includes('pro')) return FRESH_GREEN
  if (n.includes('air')) return SOFT_TEAL
  if (/^iphone\s+\d+$/.test(n.trim())) return PALE_MINT
  const hash = Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return OLDER_GEN_ROTATION[hash % OLDER_GEN_ROTATION.length]
}
