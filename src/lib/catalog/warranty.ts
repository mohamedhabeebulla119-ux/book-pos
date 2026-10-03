import type {
  PreOwnedDetails, Product, ProductCondition, ProductVariant, ProductWarranty, WarrantyOption,
} from '@/types'

/**
 * Condition and warranty rules for the storefront — written once, so the
 * product page, card, cart, search, order history and admin all agree with
 * each other and with place_order():
 *
 *   CONDITION  a product WITH variants: the selected variant's own condition
 *              (no row = Brand New; never the product's). A product WITHOUT
 *              variants: its product-level condition.
 *   WARRANTY   the variant's override plan, else the product plan, else none.
 *
 * Nothing here decides a price. Add-on amounts come from
 * product_warranty_options via the live catalog, and the database resolves them
 * again when the order is placed.
 */

export const CONDITION_LABEL: Record<ProductCondition, string> = {
  brand_new: 'Brand New',
  pre_owned: 'Pre-Owned',
  refurbished: 'Refurbished',
}

/** Card wording for a product whose variants are a mix of new and pre-owned. */
export const MIXED_CONDITION_LABEL = 'New & Pre-Owned'

/**
 * The customer-facing condition label: "Brand New", "Pre-Owned · Grade A", or
 * "Pre-Owned" when no grade is set. Refurbished is not offered yet, so it gets
 * no label (null) rather than a badge for a condition the store does not sell.
 */
export function conditionLabel(condition: string | null | undefined, gradeLabel?: string | null): string | null {
  if (condition === 'brand_new') return CONDITION_LABEL.brand_new
  if (condition === 'pre_owned') return gradeLabel ? `${CONDITION_LABEL.pre_owned} · ${gradeLabel}` : CONDITION_LABEL.pre_owned
  return null
}

function hasVariants(product: Product): boolean {
  return Array.isArray(product.variants) && product.variants.length > 0
}

export interface ItemCondition {
  condition: ProductCondition
  preOwned?: PreOwnedDetails
}

/**
 * The condition of the thing being bought: the variant's own for a product
 * with variants, the product's for one without. Undefined until live data has
 * loaded, or when a product with variants has none selected.
 */
export function itemCondition(product: Product, variant?: ProductVariant): ItemCondition | undefined {
  if (hasVariants(product)) {
    if (!variant?.condition) return undefined
    return { condition: variant.condition, preOwned: variant.preOwned }
  }
  if (!product.condition) return undefined
  return { condition: product.condition, preOwned: product.preOwned }
}

/** "Brand New" / "Pre-Owned · Grade A" for one product + (selected) variant. */
export function itemConditionLabel(product: Product, variant?: ProductVariant): string | null {
  const item = itemCondition(product, variant)
  return item ? conditionLabel(item.condition, item.preOwned?.grade?.label) : null
}

/**
 * What a product CARD may truthfully say before a variant is chosen:
 *   - no variants: the product's own condition
 *   - every variant the same label: that label ("Pre-Owned · Grade A" only if
 *     every variant has that grade, else "Pre-Owned")
 *   - new and pre-owned variants mixed: "New & Pre-Owned"
 * Null until live data says, and for conditions the store does not offer.
 */
export function productConditionSummary(product: Product): string | null {
  if (!hasVariants(product)) return itemConditionLabel(product)
  const known = product.variants!.filter((v) => v.condition === 'brand_new' || v.condition === 'pre_owned')
  if (known.length === 0) return null
  const conditions = new Set(known.map((v) => v.condition))
  if (conditions.size > 1) return MIXED_CONDITION_LABEL
  if (conditions.has('brand_new')) return CONDITION_LABEL.brand_new
  const grades = new Set(known.map((v) => v.preOwned?.grade?.label ?? ''))
  return grades.size === 1 ? conditionLabel('pre_owned', [...grades][0] || null) : CONDITION_LABEL.pre_owned
}

/** True when any purchasable form of the product is pre-owned (for card styling). */
export function hasPreOwned(product: Product): boolean {
  return hasVariants(product)
    ? product.variants!.some((v) => v.condition === 'pre_owned')
    : product.condition === 'pre_owned'
}

/**
 * Every condition label a product can be bought in — the product's own and each
 * variant's — so search finds it when ANY variant matches ("pre-owned",
 * "grade a", "brand new", "new & pre-owned").
 */
export function conditionSearchText(product: Product): string {
  const labels = new Set<string>()
  const summary = productConditionSummary(product)
  if (summary) labels.add(summary)
  for (const variant of product.variants ?? []) {
    const label = itemConditionLabel(product, variant)
    if (label) labels.add(label)
  }
  return [...labels].join(' ').toLowerCase()
}

// ---------------------------------------------------------------------------
// Warranty
// ---------------------------------------------------------------------------

/** "Part Warranty" for displays, "Battery Warranty" for batteries, else "Warranty". */
export function warrantyNoun(product: { subcategory?: string }): string {
  if (product.subcategory === 'Displays') return 'Part Warranty'
  if (product.subcategory === 'Batteries') return 'Battery Warranty'
  return 'Warranty'
}

export function durationLabel(months: number): string {
  return `${months} ${months === 1 ? 'Month' : 'Months'}`
}

/** Mirrors the label place_order() writes into order_items.warranty_label_snapshot. */
export function warrantyLabel(product: { subcategory?: string }, option: Pick<WarrantyOption, 'months'>): string {
  return `${durationLabel(option.months)} ${warrantyNoun(product)}`
}

/** The plan in force: the variant's override, else the product's. Mirrors place_order(). */
export function effectiveWarrantyPlan(product: Product, variant?: ProductVariant): ProductWarranty | undefined {
  return variant?.warrantyPlan ?? product.warrantyPlan
}

/** True when the customer must choose a warranty for this product/variant. */
export function hasWarrantyChoice(product: Product, variant?: ProductVariant): boolean {
  const plan = effectiveWarrantyPlan(product, variant)
  return plan?.type === 'optional_paid' && plan.options.length > 0
}

/** True when ANY variant (or the product) needs a warranty choice — cards route to the page. */
export function anyWarrantyChoice(product: Product): boolean {
  if (hasWarrantyChoice(product)) return true
  return (product.variants ?? []).some((v) => hasWarrantyChoice(product, v))
}

/** The option the item opens on: the plan's default, else its first option. */
export function defaultWarrantyOption(product: Product, variant?: ProductVariant): WarrantyOption | undefined {
  if (!hasWarrantyChoice(product, variant)) return undefined
  const options = effectiveWarrantyPlan(product, variant)!.options
  return options.find((o) => o.isDefault) ?? options[0]
}

/**
 * The CURRENT option for an id within the plan in force for this variant, so a
 * changed add-on price is reflected and an option of another plan never applies.
 * Without an id: the default.
 */
export function resolveWarrantyOption(
  product: Product,
  variant: ProductVariant | undefined,
  optionId: string | undefined,
): WarrantyOption | undefined {
  if (!hasWarrantyChoice(product, variant)) return undefined
  if (optionId) return effectiveWarrantyPlan(product, variant)!.options.find((o) => o.id === optionId)
  return defaultWarrantyOption(product, variant)
}
