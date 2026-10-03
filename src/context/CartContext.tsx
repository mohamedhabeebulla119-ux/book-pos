"use client"

import React, { createContext, useCallback, useContext, useState, useEffect } from 'react'
import { CartItem, Product, ProductVariant, WarrantyOption } from '@/types'
import { useCatalogProducts, resolveWarrantyOption, warrantyLabel } from '@/lib/catalog'

/** How a cart line's warranty currently stands, resolved against the live catalog. */
export interface CartLineWarranty {
  label: string
  months: number
  /** Current add-on in rupees (0 when included). */
  addOn: number
  /** True when the chosen option has since been withdrawn by the store. */
  unavailable: boolean
}

interface CartContextType {
  cart: CartItem[]
  addToCart: (product: Product, variant?: ProductVariant, quantity?: number, warranty?: WarrantyOption) => void
  removeFromCart: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  /** Empties the cart — after an order has been placed. */
  clearCart: () => void
  /** The line's chosen warranty, re-resolved against the live catalog; null when it has none. */
  warrantyFor: (item: CartItem) => CartLineWarranty | null
  /**
   * The current unit price for a line — product price plus any warranty
   * add-on — resolved from the live catalog.
   *
   * Use this instead of `item.product.price` / `item.variant.price` anywhere a
   * cart price is displayed or summed — see the note on the provider.
   */
  unitPrice: (item: CartItem) => number
  cartTotal: number
  cartCount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

/**
 * A cart line's identity: the database product id, the variant, and the chosen
 * warranty. Never the product name — a Brand New and a Pre-Owned listing of the
 * same model are different products (different ids), so they are always
 * separate lines, as are two warranty choices on the same product.
 */
export function cartLineId(product: Product, variant?: ProductVariant, warranty?: WarrantyOption): string {
  const baseId = variant ? `${product.id}-${variant.id}` : product.id
  return warranty ? `${baseId}~w${warranty.id}` : baseId
}

/**
 * The cart stores whole Product and ProductVariant objects in localStorage, so
 * every line carries the price that was on screen when it was added. Reading
 * that stored number back is how the cart came to disagree with the product
 * card and the detail page after an administrator changed a price — and it made
 * localStorage a de-facto price source, which it must never be.
 *
 * The stored objects are still the right place for a line's identity and its
 * display details (name, image, colour), because they have to survive a product
 * being unpublished. Only the PRICE is re-resolved, against the same catalog
 * snapshot every other customer-facing surface reads.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [isMounted, setIsMounted] = useState(false)
  // Subscribes the cart to the catalog store, so a revalidated price re-renders
  // the badge and the totals without any cart-specific refresh mechanism.
  const products = useCatalogProducts()

  // Load from local storage
  useEffect(() => {
    setIsMounted(true)
    const savedCart = localStorage.getItem('apple-store-cart')
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (e) {
        console.error('Failed to parse cart')
      }
    }
  }, [])

  // Save to local storage
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('apple-store-cart', JSON.stringify(cart))
    }
  }, [cart, isMounted])

  const addToCart = (product: Product, variant?: ProductVariant, quantity = 1, warranty?: WarrantyOption) => {
    setCart(prev => {
      const cartItemId = cartLineId(product, variant, warranty)
      
      const existingItem = prev.find(item => item.id === cartItemId)
      if (existingItem) {
        return prev.map(item =>
          item.id === cartItemId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, {
        id: cartItemId, product, variant, quantity,
        ...(warranty && {
          warrantyOptionId: warranty.id,
          warrantySnapshot: { months: warranty.months, label: warrantyLabel(product, warranty), addOn: warranty.addOn },
        }),
      }]
    })
  }

  const clearCart = () => setCart([])

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return
    setCart(prev =>
      prev.map(item => (item.id === id ? { ...item, quantity } : item))
    )
  }

  /**
   * Live unit price for one line.
   *
   * Falls back to the stored snapshot only when the catalog can no longer
   * resolve the product or variant — an unpublished product or a removed
   * variant — so a line never renders without a price. Variant ids survive the
   * live overlay (they are keyed back through legacy_key), so a variant line
   * resolves to its own current price rather than the product-level one.
   */
  const warrantyFor = useCallback(
    (item: CartItem): CartLineWarranty | null => {
      if (!item.warrantyOptionId) return null
      const snapshot = item.warrantySnapshot
      const live = products.find((p) => p.id === item.product.id)
      // Until warranty data has loaded (or if it could not), describe the line
      // as chosen. The amount is still re-resolved by place_order().
      if (!live || !(live.warrantyPlan || live.variants?.some((v) => v.warrantyPlan))) {
        return snapshot ? { ...snapshot, unavailable: false } : null
      }
      // The line's OWN variant decides which plan the option must belong to.
      const liveVariant = item.variant ? live.variants?.find((v) => v.id === item.variant!.id) : undefined
      const option = resolveWarrantyOption(live, liveVariant, item.warrantyOptionId)
      if (!option) {
        return {
          label: snapshot?.label ?? 'Warranty',
          months: snapshot?.months ?? 0,
          addOn: 0,
          unavailable: true,
        }
      }
      return { label: warrantyLabel(live, option), months: option.months, addOn: option.addOn, unavailable: false }
    },
    [products]
  )

  const unitPrice = useCallback(
    (item: CartItem): number => {
      const stored = item.variant?.price ?? item.product.price
      const live = products.find((p) => p.id === item.product.id)
      const addOn = warrantyFor(item)?.addOn ?? 0
      if (!live) return stored + addOn

      if (item.variant) {
        const liveVariant = live.variants?.find((v) => v.id === item.variant!.id)
        return (liveVariant ? liveVariant.price : stored) + addOn
      }
      return live.price + addOn
    },
    [products, warrantyFor]
  )

  const cartTotal = cart.reduce(
    (total, item) => total + unitPrice(item) * item.quantity,
    0
  )

  const cartCount = cart.reduce((count, item) => count + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, warrantyFor, unitPrice, cartTotal, cartCount }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
