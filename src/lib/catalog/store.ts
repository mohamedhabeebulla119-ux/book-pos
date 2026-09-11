"use client"

import { useSyncExternalStore } from 'react'
import type { Product } from '@/types'
import { getStaticProducts, getStaticFeaturedIds } from './staticCatalog'
import { fetchLiveCatalog, applyLiveCatalog, resolveFeatured } from './liveCatalog'
import type { CatalogSnapshot } from './types'

/**
 * The catalog store.
 *
 * Deliberately a module-level external store rather than a React context, so
 * nothing has to be added to (shop)/layout.tsx — the customer layout, providers
 * and navigation are untouched by this phase.
 *
 *   bundled catalog  ->  instant first paint, works offline
 *          |
 *   live query fires once on first subscriber
 *          |
 *   price / stock / published overlay  ->  re-render with live values
 *
 * If the live query fails the snapshot simply stays on the bundled catalog and
 * the status becomes 'fallback'. The storefront never shows an empty state
 * because Supabase was unreachable.
 */

const STATIC_SNAPSHOT: CatalogSnapshot = {
  products: getStaticProducts(),
  featuredIds: getStaticFeaturedIds(),
  status: 'static',
  source: 'static',
  tier: null,
  error: null,
}

let snapshot: CatalogSnapshot = STATIC_SNAPSHOT
const listeners = new Set<() => void>()
let loadStarted = false

function emit() {
  for (const listener of listeners) listener()
}

function setSnapshot(next: CatalogSnapshot) {
  snapshot = next
  emit()
}

async function loadLiveCatalog() {
  try {
    const live = await fetchLiveCatalog()
    const products = applyLiveCatalog(getStaticProducts(), live)

    // A live response that somehow yields nothing is treated as a failure:
    // showing an empty store is strictly worse than showing the bundle.
    if (products.length === 0) {
      setSnapshot({ ...STATIC_SNAPSHOT, status: 'fallback', error: 'Live catalog returned no products.' })
      return
    }

    setSnapshot({
      products,
      // featured_products is canonical when it answers; the bundled selection
      // covers a failed or empty merchandising query.
      featuredIds: live.featuredIds ?? getStaticFeaturedIds(),
      status: 'live',
      source: 'live',
      tier: live.tier,
      error: null,
    })
  } catch (err) {
    setSnapshot({
      ...STATIC_SNAPSHOT,
      status: 'fallback',
      error: err instanceof Error ? err.message : 'Live catalog unavailable.',
    })
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  // Fire the live query once, on the first component that needs the catalog.
  if (!loadStarted) {
    loadStarted = true
    void loadLiveCatalog()
  }

  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): CatalogSnapshot {
  return snapshot
}

/** Prerendering has no network and no session: always the bundled catalog. */
function getServerSnapshot(): CatalogSnapshot {
  return STATIC_SNAPSHOT
}

/**
 * The single catalog accessor for the customer UI.
 *
 * Returns the bundled catalog synchronously on first render, then re-renders
 * with live prices and stock once Supabase responds.
 */
export function useCatalog(): CatalogSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Convenience: the product list only. */
export function useCatalogProducts(): readonly Product[] {
  return useCatalog().products
}

/** Convenience: resolve one product by its slug id. */
export function useCatalogProduct(id: string | undefined): Product | undefined {
  const products = useCatalogProducts()
  if (!id) return undefined
  return products.find((p) => p.id === id)
}

/**
 * Curated featured products for the homepage carousel, in display order.
 *
 * Returns the bundled selection immediately, then the live featured_products
 * selection once Supabase responds. Ids resolve through the catalog, so the
 * duplicated ids give the authoritative deviceData definitions.
 */
export function useFeaturedProducts(): Product[] {
  const { products, featuredIds } = useCatalog()
  return resolveFeatured(products, featuredIds)
}
