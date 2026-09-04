export type ProductCategory = 
  | 'iPhone'
  | 'iPad'
  | 'Mac'
  | 'Apple Watch'
  | 'AirPods'
  | 'Replacement Parts'
  | 'Accessories'

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

export interface Product {
  id: string
  name: string
  category: ProductCategory
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
