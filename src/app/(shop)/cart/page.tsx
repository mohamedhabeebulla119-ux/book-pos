"use client"
import { formatPrice } from '@/utils/formatPrice'

import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeading } from '@/components/ui/Heading'
import { useCart } from '@/context/CartContext'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react'

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, cartTotal } = useCart()

  if (cart.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <EmptyState
          icon={ShoppingBag}
          title="Your bag is empty."
          subtitle="Check out our latest products and accessories."
          ctaLabel="Continue Shopping"
          ctaHref="/categories"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-32">
      <Header />

      <main className="px-4 py-6">
        <PageHeading title="Review your bag." className="mb-8" />
        
        <div className="space-y-6">
          <AnimatePresence>
            {cart.map((item) => {
              const theme = getCategoryTheme(item.product.category)
              return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 border-b border-border pb-6 overflow-hidden"
              >
                <div className={`w-full sm:w-32 aspect-square ${theme.well} rounded-2xl p-4 flex items-center justify-center shrink-0 ${theme.glow}`}>
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
                      {formatPrice((item.variant?.price || item.product.price) * item.quantity)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center bg-muted rounded-full px-1 py-1">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label="Decrease quantity"
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-background active:scale-90 disabled:opacity-50 transition-all"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-background active:scale-90 transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      aria-label="Remove item"
                      className="text-primary hover:text-red-500 active:scale-90 transition-all p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Order Summary */}
        <div className="mt-8 pt-6">
          <div className="flex justify-between items-center mb-4 text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-medium text-foreground">{formatPrice(cartTotal)}</span>
          </div>
          <div className="flex justify-between items-center mb-6 text-muted-foreground">
            <span>Shipping</span>
            <span className="font-medium text-foreground">Free</span>
          </div>
          <div className="flex justify-between items-center text-xl font-bold pt-4 border-t border-border">
            <span>Total</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>
        </div>
      </main>

      {/* Checkout Action */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border px-4 py-4 pb-safe shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.4)]">
        <div className="max-w-md mx-auto">
          <Button fullWidth size="lg" className="h-14 rounded-full text-base font-semibold bg-gradient-cta text-white border-0 shadow-[0_10px_28px_-8px_rgba(99,60,255,0.5)]">
            Proceed to Checkout <ArrowRight size={18} className="ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
