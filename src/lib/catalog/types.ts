import type { Product } from '@/types'

/** Where the products in the current snapshot came from. */
export type CatalogSource = 'static' | 'live'

export type CatalogStatus =
  | 'static'   // bundled catalog only — the live query has not resolved yet
  | 'live'     // live data applied on top of the bundle
  | 'fallback' // the live query failed; the bundle is still being served

/** The pricing tier the database resolved for the current caller. */
export type ResolvedTier = 'retail' | 'wholesale_vip'

export interface CatalogSnapshot {
  /** Products for the customer UI. Always populated, never empty. */
  products: readonly Product[]
  /**
   * Curated merchandising for the homepage carousel, in display order.
   * Sourced from featured_products when live, from the bundle otherwise.
   */
  featuredIds: readonly string[]
  status: CatalogStatus
  source: CatalogSource
  /**
   * Which tier the live prices came from, or null while only the bundled
   * catalog is in play. A retail caller can never see 'wholesale_vip' here —
   * RLS removes those rows before they reach the client.
   */
  tier: ResolvedTier | null
  /** Set when the live query failed, for diagnostics only — never shown as a price. */
  error: string | null
}
