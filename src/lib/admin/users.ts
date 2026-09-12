import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { ADMIN_ROLES, isAdminRole, type AdminRole } from './roles'
import { vipStatus, type AdminCustomer } from './customers'

/**
 * Admin users data access.
 *
 * Deliberately thin: profiles, VIP state and the admin_set_customer_type() RPC
 * already live in ./customers and are imported by the Users workspace rather
 * than reimplemented here. This module adds only what the Users page needs on
 * top of that - role grants and per-user order statistics.
 *
 * Policies relied on (all pre-existing except the first, added by migration 15):
 *
 *   user_roles   staff read   - SELECT only; lets the panel render a Role column
 *   user_roles   owner all    - the ONLY write path for role grants
 *   profiles     staff read   - the customer list
 *   orders       staff read   - order counts and spend
 *
 * No service-role key, and no privileged Auth Admin API call: this app is a
 * static export in a Capacitor WebView, so there is no server to hold a secret
 * and auth.users is unreachable by design. See ACCOUNT_STATUS_NOTE.
 */

type OrderRow = Database['public']['Tables']['orders']['Row']

/** Every account-level role the Users page can display. */
export const ACCOUNT_ROLES = ['customer', ...ADMIN_ROLES] as const
export type AccountRole = (typeof ACCOUNT_ROLES)[number]

export const ACCOUNT_ROLE_LABEL: Record<AccountRole, string> = {
  customer: 'Customer',
  staff: 'Staff',
  admin: 'Admin',
  owner: 'Owner',
}

/** Seniority, used to collapse multiple grants into one displayed role. */
const ROLE_RANK: Record<AdminRole, number> = { owner: 3, admin: 2, staff: 1 }

/**
 * Only an owner may grant or revoke roles.
 *
 * This mirrors the "user_roles owner all" policy exactly. It is a UI affordance
 * only - an admin session that bypassed it would still be refused by RLS, and
 * the last-owner case is refused by a trigger as well.
 */
export function canManageRoles(role: AdminRole | null): boolean {
  return role === 'owner'
}

/**
 * Why the Users page shows no account-status filter.
 *
 * Confirmation, ban and last-sign-in state live in auth.users, which PostgREST
 * does not expose and which may only be read through the Auth Admin API with
 * the service-role key. That key must never reach a browser bundle, and this
 * deployment is a static export with no server to keep it on. `profiles` has no
 * status column of its own, so any "Active / Suspended" control here would be
 * decoration over data the app cannot actually see.
 */
export const ACCOUNT_STATUS_NOTE =
  'Apple Expert stores no suspension flag. Email confirmation and sign-in history live in ' +
  'auth.users, which is readable only with a service-role key - and this app ships as a static ' +
  'export with no server to hold one, so that state is deliberately not shown rather than guessed.'

export interface UserOrderStats {
  /** Every order placed, including cancelled and refunded ones. */
  orderCount: number
  /** Spend excluding cancelled and refunded orders, matching the Orders page. */
  spentCents: number
  /** Most recent placed_at across all of this customer's orders. */
  lastOrderAt: string | null
}

export const NO_ORDER_STATS: UserOrderStats = {
  orderCount: 0,
  spentCents: 0,
  lastOrderAt: null,
}

/** A profile joined with everything the Users table renders. */
export interface AdminUser extends AdminCustomer {
  /** Most senior admin grant held, or null for an ordinary customer. */
  adminRole: AdminRole | null
  stats: UserOrderStats
}

export interface RoleGrant {
  id: string
  profile_id: string
  role: AdminRole
  granted_at: string
  granted_by: string | null
}

/**
 * Every role grant the caller is permitted to see.
 *
 * Under "user_roles staff read" this is the whole table for staff, admin and
 * owner. Without migration 15 applied it degrades to the caller's own row,
 * which is why the page surfaces `visibleToViewer` rather than silently
 * painting every colleague as a customer.
 */
