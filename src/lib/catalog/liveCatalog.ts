import type { Product, ProductVariant, ProductCategory, ProductSubcategory, WarrantyInfo } from '@/types'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { resolveCustomerType } from '@/lib/customer/profile'
import type { ResolvedTier } from './types'

/**
 * Live catalog overlay.
 *
 * Reads the fields an admin can change from Supabase and lays them over the
 * bundled catalog: name, description, model, subcategory, warranty, lifecycle
 * status, specifications, image references, variant details, stock, price and
 * whether the product is still published.
 *
 * Prices come exclusively from product_prices via the my_effective_prices view,
 * which is `security_invoker`, so RLS applies to the caller and a retail
 * customer's query physically cannot return a wholesale_vip row. There is no
 * price column on products and none is introduced here.
 *
 * Image FILES are not fetched — product_images.path still holds the same
 * /images/... strings that ship in the APK. Supabase Storage migration is a
 * separate phase.
 */

/** Money crosses the wire as bigint minor units. Rupees = cents / 100. */
export function centsToRupees(cents: number): number {
  return cents / 100
}

interface LivePriceRow {
  product_id: string
  variant_id: string | null
  tier_code: string
  price_cents: number
}

/**
 * Both tiers for one product or variant, kept apart so the resolver can choose.
 *
 * Previously the fetch collapsed every returned row into a single number and
 * trusted my_effective_prices to have handed back exactly one row per
 * product/variant. That trust holds only for a caller whose RLS limits them to
 * one tier. A staff, admin or owner account reads EVERY tier through the
 * "product_prices staff read all" policy, and the view's
 * `order by (tier_code = 'wholesale_vip') desc` then deliberately prefers the
 * VIP row — so anyone with a role saw VIP prices on the storefront regardless
 * of their own customer_type. Keeping the tiers separate is what makes the
 * choice explicit instead of incidental.
 */
export interface TierPrices {
  retail?: number
  wholesale_vip?: number
}

/**
 * THE customer-facing price rule. Every price the storefront shows comes
 * through here.
 *
 *   wholesale_vip -> the VIP price, falling back to retail when none is set
 *   retail        -> the retail price, never the VIP one
 *
 * The tier argument is the customer's own profiles.customer_type. It is never
 * inferred from which rows came back, from the /wholesale route, or from the
 * localStorage experience preference.
 */
export function resolveTierPrice(
  prices: TierPrices | undefined,
  tier: ResolvedTier,
): number | undefined {
  if (!prices) return undefined
  if (tier === 'wholesale_vip') return prices.wholesale_vip ?? prices.retail
  return prices.retail
}

/** Editable product fields, as stored. */
interface ProductOverlay {
  name: string
  description: string
  model: string | null
  subcategory: string
  lifecycle_status: string | null
  is_new: boolean
  warranty_text: string | null
  warranty_status: string | null
  warranty_duration: string | null
  warranty_months: number | null
  warranty_coverage: string | null
  rating: number | null
  reviews_count: number
  stock: number
}

interface VariantOverlay {
  legacyKey: string
  name: string
  color: string | null
  colorCode: string | null
  storage: string | null
  sortOrder: number
}

export interface LiveCatalogData {
  activeIds: Set<string>
  product: Map<string, ProductOverlay>
  variants: Map<string, VariantOverlay[]>
  specs: Map<string, Record<string, string>>
  images: Map<string, string[]>
  /** product_id -> both tiers, in rupees. Resolved by resolveTierPrice(). */
  productPrice: Map<string, TierPrices>
  /** `${product_id}:${legacy_key}` -> both tiers, in rupees */
  variantPrice: Map<string, TierPrices>
  /**
   * Curated featured ids in display order, or null when the merchandising
   * query failed or returned nothing — in which case the bundled selection is
   * used. Featured is deliberately non-fatal: a merchandising hiccup must not
   * cost the customer live prices.
   */
  featuredIds: string[] | null
  /**
   * The tier this catalog was resolved AT, read from the caller's own profile —
   * not guessed from the price rows that happened to come back.
   */
  tier: ResolvedTier
}

function isTier(value: string): value is ResolvedTier {
  return value === 'retail' || value === 'wholesale_vip'
}

/**
 * The caller's own pricing tier, read from public.profiles.
 *
 * profiles.customer_type is the single authority for pricing, so it is asked
 * directly rather than inferred from the price rows. An anonymous visitor has
 * no profile and resolves to retail, exactly as
 * private.current_customer_type() does inside the database.
 *
 * Fails CLOSED: if the session or the profile cannot be read, the caller is
 * treated as retail. Showing a VIP price to someone we could not confirm is a
 * worse failure than showing a retail price to a VIP, who will see the correct
 * price on the next load.
 */
