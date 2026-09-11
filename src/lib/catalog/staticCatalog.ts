import type { Product } from '@/types'
import { allDevices } from '@/data/deviceData'
import { products as mockProducts } from '@/data/mockData'

/**
 * The bundled catalog — the single assembly point for the static product list.
 *
 * This replaces four byte-identical copies of the same expression that used to
 * live in product/[id]/page.tsx, product/[id]/layout.tsx, search/page.tsx and
 * wishlist/page.tsx.
 *
 * Ordering is load-bearing: `allDevices` is spread first and mockData entries
 * are only kept when their id does not already exist, which is what makes
 * deviceData authoritative for the two duplicated ids (iphone-17-pro-max and
 * macbook-pro-16). The two mockData definitions are dropped.
 *
 * This list is what ships inside the APK. It renders instantly, works with no
 * network, and is the fallback whenever the Supabase query fails.
 */
const STATIC_PRODUCTS: Product[] = [
  ...allDevices,
  ...mockProducts.filter((p) => !allDevices.some((d) => d.id === p.id)),
]

/**
 * Generated replacement parts are deliberately NOT part of this list.
 *
 * Their prices in src/data/iphoneModels.ts (379, 119, 69 …) are unconfirmed and
 * almost certainly not rupees, so they are seeded into Supabase as inactive with
 * no price rows. They remain reachable only through the dedicated
 * /categories/replacement-parts/{displays,batteries}/[model] routes, exactly as
 * before — nothing about their handling changes in this phase.
 */

/**
 * The bundled featured selection, and the fallback whenever Supabase is
 * unavailable.
 *
 * Derived from mockData's `featured` flag, which is what the homepage carousel
 * read directly before this phase, so the selection and its order are preserved
 * exactly: iphone-17-pro-max, macbook-pro-16, airpods-pro-2,
 * apple-watch-ultra-2, part-iphone-15-pro-display.
 *
 * Only the IDS come from mockData. The product objects themselves are resolved
 * through the catalog, so the two duplicated ids still resolve to the
 * authoritative deviceData definitions.
 */
const STATIC_FEATURED_IDS: readonly string[] = mockProducts
  .filter((p) => p.featured)
  .map((p) => p.id)

/** The bundled catalog. Same contents and order the app shipped with. */
export function getStaticProducts(): readonly Product[] {
  return STATIC_PRODUCTS
}

/** Bundled featured selection, used until (or instead of) the live query. */
export function getStaticFeaturedIds(): readonly string[] {
  return STATIC_FEATURED_IDS
}

/** Build-time safe lookup, used by generateStaticParams. */
export function getStaticProductIds(): string[] {
  return STATIC_PRODUCTS.map((p) => p.id)
}