export async function listRoleGrants(): Promise<RoleGrant[]> {
  const { data, error } = await getSupabaseClient()
    .from('user_roles')
    .select('id, profile_id, role, granted_at, granted_by')

  if (error) throw error

  return (data ?? [])
    .filter((row): row is RoleGrant => isAdminRole(row.role))
}

/**
 * Order count and spend for every customer, in ONE request.
 *
 * This is the whole reason the page does not issue a query per row: three
 * narrow columns for the order set are cheaper to move than N round trips, and
 * PostgREST cannot GROUP BY without a view or an RPC that this change was not
 * asked to introduce. `orders_profile_idx` already covers the scan.
 *
 * Capped for the same reason the Orders page is capped. Aggregates are exact
 * while total order volume is at or below the cap; past it the page says so
 * rather than quietly under-reporting.
 */
export const ORDER_SCAN_LIMIT = 5000

export interface OrderStatsResult {
  byProfile: Map<string, UserOrderStats>
  /** Rows actually scanned - equal to the cap when there may be more. */
  scanned: number
  truncated: boolean
}

/** Cancelled and refunded orders are counted but never added to spend. */
const NON_REVENUE_STATUSES = new Set(['cancelled', 'refunded'])

export async function loadOrderStats(): Promise<OrderStatsResult> {
  const { data, error } = await getSupabaseClient()
    .from('orders')
    .select('profile_id, total_cents, status, placed_at')
    .order('placed_at', { ascending: false })
    .limit(ORDER_SCAN_LIMIT)

  if (error) throw error

  const rows = (data ?? []) as Pick<OrderRow, 'profile_id' | 'total_cents' | 'status' | 'placed_at'>[]
  const byProfile = new Map<string, UserOrderStats>()

  for (const row of rows) {
    const current = byProfile.get(row.profile_id) ?? { ...NO_ORDER_STATS }
    current.orderCount += 1
    if (!NON_REVENUE_STATUSES.has(row.status)) current.spentCents += row.total_cents
    // Rows arrive newest first, so the first one seen is the latest.
    current.lastOrderAt ??= row.placed_at
    byProfile.set(row.profile_id, current)
  }

  return { byProfile, scanned: rows.length, truncated: rows.length >= ORDER_SCAN_LIMIT }
}

export interface RecentOrder {
  id: string
  order_number: string
  status: string
  total_cents: number
  placed_at: string
}

/**
 * The newest orders for one customer, fetched when the detail panel opens.
 *
 * Deliberately a separate, indexed, per-customer query rather than a slice of
 * the capped scan above: it stays correct for a long-standing customer whose
 * orders fall outside the cap, and it costs one request per panel open - not
 * one per row in the table.
 */
