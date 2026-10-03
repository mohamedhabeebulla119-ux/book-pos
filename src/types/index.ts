export type ProductCategory = 
  | 'iPhone'
  | 'iPad'
  | 'Mac'
  | 'Apple Watch'
  | 'AirPods'
  | 'Replacement Parts'
  | 'Accessories'

/**
 * Any category name, including one an administrator created after this build
 * was made.
 *
 * The seven names above are the ones the bundled catalog and the static
 * /categories routes are built around, so they stay spelled out for
 * autocompletion and for the places that special-case them. `(string & {})`
 * widens the type without collapsing that list, which is what lets a product
 * created in the admin panel carry a category this build has never heard of.
 */
export type CategoryName = ProductCategory | (string & {})

export type ProductSubcategory = 
  | 'Displays'
  | 'Batteries'
  | 'Cameras'
  | 'Charging Parts'
  | 'Speakers & Microphones'
  | 'Buttons & Flex Cables'
  | 'Motherboard / IC'
  | 'Cases'
  | 'iPhone Cases'
  | 'Chargers'
  | 'Power Adapters'
  | 'Cables'
  | 'USB-C Cables'
  | 'Screen Protection'
  | 'MagSafe'
  | 'Other Accessories'
  | 'Devices' // for actual Apple products

export interface ProductVariant {
  id: string
  name: string
  price: number
  color?: string
  colorCode?: string
  storage?: string
  /**
   * True only when `price` came from the caller's own wholesale_vip row in
   * my_effective_prices (which RLS withholds from every other caller). Set by
   * the live catalog mapper; a display label only, never a price input.
   */
  isVipPrice?: boolean
}

/**
 * Structured warranty coverage for a product, kept separate from the legacy
 * free-text `warranty` field so it can be edited per-product (duration,
 * coverage, or status — e.g. toggled to 'none') without a UI code change,
 * which is what a future admin portal would manage.
 */
export interface WarrantyInfo {
  status: 'active' | 'none'
  /** Display label, e.g. "1 Year", "6 Months", "2 Years" */
  duration: string
  /** Numeric duration in months, for sorting/logic; 0 when status is 'none' */
  months: number
  coverage: string
}

export interface Product {
  id: string
  name: string
  /** Display name of the category. Not limited to the seven bundled ones. */
  category: CategoryName
  /** Constrained by the products.subcategory CHECK in the database. */
  subcategory: ProductSubcategory
  model?: string
  price: number
  images: string[]
  description: string
  specifications: Record<string, string>
  compatibility?: string[] // e.g., ["iPhone 15 Pro", "iPhone 15 Pro Max"]
  stock: number
  rating: number
  reviewsCount: number
  warranty: string
  warrantyInfo?: WarrantyInfo
  featured?: boolean
  isNew?: boolean
  status?: 'NEW' | 'CURRENT' | 'OLDER'
  variants?: ProductVariant[]
  /**
   * True only when `price` came from the caller's own wholesale_vip row in
   * my_effective_prices (which RLS withholds from every other caller). Set by
   * the live catalog mapper; a display label only, never a price input.
   */
  isVipPrice?: boolean
  /** products.condition. Absent on bundled data, which is all brand new. */
  condition?: ProductCondition
  /** Pre-owned details, only for condition 'pre_owned'. */
  preOwned?: PreOwnedDetails
  /**
   * products.warranty_type + terms + product_warranty_options. Absent until
   * live data loads. (`warranty` above is the older free-text line.)
   */
  warrantyPlan?: ProductWarranty
}

/**
 * products.condition — a dimension of a product, independent of its category
 * (a Pre-Owned iPhone is still in iPhone). 'refurbished' is accepted by the
 * database but not offered in the admin until the business confirms it.
 */
export type ProductCondition = 'brand_new' | 'pre_owned' | 'refurbished'

/** One step of the admin-defined grading scale (public.condition_grades). */
export interface ConditionGrade {
  code: string
  label: string
  description?: string
}

export interface PreOwnedDetails {
  grade?: ConditionGrade
  /** Percent, 0–100. */
  batteryHealth?: number
  cycleCount?: number
  physicalCondition?: string
  accessoriesIncluded?: string
  deviceNotes?: string
}

/**
 *   none          – no warranty
 *   included      – a fixed warranty described by WarrantyInfo and the terms
 *   optional_paid – the customer chooses one of `options`
 */
export type WarrantyType = 'none' | 'included' | 'optional_paid'

/** A product_warranty_options row. `addOn` is in rupees, like Product.price. */
export interface WarrantyOption {
  id: string
  months: number
  addOn: number
  isDefault: boolean
}

export interface ProductWarranty {
  type: WarrantyType
  title?: string
  description?: string
  covered: string[]
  excluded: string[]
  /** Enabled options in display order (RLS hides disabled ones). */
  options: WarrantyOption[]
}

export interface CartItem {
  id: string
  product: Product
  variant?: ProductVariant
  quantity: number
  /** The product_warranty_options id chosen on the product page, if any. */
  warrantyOptionId?: string
  /**
   * What the chosen warranty looked like when it was added — kept so the line
   * can still be described if the option is later withdrawn. Never a price
   * source: the cart re-resolves the add-on from the live catalog, and
   * place_order() resolves it again in the database.
   */
  warrantySnapshot?: { months: number; label: string; addOn: number }
}
