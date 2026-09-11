"use client"

import { useState } from 'react'
import { Header } from '@/components/ui/Header'
import { ProductCard } from '@/components/ui/ProductCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCatalogProducts } from '@/lib/catalog'
import { Search as SearchIcon, X } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  // Bundled catalog on first render, live prices/stock once Supabase responds.
  const combinedProducts = useCatalogProducts()
  
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
        {/* Search Input — floating field */}
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <SearchIcon size={19} className="text-primary" strokeWidth={2.2} />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices, parts, accessories…"
            className="focus-ring w-full h-14 bg-surface border border-mint-deep dark:border-border rounded-[22px] pl-12 pr-12 text-foreground font-medium placeholder:text-muted-foreground placeholder:font-normal shadow-card focus:outline-none focus:border-primary/40 transition-all duration-300"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-primary transition-colors"
            >
              <X size={19} />
            </button>
          )}
        </div>

        {/* Search State: Empty */}
        {query.trim() === '' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <h3 className="text-lg font-bold tracking-tight mb-4">Suggested Searches</h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setQuery(suggestion)}
                  className="bg-surface border border-mint/80 dark:border-border px-4 h-10 rounded-full text-[13px] font-semibold text-foreground shadow-card hover:bg-primary-soft hover:text-primary active:scale-95 transition-all duration-300"
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