export async function listRecentOrdersForUser(
  profileId: string,
  limit = 5,
): Promise<RecentOrder[]> {
  const { data, error } = await getSupabaseClient()
    .from('orders')
    .select('id, order_number, status, total_cents, placed_at')
    .eq('profile_id', profileId)
    .order('placed_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

/**
 * Grants or revokes an administrator role.
 *
 * Writes go straight to user_roles because that is the existing security model:
 * "user_roles owner all" already restricts every INSERT, UPDATE and DELETE to
 * an owner, evaluated inside PostgreSQL. Wrapping it in an RPC would add a
 * second privileged path without adding a check the database does not already
 * make - unlike customer_type, whose column UPDATE is revoked outright and
 * therefore genuinely needs admin_set_customer_type().
 *
 * The new grant is written BEFORE the old ones are cleared, so a failure
 * between the two statements leaves the user with more access than intended for
 * a moment rather than none at all - recoverable, where a locked-out owner is
 * not. Demotion to plain customer is a single DELETE with no such window.
 */
export async function setUserRole(
  profileId: string,
  nextRole: AccountRole,
  actorId: string | null,
): Promise<void> {
  const supabase = getSupabaseClient()

  if (nextRole !== 'customer') {
    const { error } = await supabase
      .from('user_roles')
      .upsert(
        { profile_id: profileId, role: nextRole, granted_by: actorId },
        { onConflict: 'profile_id,role', ignoreDuplicates: true },
      )
    if (error) throw error
  }

  const clear = supabase.from('user_roles').delete().eq('profile_id', profileId)
  const { error } = await (nextRole === 'customer' ? clear : clear.neq('role', nextRole))
  if (error) throw error
}

/** Collapses the grants held by one profile into the single role to display. */
export function effectiveRole(grants: RoleGrant[]): AdminRole | null {
  if (grants.length === 0) return null
  return grants.reduce<AdminRole>(
    (best, grant) => (ROLE_RANK[grant.role] > ROLE_RANK[best] ? grant.role : best),
    grants[0].role,
  )
}

/** The role as the table displays it: an admin grant, or plain customer. */
export function displayRole(user: AdminUser): AccountRole {
  return user.adminRole ?? 'customer'
}

/**
 * Joins profiles, role grants and order statistics into the table's rows.
 *
 * Pure and synchronous: all three inputs come from three fixed queries, so
 * adding a customer never adds a request.
 */
export function composeUsers(
  customers: AdminCustomer[],
  grants: RoleGrant[],
  stats: Map<string, UserOrderStats>,
): AdminUser[] {
  const grantsByProfile = new Map<string, RoleGrant[]>()
  for (const grant of grants) {
    const list = grantsByProfile.get(grant.profile_id)
    if (list) list.push(grant)
    else grantsByProfile.set(grant.profile_id, [grant])
  }

  return customers.map((customer) => ({
    ...customer,
    adminRole: effectiveRole(grantsByProfile.get(customer.id) ?? []),
    stats: stats.get(customer.id) ?? NO_ORDER_STATS,
  }))
}

/** The filter values offered above the table. */
export const USER_FILTERS = [
  ['all', 'All users'],
  ['retail', 'Retail'],
  ['wholesale_vip', 'Wholesale VIP'],
  ['staff', 'Staff'],
  ['admin', 'Admin'],
  ['owner', 'Owner'],
] as const

export type UserFilter = (typeof USER_FILTERS)[number][0]

/**
 * Applies one filter to one row.
 *
 * Retail and Wholesale VIP are resolved through vipStatus(), so a customer
 * whose VIP has expired is filtered as Retail - which is what the database
 * actually prices them at.
 */
export function matchesUserFilter(user: AdminUser, filter: UserFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'wholesale_vip':
      return vipStatus(user) === 'vip'
    case 'retail':
      return vipStatus(user) !== 'vip'
    default:
      return user.adminRole === filter
  }
}

/** Users joined within this many days count towards the "New" tile. */
export const NEW_USER_WINDOW_DAYS = 30

export function isNewUser(user: AdminUser, now: Date = new Date()): boolean {
  const joined = new Date(user.created_at).getTime()
  return joined >= now.getTime() - NEW_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000
}

export interface UserSummary {
  total: number
  retail: number
  vip: number
  administrators: number
  newUsers: number
}

/**
 * The five overview tiles, counted from the loaded rows - never hardcoded.
 *
 * Retail and VIP deliberately count CUSTOMER accounts only, so that
 * retail + vip + administrators === total and the tiles reconcile. A colleague
 * who holds a staff grant is counted once, as an administrator.
 */
export function summarise(users: AdminUser[], now: Date = new Date()): UserSummary {
  const summary: UserSummary = { total: users.length, retail: 0, vip: 0, administrators: 0, newUsers: 0 }

  for (const user of users) {
    if (user.adminRole) summary.administrators += 1
    else if (vipStatus(user) === 'vip') summary.vip += 1
    else summary.retail += 1
    if (isNewUser(user, now)) summary.newUsers += 1
  }

  return summary
}
