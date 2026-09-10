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
        <PageHeading title="Review your bag." className="mb-6" />

        <div className="space-y-3.5">
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
                className="flex flex-row gap-3.5 bg-surface border border-mint/80 dark:border-border rounded-[26px] p-3 shadow-card overflow-hidden"
              >
                <div className={`w-24 sm:w-32 aspect-square ${theme.well} rounded-[20px] p-3 flex items-center justify-center shrink-0 border border-mint/60 dark:border-border`}>
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal"
                  />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="mb-2">
                    <h3 className="font-semibold text-[15px] leading-tight line-clamp-2">{item.product.name}</h3>
                    {item.variant && (
                      <p className="text-xs text-muted-foreground mt-1">{item.variant.name}</p>
                    )}
                    <div className="font-bold text-base tracking-tight mt-1.5">
                      {formatPrice((item.variant?.price || item.product.price) * item.quantity)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center bg-primary-soft border border-mint-deep rounded-full px-1 py-1">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label="Decrease quantity"
                        className="w-8 h-8 rounded-full text-primary flex items-center justify-center hover:bg-card active:scale-90 disabled:opacity-40 transition-all"
                      >
                        <Minus size={15} />
                      </button>
                      <span className="w-8 text-center font-semibold text-sm text-foreground">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="w-8 h-8 rounded-full text-primary flex items-center justify-center hover:bg-card active:scale-90 transition-all"
                      >
                        <Plus size={15} />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      aria-label="Remove item"
                      className="text-muted-foreground hover:text-red-500 active:scale-90 transition-all p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        <div className="mt-6 bg-surface border border-mint/80 dark:border-border rounded-[26px] p-5 shadow-card">
          <div className="flex justify-between items-center mb-3 text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-semibold text-foreground">{formatPrice(cartTotal)}</span>
          </div>
          <div className="flex justify-between items-center mb-4 text-sm text-muted-foreground">
            <span>Shipping</span>
            <span className="font-semibold text-primary">Free</span>
          </div>
          <div className="flex justify-between items-center text-lg font-bold pt-4 border-t border-mint-deep">
            <span>Total</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>
        </div>
      </main>

      {/* Checkout Action — floats above the bottom navigation */}
      <div
        className="fixed left-3 right-3 z-40 mx-auto w-auto max-w-[456px] rounded-[26px] border border-white/60 dark:border-white/8 bg-glass shadow-nav p-3"
        style={{ bottom: 'calc(var(--nav-offset) + 0.5rem)' }}
      >
        <Button fullWidth size="lg" className="h-13 text-[15px]">
          Proceed to Checkout <ArrowRight size={18} className="ml-1.5" />
        </Button>
      </div>
    </div>
  )
}
