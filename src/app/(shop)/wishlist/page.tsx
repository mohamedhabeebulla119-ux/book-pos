"use client"

import { Header } from '@/components/ui/Header'
import { ProductCard } from '@/components/ui/ProductCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeading } from '@/components/ui/Heading'
import { useWishlist } from '@/context/WishlistContext'
import { useCatalogProducts } from '@/lib/catalog'
import { Heart } from 'lucide-react'
import type { Product } from '@/types'

export default function WishlistPage() {
  const { wishlist } = useWishlist()
  // Same wishlist ids as before — the accessor preserves every product slug.
  const combinedProducts = useCatalogProducts()
  const items = wishlist
    .map(id => combinedProducts.find(p => p.id === id))
    .filter((p): p is Product => !!p)

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <Header />

      <main className="px-4 py-6">
        <PageHeading title="Wishlist" subtitle="Products you've saved for later." className="mb-6" />

        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {items.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty."
            subtitle="Tap the heart on any product to save it here."
            ctaLabel="Browse Categories"
            ctaHref="/categories"
          />
        )}
      </main>
    </div>
  )
}
