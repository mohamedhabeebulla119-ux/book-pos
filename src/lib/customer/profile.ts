import { getSupabaseClient } from '@/lib/supabase/client'

/**
 * The signed-in customer's own profile.
 *
 * Reads ride the pre-existing "profiles read own" policy, which restricts every
 * caller to `id = auth.uid()`. There is no second profile system here: this is
 * the same public.profiles row the admin panel manages, read from the other end.
 *
 * Nothing in this module writes customer_type. It cannot: migration 12 revoked
 * that column's UPDATE privilege from `authenticated`, so the grant system
 * refuses the write before RLS is even consulted.
 */

/** Mirrors price_tiers.code — the only two customer types. */
export type CustomerType = 'retail' | 'wholesale_vip'

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  retail: 'Retail',
  wholesale_vip: 'Wholesale VIP',
}

export interface CustomerProfile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  customer_type: string
  vip_expires_at: string | null
  created_at: string
}

/**
 * Loads the caller's profile, or null when the row does not exist yet.
 *
 * `maybeSingle` rather than `single`: handle_new_user() creates the profile on
 * an auth.users INSERT, but a brand-new signup can reach this query in the
 * moment before that trigger's row is visible, and a missing profile is a state
 * to render — not an error to throw.
 */
export async function fetchOwnProfile(userId: string): Promise<CustomerProfile | null> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, full_name, email, phone, customer_type, vip_expires_at, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * The tier the DATABASE will actually price this customer at.
 *
 * A deliberate mirror of private.current_customer_type(): a VIP whose
 * vip_expires_at has passed resolves back to retail, and so does everyone with
 * no session at all. Keeping the two in step is what stops the UI promising a
 * VIP badge while the till charges retail.
 *
 * Expiry is compared against the device clock here, which on a Capacitor build
 * is user-settable — so this is only ever used to LABEL. Every actual price
 * still comes from my_effective_prices, where the comparison is made with
 * database now().
 */
export function resolveCustomerType(
  // Structural, not CustomerProfile, so the catalog can pass the two columns it
  // reads without pulling the whole profile across. This is the ONE place the
  // "is this customer VIP" rule is written.
  profile: { customer_type: string; vip_expires_at: string | null } | null,
  now: Date = new Date(),
): CustomerType {
  if (!profile) return 'retail'
  if (profile.customer_type !== 'wholesale_vip') return 'retail'
  if (profile.vip_expires_at && new Date(profile.vip_expires_at) <= now) return 'retail'
  return 'wholesale_vip'
}

/** True when the profile carries a VIP grant that has since lapsed. */
export function isVipExpired(profile: CustomerProfile | null, now: Date = new Date()): boolean {
  if (!profile || profile.customer_type !== 'wholesale_vip') return false
  return Boolean(profile.vip_expires_at && new Date(profile.vip_expires_at) <= now)
}

/**
 * Updates the details a customer is allowed to change about themselves.
 *
 * Exactly the columns migration 12 granted back after the table-level revoke:
 * full_name, email, phone, avatar_url. Passing anything else would be refused
 * by PostgreSQL, so the signature does not offer it.
 */
export async function updateOwnProfile(
  userId: string,
  fields: { full_name?: string | null; phone?: string | null; email?: string | null },
): Promise<CustomerProfile> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select('id, full_name, email, phone, customer_type, vip_expires_at, created_at')
    .single()

  if (error) throw error
  return data
}
