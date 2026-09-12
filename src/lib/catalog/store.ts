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

/**
 * Bumped on every load. A reload triggered by a sign-in must win even if the
 * anonymous request it replaces is still in flight and resolves later —
 * otherwise a VIP customer would briefly be shown retail prices that then
 * stuck, which is exactly the bug this counter exists to prevent.
 */
let generation = 0

/** True while a live query is outstanding, so revalidation never stacks up. */
let inFlight = false

/** When the last load finished, successfully or not. 0 = never loaded. */
let lastLoadedAt = 0

/**
 * How long a loaded snapshot is trusted, by what prompted the check.
 *
 * Prices are set by an administrator at arbitrary times and there is no server
 * to push the change, so the catalog has to re-ask. These two windows are the
 * cheapest honest approximation of "the customer might be looking at a stale
 * price now":
 *
 *   ROUTE  - moving between screens inside the app. Generous, because in-app
 *            navigation is frequent and the price is unlikely to have moved.
 *   RETURN - coming back to a backgrounded app or a blurred tab. Short,
 *            because being away is exactly when a price change is likely to
 *            have happened, and it is the moment the customer re-reads the
 *            screen. This is what makes an admin edit visible on return
 *            without reloading the page.
 *
 * Neither is a poll: nothing fires on a timer, and a customer sitting still on
 * one screen issues no requests at all.
 */
const ROUTE_STALE_MS = 60_000
const RETURN_STALE_MS = 3_000

function emit() {
  for (const listener of listeners) listener()
}

function setSnapshot(next: CatalogSnapshot) {
  snapshot = next
  emit()
}

async function loadLiveCatalog() {
  const ticket = ++generation
  inFlight = true
  try {
    const live = await fetchLiveCatalog()
    if (ticket !== generation) return
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
    if (ticket !== generation) return
    setSnapshot({
      ...STATIC_SNAPSHOT,
      status: 'fallback',
      error: err instanceof Error ? err.message : 'Live catalog unavailable.',
    })
  } finally {
    // Only the newest attempt owns this state; a superseded one must not clear
    // the flag while its replacement is still running. The timestamp is stamped
    // even on failure, so an unreachable database is retried on the next
    // trigger rather than on every render.
    if (ticket === generation) {
      inFlight = false
      lastLoadedAt = Date.now()
    }
  }
}

/**
 * Re-reads the catalog only if the current snapshot has aged past `maxAgeMs`.
 *
 * The generation counter still decides who wins, so a revalidation that starts
 * before a sign-in cannot overwrite the tier-correct data that follows it.
 */
function revalidateIfStale(maxAgeMs: number): void {
  if (!loadStarted || inFlight) return
  if (Date.now() - lastLoadedAt < maxAgeMs) return
  void loadLiveCatalog()
}

/** Returning to the app is the strongest hint that a price may have moved. */
function handleReturn(): void {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  revalidateIfStale(RETURN_STALE_MS)
}

let revalidationBound = false

function bindRevalidation(): void {
  if (revalidationBound || typeof window === 'undefined') return
  revalidationBound = true
  // focus covers desktop tab switching; visibilitychange covers a Capacitor
  // app being resumed from the background, where focus alone does not fire.
  window.addEventListener('focus', handleReturn)
  document.addEventListener('visibilitychange', handleReturn)
}

function unbindRevalidation(): void {
  if (!revalidationBound || typeof window === 'undefined') return
  revalidationBound = false
  window.removeEventListener('focus', handleReturn)
  document.removeEventListener('visibilitychange', handleReturn)
}

/**
 * Re-runs the live query against the CURRENT session.
 *
 * Prices are resolved per-caller by my_effective_prices, whose tier comes from
 * private.current_customer_type() and therefore from auth.uid() at query time.
 * Because the query above fires exactly once, a customer who signs in after
 * first paint would otherwise keep the anonymous retail prices until a full
 * page reload — on a Capacitor build, until the app was killed and relaunched.
 *
 * Called from the customer auth context on every sign-in and sign-out. A no-op
 * before the first subscriber, because that subscriber's own load will already
 * carry the new session.
 *
 * Unconditional by design: it ignores the staleness windows and any request in
 * flight, because the identity changed and whatever is loaded or loading is
 * answering for the wrong person.
 */
export function reloadCatalog(): void {
  if (!loadStarted) return
  void loadLiveCatalog()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  bindRevalidation()

  if (!loadStarted) {
    // Fire the live query once, on the first component that needs the catalog.
    loadStarted = true
    void loadLiveCatalog()
  } else {
    // A later subscriber means a new screen is being rendered. Previously this
    // branch did nothing, which is why an admin price change never reached a
    // customer whose app was already open: the catalog was fetched once per
    // app launch and then kept forever.
    revalidateIfStale(ROUTE_STALE_MS)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) unbindRevalidation()
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
