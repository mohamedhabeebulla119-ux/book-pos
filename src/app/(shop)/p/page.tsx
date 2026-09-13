"use client"

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PackageSearch } from 'lucide-react'
import { Header } from '@/components/ui/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProductDetailView } from '@/components/product/ProductDetailView'

/**
 * The runtime product page: /p?id=iphone-18-pro
 *
 * `output: "export"` resolves every route at build time, so /product/[id] can
 * only ever cover products that existed when the APK was built. This page is
 * prerendered once and reads the id from the query string instead, which is
 * what makes a product created in the admin panel reachable immediately —
 * "admin data change → Supabase → customer storefront", with no new build.
 *
 * It renders exactly the same component as /product/[id]; only the way the id
 * arrives differs.
 */

function ProductByQuery() {
  const id = useSearchParams().get('id')

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <EmptyState
          icon={PackageSearch}
          title="Product Not Found"
          subtitle="No product was specified."
          ctaLabel="Browse Categories"
          ctaHref="/categories"
        />
      </div>
    )
  }

  return <ProductDetailView productId={id} />
}

export default function ProductQueryPage() {
  // useSearchParams needs a Suspense boundary in an exported app: the HTML is
  // prerendered without a query string and resolves on the device.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col">
          <Header />
        </div>
      }
    >
      <ProductByQuery />
    </Suspense>
  )
}
