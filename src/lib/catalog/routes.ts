import { getStaticProductIds } from './staticCatalog'

/**
 * Where a product's detail page lives.
 *
 * This app is a static export packaged into an APK, so every route has to exist
 * as a file at build time. `/product/[id]` is prerendered from the bundled
 * catalog, which means it covers every product that shipped — and nothing an
 * administrator adds afterwards.
 *
 * `/p?id=<id>` is the answer to that: one prerendered page that reads the id
 * from the query string and renders the same screen. New products are therefore
 * reachable the moment they are saved, with no rebuild and no redeploy.
 *
 * Bundled products keep their existing clean URLs, so no saved link, no
 * bookmark and no APK already on a phone changes behaviour.
 */

/** Ids that have a prerendered page in THIS build. Fixed at build time. */
const PRERENDERED = new Set(getStaticProductIds())

export function isPrerenderedProduct(id: string): boolean {
  return PRERENDERED.has(id)
}

/** The correct detail URL for any product id, bundled or database-only. */
export function productHref(id: string): string {
  return isPrerenderedProduct(id) ? `/product/${id}` : `/p?id=${encodeURIComponent(id)}`
}
