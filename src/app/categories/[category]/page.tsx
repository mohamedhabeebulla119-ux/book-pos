"use client"

import { use, useState, useMemo } from 'react'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { products } from '@/data/mockData'
import { iphoneProducts, ipadProducts, macProducts } from '@/data/deviceData'
import { Product } from '@/types'
import { Filter, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '@/context/CartContext'

// ─────────────────────────────────────────
// Filter configs per category
// ─────────────────────────────────────────
const filterOptions: Record<string, string[]> = {
  'iphone':      ['All', 'Pro', 'Standard', 'Plus', 'mini', 'Air', 'e'],
  'ipad':        ['All', 'Pro', 'Air', 'Standard', 'mini'],
  'mac':         ['All', 'MacBook', 'iMac', 'Mac mini', 'Mac Studio', 'Mac Pro'],
  'accessories': ['All', 'MagSafe', 'Cases', 'Cables', 'Power'],
  'parts':       ['All', 'Displays', 'Batteries'],
  'default':     ['All'],
}

const categoryMap: Record<string, string> = {
  'iphone':      'iPhone',
  'ipad':        'iPad',
  'mac':         'Mac',
  'watch':       'Apple Watch',
  'airpods':     'AirPods',
  'parts':       'Replacement Parts',
  'accessories': 'Accessories'
}

const categorySubtitle: Record<string, string> = {
  'iphone':      'All iPhone models',
  'ipad':        'All iPad models',
  'mac':         'All Mac models',
  'parts':       'Genuine Apple replacement parts',
  'accessories': 'Apple accessories & cables',
  'watch':       'Apple Watch collection',
  'airpods':     'AirPods collection',
}

// ─────────────────────────────────────────
// Device Card
// ─────────────────────────────────────────
function DeviceCard({ product }: { product: Product }) {
  const { addToCart } = useCart()
  const isNewOrCurrent = product.status === 'NEW' || product.status === 'CURRENT'

  let productHref = `/product/${product.id}`;
  if (product.id === 'part-iphone-15-pro-display') {
    productHref = '/categories/replacement-parts/displays';
  } else if (product.id === 'part-iphone-15-pro-battery') {
    productHref = '/categories/replacement-parts/batteries';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25 }}
      className="group flex flex-col bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-lg transition-all"
    >
      <Link href={productHref} className="flex flex-col flex-1 p-3 sm:p-4">
        {/* Status badge */}
        {product.status === 'NEW' && (
          <span className="absolute-but-relative mb-1 self-start text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
            NEW
          </span>
        )}

        {/* Product Image */}
        <div className="relative aspect-square w-full mb-3 bg-muted/20 rounded-xl overflow-hidden p-3 sm:p-4 flex items-center justify-center">
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          {/* Status badge overlaid */}
          {product.status === 'NEW' && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full uppercase tracking-wide">
              NEW
            </div>
          )}
          {product.status === 'CURRENT' && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-500 text-white text-[9px] font-bold rounded-full uppercase tracking-wide">
              Current
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex flex-col flex-1">
          <h3 className="font-semibold text-foreground text-sm leading-tight mb-0.5 line-clamp-2">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
              {product.description.split('.')[0]}
            </p>
          )}
          <div className="mt-auto">
            <span className="text-sm font-semibold">
              From ${product.price}
            </span>
          </div>
        </div>
      </Link>

      {/* CTA Button */}
      <div className="p-3 pt-0 sm:p-4 sm:pt-0">
        <Link href={productHref}>
          <Button variant="secondary" fullWidth size="sm">
            {productHref.includes('replacement-parts') ? 'Select Model' : (product.variants && product.variants.length > 0 ? 'View Options' : 'View Details')}
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────
export default function CategoryProductsPage({ params }: { params: Promise<{ category: string }> }) {
  const resolvedParams = use(params)
  const categoryParam = resolvedParams.category

  const categoryName = categoryMap[categoryParam] || 'Products'
  const subtitle = categorySubtitle[categoryParam] || ''

  const [activeFilter, setActiveFilter] = useState('All')
  const [sortBy, setSortBy] = useState('featured')
  const [showSort, setShowSort] = useState(false)

  const filters = filterOptions[categoryParam] || filterOptions['default']

  // Pick the right product pool
  const baseProducts = useMemo<Product[]>(() => {
    if (categoryParam === 'iphone') return iphoneProducts
    if (categoryParam === 'ipad') return ipadProducts
    if (categoryParam === 'mac') return macProducts
    return products.filter(p =>
      p.category.toLowerCase() === categoryName.toLowerCase()
    )
  }, [categoryParam, categoryName])

  // Filter
  const filteredProducts = useMemo(() => {
    if (activeFilter === 'All') return baseProducts
    return baseProducts.filter(p => {
      const name = p.name.toLowerCase()
      const f = activeFilter.toLowerCase()
      if (f === 'pro') return name.includes('pro')
      if (f === 'standard') return !name.includes('pro') && !name.includes('plus') && !name.includes('mini') && !name.includes('air') && !name.includes('e')
      if (f === 'plus') return name.includes('plus')
      if (f === 'mini') return name.includes('mini')
      if (f === 'air') return name.includes('air')
      if (f === 'e') return name.endsWith('e') || name.includes(' e ')
      if (f === 'macbook') return name.includes('macbook')
      if (f === 'imac') return name.includes('imac')
      if (f === 'mac mini') return name.includes('mac mini')
      if (f === 'mac studio') return name.includes('mac studio')
      if (f === 'mac pro') return name === 'mac pro' || p.id === 'mac-pro-m5'
      if (f === 'displays') return p.subcategory === 'Displays'
      if (f === 'batteries') return p.subcategory === 'Batteries'
      if (f === 'magsafe') return p.subcategory === 'MagSafe'
      if (f === 'cases') return p.subcategory?.toLowerCase().includes('case')
      if (f === 'cables') return p.subcategory?.toLowerCase().includes('cable')
      if (f === 'power') return p.subcategory?.toLowerCase().includes('power') || p.subcategory?.toLowerCase().includes('charger')
      return true
    })
  }, [baseProducts, activeFilter])

  // Sort
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price
      if (sortBy === 'price-high') return b.price - a.price
      // Default: featured first, then NEW, CURRENT, OLDER
      const statusOrder = { 'NEW': 0, 'CURRENT': 1, 'OLDER': 2, undefined: 3 }
      const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      return aOrder - bOrder
    })
  }, [filteredProducts, sortBy])

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="px-4 py-5">
        {/* Page Header */}
        <div className="mb-5">
          <h1 className="text-3xl font-bold tracking-tight">{categoryName}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p>
          )}
        </div>

        {/* Filter Pills */}
        {filters.length > 1 && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Sort row */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">
            {sortedProducts.length} {sortedProducts.length === 1 ? 'model' : 'models'}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowSort(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <SlidersHorizontal size={14} />
              {sortBy === 'price-low' ? 'Price: Low–High' : sortBy === 'price-high' ? 'Price: High–Low' : 'Featured'}
              <ChevronDown size={14} className={`transition-transform ${showSort ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showSort && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-10 min-w-[160px] overflow-hidden"
                >
                  {['featured', 'price-low', 'price-high'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => { setSortBy(opt); setShowSort(false) }}
                      className={`w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-muted transition-colors ${
                        sortBy === opt ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {opt === 'featured' ? 'Featured' : opt === 'price-low' ? 'Price: Low to High' : 'Price: High to Low'}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Product Grid */}
        {sortedProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {sortedProducts.map(product => (
              <DeviceCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Filter size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No models found</h3>
            <p className="text-muted-foreground mt-1 text-sm">Try a different filter.</p>
          </div>
        )}
      </main>
    </div>
  )
}
