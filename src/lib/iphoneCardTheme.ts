export interface IphoneCardTone {
  /** Gradient behind the product photo (light + dark variants baked in) */
  well: string
  /** Blurred colored glow blob sitting behind the product photo */
  glow: string
}

const VIOLET_PINK: IphoneCardTone = {
  well: 'bg-gradient-to-br from-violet-200 via-fuchsia-100 to-pink-100 dark:from-violet-600/40 dark:via-fuchsia-600/25 dark:to-pink-700/25',
  glow: 'bg-violet-400/50 dark:bg-violet-500/40',
}
const ELECTRIC_BLUE: IphoneCardTone = {
  well: 'bg-gradient-to-br from-blue-200 via-indigo-100 to-sky-100 dark:from-blue-600/40 dark:via-indigo-600/25 dark:to-sky-800/25',
  glow: 'bg-blue-400/50 dark:bg-blue-500/40',
}
const PINK_LAVENDER: IphoneCardTone = {
  well: 'bg-gradient-to-br from-pink-200 via-fuchsia-100 to-violet-100 dark:from-pink-600/35 dark:via-fuchsia-600/20 dark:to-violet-800/25',
  glow: 'bg-pink-400/50 dark:bg-pink-500/40',
}
const BLUE_CYAN: IphoneCardTone = {
  well: 'bg-gradient-to-br from-sky-200 via-cyan-100 to-blue-50 dark:from-sky-600/35 dark:via-cyan-600/20 dark:to-blue-800/25',
  glow: 'bg-cyan-400/50 dark:bg-cyan-500/40',
}
const MINT_TEAL: IphoneCardTone = {
  well: 'bg-gradient-to-br from-emerald-200 via-teal-100 to-cyan-50 dark:from-emerald-600/35 dark:via-teal-600/20 dark:to-cyan-800/25',
  glow: 'bg-emerald-400/50 dark:bg-emerald-500/40',
}
const PEACH_AMBER: IphoneCardTone = {
  well: 'bg-gradient-to-br from-amber-200 via-orange-100 to-rose-50 dark:from-amber-600/35 dark:via-orange-600/20 dark:to-rose-800/25',
  glow: 'bg-amber-400/50 dark:bg-amber-500/40',
}
const LAVENDER_BLUE: IphoneCardTone = {
  well: 'bg-gradient-to-br from-indigo-200 via-violet-100 to-blue-50 dark:from-indigo-600/35 dark:via-violet-600/20 dark:to-blue-800/25',
  glow: 'bg-indigo-400/50 dark:bg-indigo-500/40',
}

const OLDER_GEN_ROTATION = [MINT_TEAL, PEACH_AMBER, LAVENDER_BLUE]

/**
 * Per-model visual environment for iPhone cards. Pro Max gets violet/pink,
 * Pro gets electric blue, Air gets pink/lavender, the plain numbered model
 * gets blue/cyan, and everything else (mini/Plus/e, older generations)
 * rotates through a harmonious pastel set keyed off the model name so the
 * same model always gets the same tone.
 */
export function getIphoneCardTone(name: string): IphoneCardTone {
  const n = name.toLowerCase()
  if (n.includes('pro max')) return VIOLET_PINK
  if (n.includes('pro')) return ELECTRIC_BLUE
  if (n.includes('air')) return PINK_LAVENDER
  if (/^iphone\s+\d+$/.test(n.trim())) return BLUE_CYAN
  const hash = Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return OLDER_GEN_ROTATION[hash % OLDER_GEN_ROTATION.length]
}
