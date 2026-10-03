"use client"

import Link from 'next/link'
import type { Product } from '@/types'
import { ProductCard } from '@/components/ui/ProductCard'
import { SectionHeading } from '@/components/ui/Heading'
import { useCatalogProducts, useFeaturedProducts } from '@/lib/catalog'
import { useStoreSettings } from '@/lib/store/settings'
import { CATEGORY_GROUPS } from '@/data/categoryMeta'

/** Per-section limits, so the home page never renders the whole catalog. */
const NEW_ARRIVALS_LIMIT = 8
const EXPLORE_LIMIT = 8

/**
 * The product discovery shared by the Retail and Wholesale homes.
 *
 * One catalog for both: every product comes from the canonical catalog store
 * (useCatalogProducts / useFeaturedProducts), which is already priced for the
 * signed-in caller by my_effective_prices — retail rows for a retail account,
 * VIP rows (with retail fallback) for a database-confirmed Wholesale VIP.
 * Nothing here chooses or computes a price, and ProductCard's "VIP Price" label
 * is gated on the same authoritative tier.
 *
 *   Featured Products – featured_products (slot 'home'), admin order;
 *                       Settings → Featured Products / "Featured products"
 *   New Arrivals      – products.is_new; Settings → "New arrivals"
 *   Explore Products  – catalog order. There is no real popularity signal
 *                       (no sales data is visible to customers), so none is
 *                       invented.
 *   Shop by Category  – the same CATEGORY_GROUPS as the Categories page
 */
export function HomeProductSections() {
  const { settings } = useStoreSettings()
  const products = useCatalogProducts()
  const featured = useFeaturedProducts()

  const featuredShown = settings.show_featured_products ? featured : []
  const newArrivals = settings.show_new_arrivals
    ? products.filter((p) => p.isNew).slice(0, NEW_ARRIVALS_LIMIT)
    : []

  // Products not already on screen above, so the page never repeats itself.
  const shown = new Set([...featuredShown, ...newArrivals].map((p) => p.id))
  const explore = products.filter((p) => !shown.has(p.id)).slice(0, EXPLORE_LIMIT)

  return (
    <div className="max-w-4xl mx-auto w-full">
      {featuredShown.length > 0 && (
        <ProductRail
          title="Featured Products"
          subtitle="Carefully selected highlights from our store."
          products={featuredShown}
        />
      )}
      {newArrivals.length > 0 && (
        <ProductRail
          title="New Arrivals"
          subtitle="The latest additions to our store."
          products={newArrivals}
        />
      )}
      {explore.length > 0 && (
        <ProductRail
          title="Explore Products"
          subtitle="Devices, parts and accessories."
          products={explore}
        />
      )}
      <CategoryDiscovery />
    </div>
  )
}

/**
 * A titled product carousel: one card plus a peek of the next on phones, a
 * two-column grid once there is room. `overflow-x: auto` forces overflow-y to
 * auto as well, so the vertical padding is what keeps card shadows unclipped.
 */
function ProductRail({ title, subtitle, products }: { title: string; subtitle: string; products: Product[] }) {
  return (
    <section className="pt-9">
      <div className="px-4">
        <SectionHeading title={title} subtitle={subtitle} seeAllHref="/categories" className="mb-4" />
      </div>
      <div className="flex gap-4 px-4 pt-1 pb-6 overflow-x-auto snap-x snap-mandatory scroll-px-4 no-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible sm:snap-none sm:pb-2">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} featured />
        ))}
        <div className="w-1 shrink-0 sm:hidden" aria-hidden="true" />
      </div>
    </section>
  )
}

/** Compact category shortcuts — a scrolling row of small tiles per group. */
function CategoryDiscovery() {
  return (
    <section className="pt-9">
      <div className="px-4">
        <SectionHeading title="Shop by Category" seeAllHref="/categories" className="mb-4" />
      </div>
      <div className="space-y-4">
        {CATEGORY_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="px-4 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {group.title}
            </h3>
            <div className="flex gap-2.5 overflow-x-auto px-4 pb-2 no-scrollbar">
              {group.categories.map((category) => (
                <Link
                  key={category.href}
                  href={category.href}
                  className="flex shrink-0 items-center gap-2.5 rounded-[20px] border border-mint/80 dark:border-border bg-surface p-1.5 pr-4 shadow-card hover:bg-primary-soft active:scale-[0.97] transition-all duration-300"
                >
                  <img
                    src={category.image}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-[14px] object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight text-foreground whitespace-nowrap">
                      {category.title}
                    </span>
                    <span className="block text-[11px] leading-tight text-muted-foreground whitespace-nowrap">
                      {category.subtitle}
                    </span>
                  </span>
                </Link>
              ))}
              <div className="w-1 shrink-0" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
