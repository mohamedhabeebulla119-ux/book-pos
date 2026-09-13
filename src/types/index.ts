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
}

export interface CartItem {
  id: string
  product: Product
  variant?: ProductVariant
  quantity: number
}
