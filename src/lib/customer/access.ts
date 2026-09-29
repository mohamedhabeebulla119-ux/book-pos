import type { CustomerAuthStatus } from '@/context/CustomerAuthContext'
import type { CustomerType } from '@/lib/customer/profile'

/**
 * THE customer-access decision — the one place that says which part of the
 * store a visitor may be in. Everything that routes or links by customer type
 * (the route guard, the navigation, post-sign-in routing) asks this module
 * rather than re-deriving it.
 *
 * The input that matters is `CustomerAccess`, built only from the Supabase
 * session and public.profiles.customer_type (via resolveCustomerType, which
 * mirrors private.current_customer_type()). The onboarding card, localStorage
 * and URL parameters never grant anything; the local onboarding/experience
 * flags below only choose which ENTRY screen a signed-out visitor sees next.
 *
 * This is navigation, not the security boundary. The app is a static export
 * with no server, so the database remains the enforcement point: RLS and
 * my_effective_prices release wholesale prices only to accounts PostgreSQL
 * itself resolves as wholesale_vip, whatever this code is made to do.
 */

export type CustomerAccess = 'loading' | 'unauthenticated' | 'error' | CustomerType

export function resolveAccess(status: CustomerAuthStatus, customerType: CustomerType): CustomerAccess {
  if (status === 'loading') return 'loading'
  if (status === 'signed-out') return 'unauthenticated'
  if (status === 'error') return 'error'
  return customerType
}

/**
 * Which part of the app a path belongs to.
 *
 *   entry     – onboarding, type selection, sign-in: open to everyone
 *   retail    – the Retail storefront home and the wholesale-access request
 *   wholesale – the Wholesale storefront
 *   shared    – the one catalog, cart, wishlist and profile. Both tiers shop
 *               here; the database prices every product for the caller's own
 *               tier, so there is no separate catalog to duplicate.
 *
 * Anything not listed is `shared`, which still requires a signed-in account.
 */
export type RouteZone = 'entry' | 'retail' | 'wholesale' | 'shared'

const ENTRY_ROUTES = ['/onboarding', '/welcome', '/account/sign-in', '/account/sign-up', '/auth/callback']
const RETAIL_ROUTES = ['/account/wholesale-request']
const WHOLESALE_ROUTES = ['/wholesale']

export const WHOLESALE_REQUEST_PATH = '/account/wholesale-request'

function normalise(pathname: string): string {
  const path = pathname.split(/[?#]/)[0].replace(/\.html$/, '').replace(/\/index$/, '')
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : '/'
}

function under(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`)
}

export function routeZone(pathname: string): RouteZone {
  const path = normalise(pathname)
  if (ENTRY_ROUTES.some((base) => under(path, base))) return 'entry'
  if (WHOLESALE_ROUTES.some((base) => under(path, base))) return 'wholesale'
  if (path === '/' || RETAIL_ROUTES.some((base) => under(path, base))) return 'retail'
  return 'shared'
}

/** The storefront home for an account type — what "Home" means for them. */
export function homeFor(access: CustomerAccess): string {
  return access === 'wholesale_vip' ? '/wholesale' : '/'
}

export type AccessDecision =
  | { kind: 'render' }
  | { kind: 'wait' }
  | { kind: 'error' }
  | { kind: 'redirect'; to: string }

export interface EntryProgress {
  /** Local onboarding flag — UX sequencing only. */
  onboarded: boolean
  /** Local customer-type card choice — UX sequencing only, never access. */
  experienceChosen: boolean
}

export function decideAccess(access: CustomerAccess, pathname: string, entry: EntryProgress): AccessDecision {
  const zone = routeZone(pathname)
  if (zone === 'entry') return { kind: 'render' }

  switch (access) {
    case 'loading':
      // Nothing store-side renders until the account's type is known.
      return { kind: 'wait' }

    case 'unauthenticated':
      if (!entry.onboarded) return { kind: 'redirect', to: '/onboarding' }
      if (!entry.experienceChosen) return { kind: 'redirect', to: '/welcome' }
      return { kind: 'redirect', to: '/account/sign-in' }

    case 'error':
      // Signed in, but the profile read failed, so the type is unknown. The
      // profile page has its own retry and sign-out; everything else waits.
      return normalise(pathname) === '/profile' ? { kind: 'render' } : { kind: 'error' }

    case 'retail':
      return zone === 'wholesale' ? { kind: 'redirect', to: homeFor(access) } : { kind: 'render' }

    case 'wholesale_vip':
      return zone === 'retail' ? { kind: 'redirect', to: homeFor(access) } : { kind: 'render' }
  }
}