async function fetchCallerTier(): Promise<ResolvedTier> {
  const supabase = getSupabaseClient()

  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return 'retail'

  const { data, error } = await supabase
    .from('profiles')
    .select('customer_type, vip_expires_at')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return 'retail'

  // Same rule the profile page and the auth context use — written once.
  return resolveCustomerType(data)
}

/**
 * Reads the live catalog. Throws on failure so the caller can fall back to the
 * bundled catalog rather than rendering a half-empty store.
 */
export async function fetchLiveCatalog(): Promise<LiveCatalogData> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured for this build.')
  }

  const supabase = getSupabaseClient()

  const [tier, productsResult, variantsResult, specsResult, imagesResult, pricesResult, featuredResult] =
    await Promise.all([
      fetchCallerTier(),
      supabase
        .from('products')
        .select(
          'id, name, description, model, subcategory, lifecycle_status, is_new, stock, rating, reviews_count, warranty_text, warranty_status, warranty_duration, warranty_months, warranty_coverage',
        )
        .eq('is_active', true),
      supabase
        .from('product_variants')
        .select('id, product_id, legacy_key, name, color, color_code, storage, sort_order')
        .order('sort_order', { ascending: true }),
      supabase.from('product_specs').select('product_id, label, value, position').order('position', { ascending: true }),
      supabase.from('product_images').select('product_id, path, position').order('position', { ascending: true }),
      supabase.from('my_effective_prices').select('product_id, variant_id, tier_code, price_cents'),
      supabase
        .from('featured_products')
        .select('product_id, position')
        .eq('slot', 'home')
        .eq('is_active', true)
        .order('position', { ascending: true }),
    ])

  if (productsResult.error) throw productsResult.error
  if (variantsResult.error) throw variantsResult.error
  if (specsResult.error) throw specsResult.error
  if (imagesResult.error) throw imagesResult.error
  if (pricesResult.error) throw pricesResult.error
  // featuredResult is intentionally NOT thrown on — see featuredIds above.

  const activeIds = new Set<string>()
  const product = new Map<string, ProductOverlay>()
  for (const row of productsResult.data ?? []) {
    activeIds.add(row.id)
    product.set(row.id, row as ProductOverlay)
  }

  // Variant ids are UUIDs in the database but 'v1', 'v2' … in the bundled data.
  // legacy_key is what bridges the two, which is also what keeps already-saved
  // cart lines resolvable.
  const variantKeyById = new Map<string, { productId: string; legacyKey: string }>()
  const variants = new Map<string, VariantOverlay[]>()
  for (const row of variantsResult.data ?? []) {
    if (!row.legacy_key) continue
    variantKeyById.set(row.id, { productId: row.product_id, legacyKey: row.legacy_key })

    const list = variants.get(row.product_id) ?? []
    list.push({
      legacyKey: row.legacy_key,
      name: row.name,
      color: row.color,
      colorCode: row.color_code,
      storage: row.storage,
      sortOrder: row.sort_order,
    })
    variants.set(row.product_id, list)
  }
  for (const list of variants.values()) list.sort((a, b) => a.sortOrder - b.sortOrder)

  // Specification order is data: the UI renders them in the stored order.
  const specs = new Map<string, Record<string, string>>()
  for (const row of specsResult.data ?? []) {
    const record = specs.get(row.product_id) ?? {}
    record[row.label] = row.value
    specs.set(row.product_id, record)
  }

  const images = new Map<string, string[]>()
  for (const row of imagesResult.data ?? []) {
    const list = images.get(row.product_id) ?? []
    list.push(row.path)
    images.set(row.product_id, list)
  }

  const productPrice = new Map<string, TierPrices>()
  const variantPrice = new Map<string, TierPrices>()

  /** Records a row under its OWN tier, so neither tier can overwrite the other. */
  function record(map: Map<string, TierPrices>, key: string, row: LivePriceRow) {
    if (!isTier(row.tier_code)) return
    const entry = map.get(key) ?? {}
    entry[row.tier_code] = centsToRupees(row.price_cents)
    map.set(key, entry)
  }

  for (const row of (pricesResult.data ?? []) as LivePriceRow[]) {
    if (row.variant_id === null) {
      record(productPrice, row.product_id, row)
      continue
    }

    const mapped = variantKeyById.get(row.variant_id)
    if (mapped) {
      record(variantPrice, `${mapped.productId}:${mapped.legacyKey}`, row)
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    // Diagnostic only, and never in the shipped APK: shows which tier the
    // storefront resolved and whether VIP rows were even visible to this caller.
    const vipRows = (pricesResult.data ?? []).filter(
      (row) => (row as LivePriceRow).tier_code === 'wholesale_vip',
    ).length
    console.info(
      `[catalog] tier=${tier} priceRows=${pricesResult.data?.length ?? 0} vipRowsVisible=${vipRows}`,
    )
  }

  const featuredRows = featuredResult.error ? null : featuredResult.data
  const featuredIds =
    featuredRows && featuredRows.length > 0 ? featuredRows.map((row) => row.product_id) : null

  return { activeIds, product, variants, specs, images, productPrice, variantPrice, featuredIds, tier }
}

