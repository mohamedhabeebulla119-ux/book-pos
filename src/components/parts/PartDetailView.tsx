"use client"

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Star, ShieldCheck, Minus, Plus } from 'lucide-react'
import { formatPrice } from '@/utils/formatPrice'
import { useCart } from '@/context/CartContext'
import { InfoBox } from '@/components/ui/InfoBox'
import { StickyActionBar } from '@/components/ui/StickyActionBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { buildPartProduct, type PartKind } from '@/lib/partProduct'
import type { IPhoneModel } from '@/data/iphoneModels'

interface PartDetailViewProps {
  model: IPhoneModel | undefined
  partKind: PartKind
}

const partLabel: Record<PartKind, string> = { display: 'Display', battery: 'Battery' }

export function PartDetailView({ model, partKind }: PartDetailViewProps) {
  const { addToCart } = useCart()
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const listHref = `/categories/replacement-parts/${partKind === 'display' ? 'displays' : 'batteries'}`
  const theme = getCategoryTheme(partKind === 'display' ? 'displays' : 'batteries')

  if (!model) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={`${partLabel[partKind]} Not Found`}
        subtitle={`The ${partKind} for this model doesn't exist.`}
        ctaLabel={`View All ${partLabel[partKind]}s`}
        ctaHref={listHref}
      />
    )
  }

  const product = buildPartProduct(model, partKind)

  return (
    <div className="flex flex-col min-h-screen pb-24">
      {/* Breadcrumb */}
      <div className="px-4 py-3 flex items-center text-sm text-muted-foreground">
        <Link href={listHref} className="hover:text-primary flex items-center min-h-[44px]">
          <ArrowLeft size={16} className="mr-1" /> {partLabel[partKind]}s
        </Link>
      </div>

      {/* Image Gallery */}
      <div className={`w-full aspect-[4/5] sm:aspect-square ${theme.well} relative p-8 flex items-center justify-center overflow-hidden`}>
        <motion.img
          key={activeImageIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          src={product.images[activeImageIndex]}
          alt={product.name}
          className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal drop-shadow-xl"
        />
      </div>

      {/* Product Info */}
      <div className="px-4 py-6">
        <div className="mb-1 text-sm font-medium text-primary">{product.subcategory}</div>
        <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight mb-2 leading-tight">{product.name}</h1>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center text-amber-500">
            <Star size={16} fill="currentColor" />
            <span className="ml-1 text-sm font-medium text-foreground">{product.rating}</span>
          </div>
          <span className="text-muted-foreground text-sm">({product.reviewsCount} reviews)</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> In Stock
          </span>
        </div>

        <div className="text-2xl font-semibold mb-6">{formatPrice(product.price)}</div>

        {/* Quantity */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Quantity
          </h3>
          <div className="inline-flex items-center bg-muted rounded-full px-1 py-1">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-background active:scale-90 transition-all"
            >
              <Minus size={16} />
            </button>
            <span className="w-10 text-center font-medium text-sm">{quantity}</span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              aria-label="Increase quantity"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-background active:scale-90 transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Compatibility */}
        <InfoBox icon={ShieldCheck} title="Compatibility" tone="info" className="mb-8">
          <ul className="space-y-2">
            <li className="flex items-center text-blue-900 dark:text-blue-200 text-sm font-medium">
              <Check size={16} className="mr-2 text-blue-500 shrink-0" />
              {model.name} Only
            </li>
          </ul>
        </InfoBox>

        {/* Description */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Overview</h3>
          <p className="text-muted-foreground leading-relaxed">{product.description}</p>
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

      <StickyActionBar
        title={product.name}
        price={formatPrice(product.price * quantity)}
        onAddToCart={() => addToCart(product, undefined, quantity)}
      />
    </div>
  )
}
