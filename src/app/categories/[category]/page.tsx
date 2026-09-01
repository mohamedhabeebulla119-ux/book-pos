"use client"

import { use, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { ProductCard } from '@/components/ui/ProductCard'
import { products } from '@/data/mockData'
import { Filter, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function CategoryProductsPage({ params }: { params: Promise<{ category: string }> }) {
  const resolvedParams = use(params)
  const categoryParam = resolvedParams.category
  
  // Basic mock mapping
  const categoryMap: Record<string, string> = {
    'iphone': 'iPhone',
    'ipad': 'iPad',
    'mac': 'Mac',
    'watch': 'Apple Watch',
    'airpods': 'AirPods',
    'parts': 'Replacement Parts',
    'accessories': 'Accessories'
  }

  const categoryName = categoryMap[categoryParam] || 'Products'
  
  const categoryProducts = products.filter(p => 
    p.category.toLowerCase() === categoryName.toLowerCase() || 
    (categoryName === 'Products')
  )

  const [sortBy, setSortBy] = useState('featured')

  // Very simple sorting for mock
  const sortedProducts = [...categoryProducts].sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price
    if (sortBy === 'price-high') return b.price - a.price
    return 0 // featured/default
  })

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <Header />
      
      <main className="px-4 py-6">
        <div className="flex flex-col mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{categoryName}</h1>
          <p className="text-muted-foreground mt-1">
            {categoryProducts.length} {categoryProducts.length === 1 ? 'product' : 'products'} available
          </p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" className="flex items-center gap-2 rounded-lg">
            <Filter size={16} />
            <span>Filter</span>
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal size={16} />
            <select 
              className="bg-transparent border-none outline-none text-foreground font-medium appearance-none"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {sortedProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Filter size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No products found</h3>
            <p className="text-muted-foreground mt-1">Try checking another category.</p>
          </div>
        )}
      </main>
    </div>
  )
}
