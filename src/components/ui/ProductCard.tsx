"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Product } from '@/types'
import { Button } from './Button'
import { useCart } from '@/context/CartContext'
import { Box } from 'lucide-react'

interface ProductCardProps {
  product: Product
  featured?: boolean
}

export function ProductCard({ product, featured = false }: ProductCardProps) {
  const { addToCart } = useCart()
  const [imgError, setImgError] = useState(false)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className={`group relative flex flex-col bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-lg transition-all ${featured ? 'w-72 min-w-72 snap-center' : 'w-full'}`}
    >
      <Link 
        href={
          product.id === 'part-iphone-15-pro-display' 
            ? '/categories/replacement-parts/displays' 
            : product.id === 'part-iphone-15-pro-battery'
            ? '/categories/replacement-parts/batteries'
            : `/product/${product.id}`
        } 
        className="flex flex-col flex-1 p-3 sm:p-4"
      >
        {product.isNew && (
          <span className="absolute top-3 left-3 sm:top-4 sm:left-4 text-[10px] font-semibold tracking-wider text-orange-500 uppercase z-10">
            New
          </span>
        )}
        
        <div className="relative aspect-square w-full mb-3 sm:mb-4 bg-muted/30 rounded-xl overflow-hidden p-4 sm:p-6 flex items-center justify-center">
          {!imgError ? (
            <img 
              src={product.images[0]} 
              alt={product.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground/50">
              <Box size={40} strokeWidth={1.5} />
            </div>
          )}
        </div>
        
        <div className="flex flex-col flex-1">
          {product.category === 'Replacement Parts' && (
            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-1 line-clamp-1">
              For {product.compatibility?.[0]}
            </span>
          )}
          <h3 className="font-semibold text-foreground text-sm leading-tight mb-1 sm:mb-2 line-clamp-2">
            {product.name}
          </h3>
          <div className="mt-auto">
            <span className="text-xs sm:text-sm font-medium">
              ${product.price}
            </span>
          </div>
        </div>
      </Link>
      
      <div className="p-3 pt-0 sm:p-4 sm:pt-0">
        <Button 
          variant="secondary" 
          fullWidth 
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            
            if (product.id === 'part-iphone-15-pro-display') {
              window.location.href = '/categories/replacement-parts/displays'
              return
            }
            if (product.id === 'part-iphone-15-pro-battery') {
              window.location.href = '/categories/replacement-parts/batteries'
              return
            }
            
            if (product.variants && product.variants.length > 0) {
              window.location.href = `/product/${product.id}`
            } else {
              addToCart(product)
            }
          }}
        >
          {product.id === 'part-iphone-15-pro-display' || product.id === 'part-iphone-15-pro-battery' 
            ? 'View Models' 
            : (product.variants ? 'View Options' : 'Add to Cart')}
        </Button>
      </div>
    </motion.div>
  )
}
