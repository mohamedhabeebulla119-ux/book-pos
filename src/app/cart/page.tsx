"use client"

import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, cartTotal } = useCart()

  if (cart.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <ShoppingBag size={32} className="text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2 tracking-tight">Your bag is empty.</h2>
          <p className="text-muted-foreground mb-8">
            Check out our latest products and accessories.
          </p>
          <Link href="/categories">
            <Button>Continue Shopping</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-32">
      <Header />
      
      <main className="px-4 py-6">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Review your bag.</h1>
        
        <div className="space-y-6">
          <AnimatePresence>
            {cart.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 border-b border-border pb-6 overflow-hidden"
              >
                <div className="w-full sm:w-32 aspect-square bg-muted/30 rounded-2xl p-4 flex items-center justify-center shrink-0">
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal"
                  />
                </div>
                
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg leading-tight">{item.product.name}</h3>
                      {item.variant && (
                        <p className="text-sm text-muted-foreground mt-1">{item.variant.name}</p>
                      )}
                    </div>
                    <div className="font-semibold text-lg whitespace-nowrap ml-4">
                      ${(item.variant?.price || item.product.price) * item.quantity}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center bg-muted rounded-full px-1 py-1">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-background disabled:opacity-50 transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-background transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-primary hover:text-red-500 transition-colors p-2"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Order Summary */}
        <div className="mt-8 pt-6">
          <div className="flex justify-between items-center mb-4 text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-medium text-foreground">${cartTotal}</span>
          </div>
          <div className="flex justify-between items-center mb-6 text-muted-foreground">
            <span>Shipping</span>
            <span className="font-medium text-foreground">Free</span>
          </div>
          <div className="flex justify-between items-center text-xl font-bold pt-4 border-t border-border">
            <span>Total</span>
            <span>${cartTotal}</span>
          </div>
        </div>
      </main>

      {/* Checkout Action */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border px-4 py-4 pb-safe">
        <div className="max-w-md mx-auto">
          <Button fullWidth size="lg">
            Proceed to Checkout
          </Button>
        </div>
      </div>
    </div>
  )
}
