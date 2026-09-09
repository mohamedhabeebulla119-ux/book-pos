"use client"
import { formatPrice } from '@/utils/formatPrice'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Product } from '@/types'
import { Button } from './Button'
import { Badge, statusTone } from './Badge'
import { useCart } from '@/context/CartContext'
import { useWishlist } from '@/context/WishlistContext'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { getIphoneCardTone } from '@/lib/iphoneCardTheme'
import { getProductSpecChips } from '@/lib/productSpecChips'
import { Box, Check, Heart, ArrowRight, ShieldCheck } from 'lucide-react'

interface ProductCardProps {
  product: Product
  featured?: boolean
}

function resolveHref(product: Product): string {
  if (product.id === 'part-iphone-15-pro-display') return '/categories/replacement-parts/displays'
  if (product.id === 'part-iphone-15-pro-battery') return '/categories/replacement-parts/batteries'
  return `/product/${product.id}`
}

export function ProductCard({ product, featured = false }: ProductCardProps) {
  const { addToCart } = useCart()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const theme = getCategoryTheme(product.category)
  const wishlisted = isWishlisted(product.id)
  const availability = product.stock <= 0 ? 'out' : product.stock <= 5 ? 'low' : 'in'
  const isIphone = product.category === 'iPhone'
  const iphoneTone = isIphone ? getIphoneCardTone(product.name) : null

  // Cached images can finish loading before React attaches the onLoad
  // listener, so also check `.complete` synchronously when the node mounts.
  const imgCallbackRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setImgLoaded(true)
  }, [])

  const href = resolveHref(product)
  const isPartSelector = product.id === 'part-iphone-15-pro-display' || product.id === 'part-iphone-15-pro-battery'
  const hasVariants = !!product.variants && product.variants.length > 0
  const minPrice = hasVariants ? Math.min(...product.variants!.map(v => v.price)) : product.price
  const tone = statusTone(product.status) !== 'neutral' ? statusTone(product.status) : (product.isNew ? 'new' : 'neutral')

  const ctaLabel = isPartSelector ? 'Select Model' : hasVariants ? 'View Options' : justAdded ? 'Added' : 'Add to Cart'
  const tagline = product.description?.split('.')[0]
  const specChips = getProductSpecChips(product)

  const handleCta = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isPartSelector) {
      window.location.href = href
      return
    }
    if (hasVariants) {
      window.location.href = href
      return
    }
    addToCart(product)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1400)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative flex flex-col bg-card rounded-2xl overflow-hidden border border-border/50 ${theme.glow} hover:shadow-lg transition-shadow ${featured ? 'w-72 min-w-72 snap-center' : 'w-full'}`}
    >
      <Link href={href} className="flex flex-col flex-1 p-3 sm:p-4">
        <div className={`relative aspect-square w-full mb-3 sm:mb-4 ${iphoneTone ? iphoneTone.well : theme.well} rounded-xl overflow-hidden ${isIphone ? 'p-2 sm:p-2.5' : 'p-4 sm:p-6'} flex items-center justify-center`}>
          {tone !== 'neutral' && (
            <div className="absolute top-2.5 left-2.5 z-10">
              <Badge tone={tone}>{tone === 'new' ? 'New' : 'Current'}</Badge>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleWishlist(product.id)
            }}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={wishlisted}
            className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/85 dark:bg-black/40 backdrop-blur-sm shadow-sm flex items-center justify-center active:scale-90 transition-transform"
          >
            <motion.span
              key={wishlisted ? 'on' : 'off'}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="flex items-center justify-center"
            >
              <Heart
                size={15}
                strokeWidth={2}
                className={wishlisted ? 'text-rose-500' : 'text-foreground/60'}
                fill={wishlisted ? 'currentColor' : 'none'}
              />
            </motion.span>
          </button>
          {/* Soft blurred glow behind the product photo — a plain (non-negative)
              z-index child painted first in DOM order, kept behind the `relative`
              image below it. Negative z-index inside an overflow-hidden ancestor
              fails to paint in some Chromium versions, so DOM order is used instead. */}
          {iphoneTone && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] rounded-full blur-2xl ${iphoneTone.glow}`} aria-hidden="true" />
          )}

          {!imgError ? (
            <img
              ref={imgCallbackRef}
              src={product.images[0]}
              alt={product.name}
              onError={() => setImgError(true)}
              onLoad={() => setImgLoaded(true)}
              className={`relative w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal transition-all duration-500 group-hover:scale-105 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          ) : (
            <div className="relative flex flex-col items-center justify-center text-muted-foreground/50">
              <Box size={40} strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1">
          {product.category === 'Replacement Parts' && product.compatibility?.[0] && (
            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-1 line-clamp-1">
              For {product.compatibility[0]}
            </span>
          )}
          <h3 className="font-semibold text-foreground text-sm leading-tight mb-1 line-clamp-2">
            {product.name}
          </h3>
          {tagline && (
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug line-clamp-1 mb-1.5">
              {tagline}.
            </p>
          )}
          {availability !== 'in' && (
            <span className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium mb-1 ${availability === 'low' ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${availability === 'low' ? 'bg-amber-500' : 'bg-red-500'}`} />
              {availability === 'low' ? 'Low Stock' : 'Out of Stock'}
            </span>
          )}
          <div className="mt-auto">
            <span className="text-xs sm:text-sm font-semibold block mb-2">
              {hasVariants && 'From '}{formatPrice(minPrice)}
            </span>
            {specChips.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                {specChips.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md bg-muted text-[10px] font-medium text-muted-foreground whitespace-nowrap"
                  >
                    <Icon size={11} className="shrink-0" />
                    {label}
                  </span>
                ))}
              </div>
            )}
            {product.warrantyInfo?.status === 'active' && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-muted-foreground">
                <ShieldCheck size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                {product.warrantyInfo.duration} Warranty
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="p-3 pt-0 sm:p-4 sm:pt-0">
        <Button
          fullWidth
          size="sm"
          onClick={handleCta}
          className={justAdded ? 'bg-emerald-500/15 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-foreground hover:bg-foreground text-background hover:opacity-90'}
        >
          {justAdded ? (
            <span className="flex items-center gap-1.5">
              <Check size={14} strokeWidth={2.5} /> {ctaLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              {ctaLabel} <ArrowRight size={13} strokeWidth={2.5} />
            </span>
          )}
        </Button>
      </div>
    </motion.div>
  )
}
