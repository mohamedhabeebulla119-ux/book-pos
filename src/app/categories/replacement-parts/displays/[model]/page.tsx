"use client"

import { use, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { iphoneModels } from '@/data/iphoneModels'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartContext'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Star } from 'lucide-react'
import Link from 'next/link'

export default function DisplayDetailsPage({ params }: { params: Promise<{ model: string }> }) {
  const resolvedParams = use(params)
  const model = iphoneModels.find(m => m.id === resolvedParams.model)
  const { addToCart } = useCart()
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  if (!model) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <h2 className="text-2xl font-bold mb-2">Display Not Found</h2>
          <p className="text-muted-foreground mb-6">The display for this model doesn't exist.</p>
          <Link href="/categories/replacement-parts/displays">
            <Button>View All Displays</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Construct a cart-compatible product object from the model
  const cartProduct = {
    id: `part-display-${model.id}`,
    category: 'Replacement Parts',
    subcategory: 'Displays',
    model: model.name,
    ...model.display,
    images: [model.display.image]
  }

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header />
      
      <main className="flex-1 flex flex-col">
        {/* Breadcrumb */}
        <div className="px-4 py-3 flex items-center text-sm text-muted-foreground">
          <Link href="/categories/replacement-parts/displays" className="hover:text-primary flex items-center">
            <ArrowLeft size={16} className="mr-1" /> Displays
          </Link>
        </div>

        {/* Image Gallery */}
        <div className="w-full aspect-[4/5] sm:aspect-square bg-muted/20 relative p-8 flex items-center justify-center">
          <motion.img
            key={activeImageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            src={cartProduct.images[activeImageIndex]}
            alt={cartProduct.name}
            className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal drop-shadow-xl"
          />
        </div>

        {/* Product Info */}
        <div className="px-4 py-6">
          <div className="mb-1 text-sm font-medium text-primary">
            {cartProduct.subcategory}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{cartProduct.name}</h1>
          
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center text-amber-500">
              <Star size={16} fill="currentColor" />
              <span className="ml-1 text-sm font-medium text-foreground">4.9</span>
            </div>
            <span className="text-muted-foreground text-sm">(12 reviews)</span>
          </div>

          <div className="text-2xl font-semibold mb-6">${cartProduct.price}</div>

          {/* Compatibility */}
          <div className="mb-8 bg-blue-50 dark:bg-blue-950/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-900/30">
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 uppercase tracking-wide">
              Compatibility
            </h3>
            <ul className="space-y-2">
              <li className="flex items-center text-blue-900 dark:text-blue-200 text-sm font-medium">
                <Check size={16} className="mr-2 text-blue-500" />
                {model.name} Only
              </li>
            </ul>
          </div>

          {/* Description */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2">Overview</h3>
            <p className="text-muted-foreground leading-relaxed">
              {cartProduct.description}
            </p>
          </div>

          {/* Specifications */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3">Specifications</h3>
            <div className="divide-y divide-border border-y border-border">
              {Object.entries(cartProduct.specifications).map(([key, value]) => (
                <div key={key} className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-muted-foreground font-medium">{key}</span>
                  <span className="text-foreground sm:text-right sm:w-2/3">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t border-border px-4 py-3 pb-safe">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold truncate">{cartProduct.name}</div>
            <div className="text-xs text-muted-foreground">${cartProduct.price}</div>
          </div>
          <Button 
            className="w-auto px-8"
            onClick={() => addToCart(cartProduct as any)}
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  )
}