function buildWarrantyInfo(overlay: ProductOverlay, fallback?: WarrantyInfo): WarrantyInfo | undefined {
  if (!overlay.warranty_status) return fallback
  return {
    status: overlay.warranty_status === 'none' ? 'none' : 'active',
    duration: overlay.warranty_duration ?? fallback?.duration ?? '',
    months: overlay.warranty_months ?? fallback?.months ?? 0,
    coverage: overlay.warranty_coverage ?? fallback?.coverage ?? '',
  }
}

/**
 * Applies live data to the bundled catalog.
 *
 * Merges onto the bundled objects rather than rebuilding them, so any field the
 * overlay does not supply (`featured`, compatibility, category) survives
 * untouched and the UI cannot regress.
 *
 * A product with no live price keeps its bundled price. That is a last-known
 * value shipped in the APK, not a fabricated one — nothing here ever invents a
 * number, and the unpriced replacement parts are not in this list at all.
 */
export function applyLiveCatalog(
  staticProducts: readonly Product[],
  live: LiveCatalogData,
): Product[] {
  const merged: Product[] = []

  for (const product of staticProducts) {
    // Unpublished in the database: hide it from the storefront.
    if (!live.activeIds.has(product.id)) continue

    const overlay = live.product.get(product.id)
    // Resolved against the customer's OWN tier, never against whichever row
    // the database happened to return first.
    const livePrice = resolveTierPrice(live.productPrice.get(product.id), live.tier)

    // Variants come from the database when it has them, keyed back to the
    // bundled 'v1'/'v2' ids via legacy_key so cart lines stay resolvable.
    let variants: ProductVariant[] | undefined = product.variants
    const liveVariants = live.variants.get(product.id)

    if (liveVariants && liveVariants.length > 0) {
      const bundledByKey = new Map((product.variants ?? []).map((v) => [v.id, v]))
      variants = liveVariants.map((lv) => {
        const bundled = bundledByKey.get(lv.legacyKey)
        // Precedence matters: the live product-level price must beat the
        // BUNDLED variant price, otherwise a variant with no price row of its
        // own keeps showing a stale number shipped in the APK even though the
        // database has a newer one. Bundled values are the last resort only.
        const price =
          resolveTierPrice(live.variantPrice.get(`${product.id}:${lv.legacyKey}`), live.tier) ??
          livePrice ??
          bundled?.price ??
          product.price
        return {
          id: lv.legacyKey,
          name: lv.name,
          price,
          color: lv.color ?? undefined,
          colorCode: lv.colorCode ?? undefined,
          storage: lv.storage ?? undefined,
        }
      })
    } else if (product.variants && product.variants.length > 0) {
      variants = product.variants.map((variant) => {
        const price = resolveTierPrice(live.variantPrice.get(`${product.id}:${variant.id}`), live.tier)
        return price === undefined ? variant : { ...variant, price }
      })
    }

    const liveSpecs = live.specs.get(product.id)
    const liveImages = live.images.get(product.id)

    merged.push({
      ...product,
      name: overlay?.name ?? product.name,
      description: overlay?.description ?? product.description,
      model: overlay?.model ?? product.model,
      subcategory: (overlay?.subcategory as ProductSubcategory | undefined) ?? product.subcategory,
      category: product.category as ProductCategory,
      status: (overlay?.lifecycle_status as Product['status']) ?? product.status,
      isNew: overlay?.is_new ?? product.isNew,
      rating: overlay?.rating ?? product.rating,
      reviewsCount: overlay?.reviews_count ?? product.reviewsCount,
      warranty: overlay?.warranty_text ?? product.warranty,
      warrantyInfo: overlay ? buildWarrantyInfo(overlay, product.warrantyInfo) : product.warrantyInfo,
      specifications: liveSpecs && Object.keys(liveSpecs).length > 0 ? liveSpecs : product.specifications,
      images: liveImages && liveImages.length > 0 ? liveImages : product.images,
      price: livePrice ?? product.price,
      stock: overlay?.stock ?? product.stock,
      variants,
    })
  }

  return merged
}

/**
 * Resolves featured ids to products, in curated order.
 *
 * Ids are resolved against the catalog, so the two duplicated ids
 * (iphone-17-pro-max, macbook-pro-16) yield the authoritative deviceData
 * definitions. An id that no longer resolves — unpublished, or removed from the
 * bundle — is skipped rather than rendering a gap.
 */
export function resolveFeatured(
  products: readonly Product[],
  featuredIds: readonly string[],
): Product[] {
  const byId = new Map(products.map((p) => [p.id, p]))
  const resolved: Product[] = []
  for (const id of featuredIds) {
    const product = byId.get(id)
    if (product) resolved.push(product)
  }
  return resolved
}
