import type { Product, ProductVariant } from '@/types'

/**
 * The single price resolver for the storefront.
 *
 * Before this existed the price formula was written inline in two places:
 *
 *   ProductCard   minPrice      = min(variant prices)   // category + search cards
 *   product/[id]  currentPrice  = selectedVariant.price // detail page
 *
 * Those agree on the bundled catalog only because every product happens to list
 * its cheapest variant first. The moment an admin raises one variant's price the
 * two formulas return different numbers, and the card looks "stale" while the
 * detail page looks correct — even though both are reading the same live
 * snapshot from the catalog store.
 *
 * Keeping the arithmetic here means card and detail can never drift apart again.
 * This adds no second pricing system: the numbers still come from
 * product_prices -> liveCatalog -> the catalog store, and this module only
 * chooses which of the already-resolved prices to show.
 */

/** True when the product is priced per variant rather than at product level. */
export function hasVariantPricing(product: Product): boolean {
  return Array.isArray(product.variants) && product.variants.length > 0
}

/**
 * The variant a product opens on, and the one the card's price refers to.
 *
 * The cheapest variant, so that the "From" price on a card always matches what
 * the detail page shows when it opens. Ties keep the catalog's own order.
 */
export function defaultVariant(product: Product): ProductVariant | undefined {
  if (!hasVariantPricing(product)) return undefined
  return product.variants!.reduce((cheapest, variant) =>
    variant.price < cheapest.price ? variant : cheapest,
  )
}

/**
 * Resolves the variant currently in effect: the one the customer picked, or the
 * default. Always looked up from the CURRENT product object, so a live price
 * update is reflected rather than held in stale component state.
 */
export function resolveVariant(
  product: Product,
  selectedVariantId: string | undefined,
): ProductVariant | undefined {
  if (!hasVariantPricing(product)) return undefined
  if (selectedVariantId) {
    const match = product.variants!.find((v) => v.id === selectedVariantId)
    if (match) return match
  }
  return defaultVariant(product)
}

/** The price shown when no variant has been chosen — cards, listings, search. */
export function displayPrice(product: Product): number {
  return defaultVariant(product)?.price ?? product.price
}

/** The price for an explicit selection, falling back to the product price. */
export function selectedPrice(product: Product, variant: ProductVariant | undefined): number {
  return variant?.price ?? product.price
}

/**
 * Whether displayPrice() is the customer's own wholesale VIP price — the same
 * choice of variant, so the "VIP Price" label always describes the number
 * beside it. Label only; the UI also requires a database-confirmed VIP.
 */
export function displayPriceIsVip(product: Product): boolean {
  const variant = defaultVariant(product)
  return Boolean(variant ? variant.isVipPrice : product.isVipPrice)
}

/** Whether selectedPrice() is the customer's own wholesale VIP price. */
export function selectedPriceIsVip(product: Product, variant: ProductVariant | undefined): boolean {
  return Boolean(variant ? variant.isVipPrice : product.isVipPrice)
}
