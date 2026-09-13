"use client"

import { use } from 'react'
import { ProductDetailView } from '@/components/product/ProductDetailView'

/**
 * Prerendered product page.
 *
 * generateStaticParams in the sibling layout enumerates the bundled catalog, so
 * this route exists for every product that shipped in the APK. Products created
 * later in the admin panel are served by /p?id=… instead — see productHref().
 */
export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ProductDetailView productId={id} />
}
