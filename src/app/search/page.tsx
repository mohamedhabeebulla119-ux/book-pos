"use client"

import { useState } from 'react'
import { Header } from '@/components/ui/Header'
import { ProductCard } from '@/components/ui/ProductCard'
import { products } from '@/data/mockData'
import { Search as SearchIcon, X } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  
  const searchResults = query.trim() === '' 
    ? [] 
    : products.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        p.category.toLowerCase().includes(query.toLowerCase()) ||
        p.model?.toLowerCase().includes(query.toLowerCase()) ||
        p.compatibility?.some(c => c.toLowerCase().includes(query.toLowerCase()))
      )

  const suggestions = [
    'iPhone 15 Pro',
    'MacBook Pro',
    'AirPods Pro',
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
            className="w-full h-14 bg-muted border-none rounded-2xl pl-12 pr-12 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
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
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <SearchIcon size={48} className="text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-1">No exact matches found</h3>
                <p className="text-muted-foreground">Try checking your spelling or use more general terms.</p>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  )
}
