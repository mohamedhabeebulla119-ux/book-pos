import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { AdminRole } from './roles'

/**
 * Admin pricing data access.
 *
 * Reads go straight to product_prices, which admins and staff may SELECT via
 * the "product_prices staff read all" policy — that is what lets this screen
 * show retail and wholesale VIP side by side while a retail customer's own
 * query still returns zero VIP rows.
 *
 * WRITES NEVER TOUCH product_prices DIRECTLY. The table has no INSERT/UPDATE/
 * DELETE policy for any role and those privileges are revoked from anon and
 * authenticated, so the only supported path is the admin_set_price() SECURITY
 * DEFINER function, which re-checks the caller's role inside PostgreSQL, closes
 * the current live row and inserts a new one in a single transaction.
 *
 * No service_role key is used. No schema change was made.
 */

type Tables = Database['public']['Tables']
export type PriceRow = Tables['product_prices']['Row']

export const TIERS = ['retail', 'wholesale_vip'] as const
export type TierCode = (typeof TIERS)[number]

export const TIER_LABEL: Record<TierCode, string> = {
  retail: 'Retail',
  wholesale_vip: 'Wholesale VIP',
}

/** Quantity breaks are out of scope: every price this screen writes uses 1. */
export const LAUNCH_MIN_QTY = 1

/** Owner and admin may write prices; staff is read-only by existing policy. */
export function canEditPrices(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
// The database stores bigint minor units. Input is restricted to whole rupees,
// which removes floating point from the conversion entirely: `rupees * 100` is
// exact integer arithmetic for every value this catalog will ever hold.
// ---------------------------------------------------------------------------

/** Ceiling guard: Rs. 100,000,000 is far above any Apple Expert product. */
const MAX_RUPEES = 100_000_000

export type ParseResult =
  | { ok: true; rupees: number }
  | { ok: false; reason: string }

/**
 * Parses admin input into a positive whole-rupee integer.
 *
 * Rejects NaN, Infinity, negatives, zero, decimals and anything malformed
 * rather than coercing, so a typo can never become a price.
 */
export function parseRupeeInput(raw: string): ParseResult {
  // Trim the ends only. Internal whitespace is NOT stripped: "12 34" is a typo,
  // and silently reading it as 1234 would set a wrong price.
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, reason: 'Enter a price.' }
  if (trimmed.includes('.')) return { ok: false, reason: 'Enter whole rupees, with no decimals.' }

  // Thousands separators are allowed, but only in correct groups — "4,9,0" is
  // a typo, not 490.
  if (trimmed.includes(',') && !/^\d{1,3}(,\d{3})+$/.test(trimmed)) {
    return { ok: false, reason: 'Check the thousands separators, for example 490,000.' }
  }

  const cleaned = trimmed.replace(/,/g, '')
  if (!/^\d+$/.test(cleaned)) return { ok: false, reason: 'Use digits only, for example 490000.' }

  const rupees = Number(cleaned)
  if (!Number.isSafeInteger(rupees)) return { ok: false, reason: 'That number is too large.' }
  if (rupees <= 0) return { ok: false, reason: 'Price must be greater than zero.' }
  if (rupees > MAX_RUPEES) return { ok: false, reason: 'That price looks wrong — check the amount.' }

  return { ok: true, rupees }
}

/** Whole rupees -> bigint minor units. Integer maths only. */
export function rupeesToCents(rupees: number): number {
  return rupees * 100
}

