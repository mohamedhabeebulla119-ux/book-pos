"use client"

import { use, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { products } from '@/data/mockData'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartContext'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronRight, Check, Star } from 'lucide-react'
import Link from 'next/link'

export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const product = products.find(p => p.id === resolvedParams.id)
  const { addToCart } = useCart()

  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0])
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  if (!product) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
          <p className="text-muted-foreground mb-6">The product you're looking for doesn't exist.</p>
          <Link href="/categories">
            <Button>Browse Categories</Button>
          </Link>
        </div>
      </div>
    )
  }

  const currentPrice = selectedVariant?.price || product.price

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header />
      
      <main className="flex-1 flex flex-col">
        {/* Breadcrumb */}
        <div className="px-4 py-3 flex items-center text-sm text-muted-foreground">
          <Link href="/categories" className="hover:text-primary flex items-center">
            <ArrowLeft size={16} className="mr-1" /> Back
          </Link>
          <span className="mx-2">/</span>
          <span className="truncate">{product.category}</span>
        </div>

        {/* Image Gallery */}
        <div className="w-full aspect-square bg-muted/20 relative p-8 flex items-center justify-center">
          <motion.img
            key={activeImageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            src={product.images[activeImageIndex]}
            alt={product.name}
            className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal drop-shadow-xl"
          />
          
          {product.images.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {product.images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === activeImageIndex ? 'bg-primary w-4' : 'bg-muted-foreground/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="px-4 py-6">
          <div className="mb-1 text-sm font-medium text-primary">
            {product.isNew ? 'New' : product.subcategory}
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">{product.name}</h1>
          
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center text-amber-500">
              <Star size={16} fill="currentColor" />
              <span className="ml-1 text-sm font-medium text-foreground">{product.rating}</span>
            </div>
            <span className="text-muted-foreground text-sm">({product.reviewsCount} reviews)</span>
          </div>

          <div className="text-2xl font-semibold mb-6">${currentPrice}</div>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Select Option
              </h3>
              <div className="space-y-3">
                {product.variants.map((variant) => {
                  const isSelected = selectedVariant?.id === variant.id
                  return (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {variant.colorCode && (
                          <div 
                            className="w-5 h-5 rounded-full border border-border shadow-sm"
                            style={{ backgroundColor: variant.colorCode }}
                          />
                        )}
                        <span className={`font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {variant.name}
                        </span>
                      </div>
                      <span className="font-semibold">${variant.price}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Compatibility (if Replacement Part) */}
          {product.compatibility && (
            <div className="mb-8 bg-blue-50 dark:bg-blue-950/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-900/30">
              <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 uppercase tracking-wide">
                Compatibility
              </h3>
              <ul className="space-y-2">
                {product.compatibility.map((model, idx) => (
                  <li key={idx} className="flex items-center text-blue-900 dark:text-blue-200 text-sm">
                    <Check size={16} className="mr-2 text-blue-500" />
                    {model}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2">Overview</h3>
            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Specifications */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3">Specifications</h3>
            <div className="divide-y divide-border border-y border-border">
              {Object.entries(product.specifications).map(([key, value]) => (
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
            <div className="text-sm font-semibold truncate">{product.name}</div>
            <div className="text-xs text-muted-foreground">${currentPrice}</div>
          </div>
          <Button 
            className="w-auto px-8"
            onClick={() => addToCart(product, selectedVariant)}
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  )
}
