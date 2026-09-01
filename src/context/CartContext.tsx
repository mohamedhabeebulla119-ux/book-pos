"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { CartItem, Product, ProductVariant } from '@/types'

interface CartContextType {
  cart: CartItem[]
  addToCart: (product: Product, variant?: ProductVariant, quantity?: number) => void
  removeFromCart: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  cartTotal: number
  cartCount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [isMounted, setIsMounted] = useState(false)

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

  const addToCart = (product: Product, variant?: ProductVariant, quantity = 1) => {
    setCart(prev => {
      // Create a unique ID combining product ID and variant ID (if any)
      const cartItemId = variant ? `${product.id}-${variant.id}` : product.id
      
      const existingItem = prev.find(item => item.id === cartItemId)
      if (existingItem) {
        return prev.map(item =>
          item.id === cartItemId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, { id: cartItemId, product, variant, quantity }]
    })
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return
    setCart(prev =>
      prev.map(item => (item.id === id ? { ...item, quantity } : item))
    )
  }

  const cartTotal = cart.reduce(
    (total, item) => total + (item.variant?.price || item.product.price) * item.quantity,
    0
  )

  const cartCount = cart.reduce((count, item) => count + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, cartTotal, cartCount }}
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
