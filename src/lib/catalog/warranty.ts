import type { Product, ProductCondition, WarrantyOption } from '@/types'

/**
 * Warranty and condition wording — written once, so the product page, cart,
 * order history and admin all say the same thing, and say what place_order()
 * snapshots ('6 Months Part Warranty').
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

/** "Part Warranty" for displays, "Battery Warranty" for batteries, else "Warranty". */
export function warrantyNoun(product: Pick<Product, 'subcategory'>): string {
  if (product.subcategory === 'Displays') return 'Part Warranty'
  if (product.subcategory === 'Batteries') return 'Battery Warranty'
  return 'Warranty'
}

export function durationLabel(months: number): string {
  return `${months} ${months === 1 ? 'Month' : 'Months'}`
}

/** Mirrors the label place_order() writes into order_items.warranty_label_snapshot. */
export function warrantyLabel(product: Pick<Product, 'subcategory'>, option: Pick<WarrantyOption, 'months'>): string {
  return `${durationLabel(option.months)} ${warrantyNoun(product)}`
}

/** True when the customer must choose a warranty for this product. */
export function hasWarrantyChoice(product: Product): boolean {
  return product.warrantyPlan?.type === 'optional_paid' && product.warrantyPlan.options.length > 0
}

/** The option a product opens on: the admin's default, else the first. */
export function defaultWarrantyOption(product: Product): WarrantyOption | undefined {
  if (!hasWarrantyChoice(product)) return undefined
  const options = product.warrantyPlan!.options
  return options.find((o) => o.isDefault) ?? options[0]
}

/**
 * The CURRENT option for an id, looked up on the current product object so a
 * changed add-on price is reflected rather than held in component or cart state.
 */
export function resolveWarrantyOption(product: Product, optionId: string | undefined): WarrantyOption | undefined {
  if (!hasWarrantyChoice(product)) return undefined
  if (optionId) return product.warrantyPlan!.options.find((o) => o.id === optionId)
  return defaultWarrantyOption(product)
}
