"use client"

import { useState } from 'react'
import { Header } from '@/components/ui/Header'
import { ProductCard } from '@/components/ui/ProductCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { products } from '@/data/mockData'
import { allDevices } from '@/data/deviceData'
import { Search as SearchIcon, X } from 'lucide-react'
import { motion } from 'framer-motion'

// Combine mockData products with our new comprehensive device catalog
const combinedProducts = [
  ...allDevices,
  ...products.filter(p => !allDevices.some(d => d.id === p.id))
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  
  const searchResults = query.trim() === '' 
    ? [] 
    : combinedProducts.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        p.category.toLowerCase().includes(query.toLowerCase()) ||
        p.model?.toLowerCase().includes(query.toLowerCase()) ||
        p.compatibility?.some(c => c.toLowerCase().includes(query.toLowerCase())) ||
        Object.values(p.specifications).some(val => val.toLowerCase().includes(query.toLowerCase()))
      )

  const suggestions = [
    'iPhone 17 Pro Max',
    'Mac Studio',
    'iPad Pro 13-inch',
    'Display Assembly',
    'Replacement Battery',
    'MagSafe Charger'
  ]

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <Header />
      
      <main className="px-4 py-6">
        {/* Search Input */}
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon size={20} className="text-muted-foreground" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, parts, accessories..."
            className="w-full h-14 bg-card border border-border/60 rounded-2xl pl-12 pr-12 text-foreground font-medium shadow-card focus:outline-none focus:ring-2 focus:ring-primary/50 focus:shadow-[0_0_0_4px_rgba(124,92,255,0.12)] transition-shadow"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Search State: Empty */}
        {query.trim() === '' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <h3 className="text-lg font-semibold mb-4">Suggested Searches</h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setQuery(suggestion)}
                  className="bg-muted px-4 py-2 rounded-full text-sm font-medium hover:bg-muted-foreground/10 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Search State: Results */}
        {query.trim() !== '' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">
                {searchResults.length} {searchResults.length === 1 ? 'Result' : 'Results'} for "{query}"
              </h3>
            </div>
            
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {searchResults.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={SearchIcon}
                title="No exact matches found"
                subtitle="Try checking your spelling or use more general terms."
                compact
              />
            )}
          </motion.div>
        )}
      </main>
    </div>
  )
}