/** Minor units -> whole rupees, for display and for pre-filling an input. */
export function centsToRupees(cents: number): number {
  return Math.round(cents / 100)
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One priceable thing: a product, or one variant of a product. */
export interface PricingTarget {
  key: string
  productId: string
  productName: string
  categoryId: string
  categoryName: string
  isActive: boolean
  /** null for a product-level price row. */
  variantId: string | null
  variantLegacyKey: string | null
  variantLabel: string | null
  retailCents: number | null
  vipCents: number | null
}

export interface PricingData {
  targets: PricingTarget[]
  categories: { id: string; name: string }[]
}

export async function loadPricing(): Promise<PricingData> {
  const supabase = getSupabaseClient()

  const [categoriesResult, productsResult, variantsResult, pricesResult] = await Promise.all([
    supabase.from('categories').select('id, name, sort_order').order('sort_order', { ascending: true }),
    supabase.from('products').select('id, name, category_id, is_active, sort_order').order('sort_order', { ascending: true }),
    supabase.from('product_variants').select('id, product_id, legacy_key, name, sort_order').order('sort_order', { ascending: true }),
    // Live rows only: ends_at IS NULL is what marks the current price.
    supabase.from('product_prices')
      .select('product_id, variant_id, tier_code, price_cents')
      .is('ends_at', null)
      .eq('min_qty', LAUNCH_MIN_QTY),
  ])

  if (categoriesResult.error) throw categoriesResult.error
  if (productsResult.error) throw productsResult.error
  if (variantsResult.error) throw variantsResult.error
  if (pricesResult.error) throw pricesResult.error

  const categories = (categoriesResult.data ?? []).map((c) => ({ id: c.id, name: c.name }))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  const priceKey = (productId: string, variantId: string | null, tier: string) =>
    `${productId}::${variantId ?? ''}::${tier}`
  const prices = new Map<string, number>()
  for (const row of pricesResult.data ?? []) {
    prices.set(priceKey(row.product_id, row.variant_id, row.tier_code), row.price_cents)
  }

  const variantsByProduct = new Map<string, typeof variantsResult.data>()
  for (const variant of variantsResult.data ?? []) {
    const list = variantsByProduct.get(variant.product_id) ?? []
    list.push(variant)
    variantsByProduct.set(variant.product_id, list)
  }

  const targets: PricingTarget[] = []

  for (const product of productsResult.data ?? []) {
    const base = {
      productId: product.id,
      productName: product.name,
      categoryId: product.category_id,
      categoryName: categoryName.get(product.category_id) ?? 'Uncategorised',
      isActive: product.is_active,
    }

    const variants = variantsByProduct.get(product.id) ?? []

    // Product-level row. Kept even when variants exist, because the seeded
    // catalog prices products at both levels and the existing structure must
    // not be duplicated or invented away.
    targets.push({
      ...base,
      key: `${product.id}::`,
      variantId: null,
      variantLegacyKey: null,
      variantLabel: null,
      retailCents: prices.get(priceKey(product.id, null, 'retail')) ?? null,
      vipCents: prices.get(priceKey(product.id, null, 'wholesale_vip')) ?? null,
    })

    for (const variant of variants) {
      targets.push({
        ...base,
        key: `${product.id}::${variant.id}`,
        variantId: variant.id,
        variantLegacyKey: variant.legacy_key,
        variantLabel: variant.name,
        retailCents: prices.get(priceKey(product.id, variant.id, 'retail')) ?? null,
        vipCents: prices.get(priceKey(product.id, variant.id, 'wholesale_vip')) ?? null,
      })
    }
  }

  return { targets, categories }
}

/**
 * Full price history for one product or variant, newest first.
 *
 * Historical rows are audit records: this screen only ever reads them.
 */
export async function loadPriceHistory(
  productId: string,
  variantId: string | null,
): Promise<PriceRow[]> {
  let query = getSupabaseClient()
    .from('product_prices')
    .select('*')
    .eq('product_id', productId)
    .order('starts_at', { ascending: false })

  query = variantId === null ? query.is('variant_id', null) : query.eq('variant_id', variantId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ---------------------------------------------------------------------------
// Write — the only path
// ---------------------------------------------------------------------------

export interface SetPriceInput {
  productId: string
  variantId: string | null
  tierCode: TierCode
  rupees: number
}

/**
 * Changes a price through admin_set_price().
 *
 * The function itself verifies the caller holds admin or owner, validates the
 * tier, product and variant, retires the current live row by stamping ends_at,
 * and inserts the replacement — all inside one transaction, with database
 * `now()` as the authority. It writes product_prices and nothing else: no
 * inventory, no orders.
 */
export async function setPrice(input: SetPriceInput): Promise<PriceRow> {
  const priceCents = rupeesToCents(input.rupees)

  if (!Number.isSafeInteger(priceCents) || priceCents <= 0) {
    throw new Error('Refusing to send a non-integer price to the database.')
  }

  const { data, error } = await getSupabaseClient().rpc('admin_set_price', {
    p_product_id: input.productId,
    p_variant_id: input.variantId ?? undefined,
    p_tier_code: input.tierCode,
    p_price_cents: priceCents,
    p_min_qty: LAUNCH_MIN_QTY,
  })

  if (error) throw error
  return data as unknown as PriceRow
}
