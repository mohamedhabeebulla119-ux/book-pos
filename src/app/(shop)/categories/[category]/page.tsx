"use client"

import { use, useState, useMemo } from 'react'
import { Header } from '@/components/ui/Header'
import { useCatalogProducts } from '@/lib/catalog'
import { categorySlugToName, categoryHeroCopy } from '@/data/categoryMeta'
import { Product } from '@/types'
import { Filter, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { ProductCard } from '@/components/ui/ProductCard'
import { CategoryHero } from '@/components/ui/CategoryHero'
import { EmptyState } from '@/components/ui/EmptyState'
import { motion, AnimatePresence } from 'framer-motion'

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

// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────
export default function CategoryProductsPage({ params }: { params: Promise<{ category: string }> }) {
  const resolvedParams = use(params)
  const categoryParam = resolvedParams.category

  const categoryName = categorySlugToName[categoryParam] || 'Products'
  const heroCopy = categoryHeroCopy[categoryParam]

  const [activeFilter, setActiveFilter] = useState('All')
  const [sortBy, setSortBy] = useState('featured')
  const [showSort, setShowSort] = useState(false)

  const filters = filterOptions[categoryParam] || filterOptions['default']

  const catalogProducts = useCatalogProducts()

  // Pick the right product pool.
  //
  // This used to special-case iphone/ipad/mac to the deviceData arrays and fall
  // back to mockData for everything else. Filtering the unified catalog by
  // category is equivalent for all seven slugs — deviceData is spread first, so
  // it still wins the two duplicate ids — and it means every category now picks
  // up live price, stock and publication state from the same accessor.
  const baseProducts = useMemo<Product[]>(
    () => catalogProducts.filter(
      p => p.category.toLowerCase() === categoryName.toLowerCase()
    ),
    [catalogProducts, categoryName],
  )

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
        {heroCopy && (
          <CategoryHero
            eyebrow={heroCopy.eyebrow}
            title={heroCopy.headline}
            subtitle={heroCopy.blurb}
            image={baseProducts[0]?.images[0]}
            category={categoryParam}
            className="mb-5"
          />
        )}

        {/* Filter Pills */}
        {filters.length > 1 && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1.5 -mx-4 px-4 scrollbar-hide">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`shrink-0 px-4 h-10 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all duration-300 active:scale-95 ${
                  activeFilter === f
                    ? 'bg-gradient-cta text-white shadow-glow'
                    : 'bg-surface border border-mint/80 dark:border-border text-muted-foreground hover:text-primary hover:bg-primary-soft shadow-card'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Sort row */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">
            {sortedProducts.length} {sortedProducts.length === 1 ? 'model' : 'models'}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowSort(v => !v)}
              className="flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-surface border border-mint/80 dark:border-border shadow-card text-[13px] font-semibold text-primary active:scale-95 transition-all duration-300"
            >
              <SlidersHorizontal size={14} />
              {sortBy === 'price-low' ? 'Price: Low–High' : sortBy === 'price-high' ? 'Price: High–Low' : 'Featured'}
              <ChevronDown size={14} className={`transition-transform duration-300 ${showSort ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showSort && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 top-full mt-2 bg-glass border border-mint-deep dark:border-border rounded-3xl shadow-float z-20 min-w-[172px] overflow-hidden p-1.5"
                >
                  {['featured', 'price-low', 'price-high'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => { setSortBy(opt); setShowSort(false) }}
                      className={`w-full px-3.5 py-2.5 text-left text-[13px] font-semibold rounded-2xl transition-colors ${
                        sortBy === opt ? 'bg-primary-soft text-primary' : 'text-foreground hover:bg-primary-soft/60'
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
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Filter} title="No models found" subtitle="Try a different filter." compact />
        )}
      </main>
    </div>
  )
}

