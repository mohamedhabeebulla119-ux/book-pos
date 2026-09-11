import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { AdminRole } from './roles'

/**
 * Admin customer / VIP data access.
 *
 * Reads use the existing "profiles staff read" and "profiles admin all" RLS
 * policies, so owner, admin and staff can all list customers while a customer
 * still only ever sees their own row.
 *
 * WRITES GO EXCLUSIVELY THROUGH admin_set_customer_type(). profiles.customer_type,
 * vip_approved_at, vip_approved_by and vip_expires_at all have their UPDATE
 * privilege revoked from `authenticated`, so a direct write from the browser is
 * refused by the grant system before RLS is even consulted — the SECURITY
 * DEFINER function is the only path that exists, and it re-checks the caller's
 * role inside PostgreSQL.
 *
 * No second VIP mechanism, no service-role key, no schema change.
 */

type ProfileRow = Database['public']['Tables']['profiles']['Row']

/** Mirrors price_tiers.code — the only two customer types. */
export const CUSTOMER_TYPES = ['retail', 'wholesale_vip'] as const
export type CustomerType = (typeof CUSTOMER_TYPES)[number]

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  retail: 'Retail',
  wholesale_vip: 'Wholesale VIP',
}

export function isCustomerType(value: string): value is CustomerType {
  return (CUSTOMER_TYPES as readonly string[]).includes(value)
}

/**
 * Owner and admin may grant or revoke VIP; staff is read-only.
 *
 * This mirrors private.has_role('admin') inside the RPC. It is a UI affordance
 * only — a staff session that bypassed it would still be refused by the
 * function itself.
 */
export function canManageVip(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

/** Derived state shown as a badge. */
export type VipStatus = 'retail' | 'vip' | 'vip_expired'

/**
 * Resolves the status the DATABASE will actually price against.
 *
 * private.current_customer_type() treats a VIP whose vip_expires_at has passed
 * as retail, so an expired VIP is surfaced distinctly rather than being shown
 * as an active VIP that silently no longer gets VIP prices.
 */
export function vipStatus(customer: AdminCustomer, now: Date = new Date()): VipStatus {
  if (customer.customer_type !== 'wholesale_vip') return 'retail'
  if (customer.vip_expires_at && new Date(customer.vip_expires_at) <= now) return 'vip_expired'
  return 'vip'
}

export interface AdminCustomer {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  customer_type: string
  vip_approved_at: string | null
  vip_approved_by: string | null
  vip_expires_at: string | null
  created_at: string
}

/**
 * Every customer the caller is permitted to see.
 *
 * Deliberately selects named columns rather than `*`: avatar_url and updated_at
 * are not needed to manage VIP status and are not pulled into the client.
 */
export async function listCustomers(): Promise<AdminCustomer[]> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, full_name, email, phone, customer_type, vip_approved_at, vip_approved_by, vip_expires_at, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Grants or revokes Wholesale VIP through the existing RPC.
 *
 * The function stamps vip_approved_at / vip_approved_by on a grant and clears
 * all three VIP fields on a revoke, so no audit bookkeeping happens here and no
 * second VIP history table is needed.
 *
 * `p_expires_at` is intentionally never passed: VIP has no automatic expiry in
 * this phase, so a grant is permanent until an admin revokes it.
 */
export async function setCustomerType(
  profileId: string,
  customerType: CustomerType,
): Promise<ProfileRow> {
  const { data, error } = await getSupabaseClient().rpc('admin_set_customer_type', {
    p_profile_id: profileId,
    p_customer_type: customerType,
  })

  if (error) throw error
  return data as unknown as ProfileRow
}

/** Case-insensitive match across the three searchable fields. */
export function matchesCustomerQuery(customer: AdminCustomer, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    (customer.full_name?.toLowerCase().includes(q) ?? false) ||
    (customer.email?.toLowerCase().includes(q) ?? false) ||
    (customer.phone?.toLowerCase().includes(q) ?? false)
  )
}
