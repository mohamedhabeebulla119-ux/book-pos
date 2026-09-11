"use client"
import { formatPrice } from '@/utils/formatPrice'

import { use, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { useCatalogProduct } from '@/lib/catalog'
import { iphoneModels } from '@/data/iphoneModels'
import { categorySlugFromName } from '@/data/categoryMeta'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { Button } from '@/components/ui/Button'
import { InfoBox } from '@/components/ui/InfoBox'
import { StickyActionBar } from '@/components/ui/StickyActionBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCart } from '@/context/CartContext'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronRight, Check, Star, Wrench, ShieldCheck, PackageSearch, Minus, Plus } from 'lucide-react'
import Link from 'next/link'

export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  // Resolves against the bundled catalog immediately, then against the live
  // catalog once it loads. Live pricing and stock arrive with no route change.
  const product = useCatalogProduct(resolvedParams.id)
  const { addToCart } = useCart()

  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0])
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)

  if (!product) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <EmptyState
          icon={PackageSearch}
          title="Product Not Found"
          subtitle="The product you're looking for doesn't exist."
          ctaLabel="Browse Categories"
          ctaHref="/categories"
        />
      </div>
    )
  }

  const currentPrice = selectedVariant?.price || product.price
  const theme = getCategoryTheme(product.category)

  // Check if there are repair parts for this device (currently iPhones)
  const repairParts = iphoneModels.find(m => m.id === product.id)

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header />
      
      <main className="flex-1 flex flex-col">
        {/* Breadcrumb */}
        <div className="px-4 py-3 flex items-center text-sm text-muted-foreground">
          <Link href="/categories" className="hover:text-primary flex items-center font-medium">
            <ArrowLeft size={16} className="mr-1" /> Back
          </Link>
          <span className="mx-2 text-mint-deep">/</span>
          <Link href={`/categories/${categorySlugFromName(product.category)}`} className="hover:text-primary font-medium">
            {product.category}
          </Link>
        </div>

        {/* Image Gallery */}
        <div className="px-4">
          <div className={`w-full aspect-square ${theme.well} border border-mint/80 dark:border-border rounded-[30px] relative p-7 flex flex-col items-center justify-center overflow-hidden shadow-card`}>
            <motion.img
              key={activeImageIndex}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              src={product.images[activeImageIndex]}
              alt={product.name}
              className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal drop-shadow-xl"
            />
            {/* Curved glossy shelf beneath the product */}
            <div className="h-7 w-2/3 -mt-1 rounded-[100%] bg-pedestal blur-[8px]" aria-hidden="true" />

            {product.images.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                {product.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    aria-label={`View image ${idx + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === activeImageIndex ? 'bg-primary w-5' : 'bg-primary/25 w-2'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="px-4 py-6">
          <div className="mb-1.5 inline-flex items-center px-2.5 py-1 rounded-full bg-primary-soft border border-mint-deep text-[11px] font-bold uppercase tracking-wide text-primary">
            {product.isNew || product.status === 'NEW' ? 'New' : product.subcategory}
          </div>
          <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight mb-2 leading-tight">{product.name}</h1>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center text-amber-500">
              <Star size={16} fill="currentColor" />
              <span className="ml-1 text-sm font-semibold text-foreground">{product.rating}</span>
            </div>
            <span className="text-muted-foreground text-sm">({product.reviewsCount} reviews)</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" /> In Stock
            </span>
          </div>

          <div className="text-[26px] font-bold tracking-tight mb-6">{formatPrice(currentPrice)}</div>

          {/* Quantity */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Quantity
            </h3>
            <div className="inline-flex items-center bg-primary-soft border border-mint-deep rounded-full px-1 py-1">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="w-9 h-9 rounded-full text-primary flex items-center justify-center hover:bg-card active:scale-90 transition-all"
              >
                <Minus size={16} />
              </button>
              <span className="w-10 text-center font-semibold text-sm">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                aria-label="Increase quantity"
                className="w-9 h-9 rounded-full text-primary flex items-center justify-center hover:bg-card active:scale-90 transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Select Option
              </h3>
              <div className="space-y-2.5">
                {product.variants.map((variant) => {
                  const isSelected = selectedVariant?.id === variant.id
                  return (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant)}
                      className={`w-full flex items-center justify-between p-4 rounded-[20px] border transition-all duration-300 active:scale-[0.99] ${
                        isSelected
                          ? 'border-primary/45 bg-well-strong shadow-card'
                          : 'border-mint/80 dark:border-border bg-surface hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {variant.colorCode && (
                          <div
                            className="w-5 h-5 rounded-full border border-mint-deep shadow-sm shrink-0"
                            style={{ backgroundColor: variant.colorCode }}
                          />
                        )}
                        <span className={`font-semibold text-sm truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {variant.name}
                        </span>
                      </div>
                      <span className="font-bold text-sm shrink-0 ml-3">{formatPrice(variant.price)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Compatibility (if Replacement Part) */}
          {product.compatibility && (
            <InfoBox icon={ShieldCheck} title="Compatibility" tone="info" className="mb-8">
              <ul className="space-y-2">
                {product.compatibility.map((model, idx) => (
                  <li key={idx} className="flex items-center text-foreground/85 text-sm font-medium">
                    <Check size={16} className="mr-2 text-primary shrink-0" />
                    {model}
                  </li>
                ))}
              </ul>
            </InfoBox>
          )}

          {/* Repair Parts Connection */}
          {repairParts && (
            <InfoBox icon={Wrench} title="Compatible Repair Parts" tone="accent" className="mb-8">
              <p className="text-sm text-foreground/75 mb-4">
                Genuine Apple replacement parts are available for {product.name}.
              </p>
              <div className="flex flex-col gap-2.5">
                <Link href={`/categories/replacement-parts/displays/${repairParts.id}`}>
                  <Button variant="secondary" className="w-full justify-between text-left h-12">
                    <span className="truncate text-[13px]">{repairParts.display.specifications['Part Type']}</span>
                    <ChevronRight size={16} className="text-primary shrink-0" />
                  </Button>
                </Link>
                <Link href={`/categories/replacement-parts/batteries/${repairParts.id}`}>
                  <Button variant="secondary" className="w-full justify-between text-left h-12">
                    <span className="truncate text-[13px]">{repairParts.battery.specifications['Part Type']}</span>
                    <ChevronRight size={16} className="text-primary shrink-0" />
                  </Button>
                </Link>
              </div>
            </InfoBox>
          )}

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-lg font-bold tracking-tight mb-2">Overview</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Specifications */}
          <div className="mb-8">
            <h3 className="text-lg font-bold tracking-tight mb-3">Specifications</h3>
            <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] px-4 shadow-card divide-y divide-mint/80 dark:divide-border">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-muted-foreground text-[13px] font-semibold">{key}</span>
                  <span className="text-foreground text-[13px] sm:text-right sm:w-2/3">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Warranty */}
          {product.warrantyInfo && (
            <div className="mb-8">
              <h3 className="text-lg font-bold tracking-tight mb-3">Warranty</h3>
              {product.warrantyInfo.status === 'active' ? (
                <InfoBox icon={ShieldCheck} title={`${product.warrantyInfo.duration} Warranty`} tone="success">
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-semibold text-primary-strong">Coverage: </span>
                      <span className="text-foreground/80">{product.warrantyInfo.coverage}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-primary-strong">Duration: </span>
                      <span className="text-foreground/80">
                        {product.warrantyInfo.months} months from the purchase date.
                      </span>
                    </div>
                  </div>
                </InfoBox>
              ) : (
                <p className="text-sm text-muted-foreground">No warranty coverage for this product.</p>
              )}
            </div>
          )}
        </div>
      </main>

      <StickyActionBar
        title={product.name}
        price={formatPrice(currentPrice * quantity)}
        onAddToCart={() => addToCart(product, selectedVariant, quantity)}
      />
    </div>
  )
}


