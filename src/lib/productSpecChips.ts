import { Cpu, Camera, Smartphone, BatteryCharging, HardDrive, Sparkles, type LucideIcon } from 'lucide-react'
import type { Product, ProductCategory } from '@/types'

export interface SpecChip {
  icon: LucideIcon
  label: string
}

/**
 * Cleans a raw specification value down to a short chip label. Real product
 * copy is often a full descriptive sentence ("48MP Main + 12MP Ultra Wide...",
 * "Aerospace-grade titanium"); truncating that with an ellipsis reads as
 * broken, so instead this extracts a short, meaningful token (a size, a
 * capacity, an hours figure, a chip name) and — if nothing short can be
 * pulled out safely — returns null so the caller simply omits that chip
 * rather than ever showing truncated text.
 */
function shorten(raw?: string): string | null {
  if (!raw) return null
  const stripped = raw.trim().replace(/\s*(headphone\s+)?chip$/i, '').trim()

  // Numeric facts (a size, a capacity, an hours figure) are searched for
  // first, anywhere in the string, since they're the most useful short label
  // — this must run before the plain-length fallback below, otherwise a
  // short-enough comma list like "128GB, 256GB, 512GB" (<=20 chars) would be
  // shown whole instead of reduced to just "128GB".
  const inchMatch = stripped.match(/\d+(\.\d+)?"/)
  if (inchMatch) return inchMatch[0]

  const hoursMatch = stripped.match(/(\d+)\s*hours?\b/i)
  if (hoursMatch) return `${hoursMatch[1]}h`

  const unitMatch = stripped.match(/\d+(\.\d+)?\s?(GB|TB|MP|W|mm|m|nits)\b/i)
  if (unitMatch) return unitMatch[0].replace(/\s+/g, '')

  if (stripped.length <= 20) return stripped

  const firstSegment = stripped.split(',')[0].trim()
  if (firstSegment.length <= 20) return firstSegment

  return null
}

function iconFor(key: string): LucideIcon {
  const k = key.toLowerCase()
  if (k.includes('chip') || k.includes('processor')) return Cpu
  if (k.includes('camera')) return Camera
  if (k.includes('display') || k.includes('screen')) return Smartphone
  if (k.includes('batter') || k.includes('capacity') || k.includes('audio')) return BatteryCharging
  if (k.includes('storage') || k.includes('memory')) return HardDrive
  return Sparkles
}

/** Preferred specification keys per category, tried in order until 3 clean chips are found. */
const KEY_PRIORITY: Partial<Record<ProductCategory, string[]>> = {
  'iPhone': ['Chip', 'Camera', 'Display'],
  'iPad': ['Chip', 'Display', 'Storage'],
  'Mac': ['Chip', 'Memory', 'Storage'],
  'Apple Watch': ['Display', 'Water Resistance', 'Battery'],
  'AirPods': ['Chip', 'Audio', 'Battery'],
}

const SPECIAL_LABELS: Array<{ test: RegExp; label: string }> = [
  { test: /active noise cancellation/i, label: 'ANC' },
]

function specialLabel(raw: string): string | null {
  const hit = SPECIAL_LABELS.find(({ test }) => test.test(raw))
  return hit ? hit.label : null
}

/**
 * Produces up to 3 clean, non-truncated spec chips for any product, using
 * only the specifications already present in the product data — nothing is
 * invented. Categories with a known, informative field set (iPhone, iPad,
 * Mac, Apple Watch, AirPods) use those fields in a sensible order; every
 * other category (Accessories, Replacement Parts, and anything future) falls
 * back to the first specifications that yield a clean short value.
 */
export function getProductSpecChips(product: Product, max = 3): SpecChip[] {
  const specs = product.specifications || {}
  const priority = KEY_PRIORITY[product.category]
  const chips: SpecChip[] = []

  const tryKey = (key: string) => {
    if (chips.length >= max) return
    const raw = specs[key]
    if (!raw) return
    const label = specialLabel(raw) ?? shorten(raw)
    if (label) chips.push({ icon: iconFor(key), label })
  }

  if (priority) {
    priority.forEach(tryKey)
  } else {
    Object.keys(specs).forEach(tryKey)
  }

  return chips
}
