"use client"
import { formatPrice } from '@/utils/formatPrice'

import { use, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { products } from '@/data/mockData'
import { allDevices } from '@/data/deviceData'
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

// Combine mockData products with our new comprehensive device catalog
// Filter out duplicates by ID, giving precedence to allDevices
const combinedProducts = [
  ...allDevices,
  ...products.filter(p => !allDevices.some(d => d.id === p.id))
]

export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const product = combinedProducts.find(p => p.id === resolvedParams.id)
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
          <Link href="/categories" className="hover:text-primary flex items-center">
            <ArrowLeft size={16} className="mr-1" /> Back
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/categories/${categorySlugFromName(product.category)}`} className="hover:text-primary">
            {product.category}
          </Link>
        </div>

        {/* Image Gallery */}
        <div className={`w-full aspect-square ${theme.well} relative p-8 flex items-center justify-center overflow-hidden`}>
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
            {product.isNew || product.status === 'NEW' ? 'New' : product.subcategory}
          </div>
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

          <div className="text-2xl font-semibold mb-6">{formatPrice(currentPrice)}</div>

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
                      <span className="font-semibold">{formatPrice(variant.price)}</span>
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
                  <li key={idx} className="flex items-center text-blue-900 dark:text-blue-200 text-sm">
                    <Check size={16} className="mr-2 text-blue-500 shrink-0" />
                    {model}
                  </li>
                ))}
              </ul>
            </InfoBox>
          )}

          {/* Repair Parts Connection */}
          {repairParts && (
            <InfoBox icon={Wrench} title="Compatible Repair Parts" tone="accent" className="mb-8">
              <p className="text-sm text-orange-900/80 dark:text-orange-200/80 mb-4">
                Genuine Apple replacement parts are available for {product.name}.
              </p>
              <div className="flex flex-col gap-3">
                <Link href={`/categories/replacement-parts/displays/${repairParts.id}`}>
                  <Button variant="outline" className="w-full justify-between bg-background">
                    <span>{repairParts.display.specifications['Part Type']}</span>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </Button>
                </Link>
                <Link href={`/categories/replacement-parts/batteries/${repairParts.id}`}>
                  <Button variant="outline" className="w-full justify-between bg-background">
                    <span>{repairParts.battery.specifications['Part Type']}</span>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </Button>
                </Link>
              </div>
            </InfoBox>
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

          {/* Warranty */}
          {product.warrantyInfo && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3">Warranty</h3>
              {product.warrantyInfo.status === 'active' ? (
                <InfoBox icon={ShieldCheck} title={`${product.warrantyInfo.duration} Warranty`} tone="success">
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-semibold text-emerald-800 dark:text-emerald-200">Coverage: </span>
                      <span className="text-emerald-900/80 dark:text-emerald-100/80">{product.warrantyInfo.coverage}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-800 dark:text-emerald-200">Duration: </span>
                      <span className="text-emerald-900/80 dark:text-emerald-100/80">
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


