import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { AdminRole } from './roles'

/**
 * Wholesale access requests, admin side.
 *
 * Reads ride "wholesale_requests staff read", so staff, admin and owner can all
 * work the queue. Decisions go exclusively through
 * admin_review_wholesale_request(): the table has no UPDATE policy for any role
 * and table-level UPDATE is revoked from `authenticated`, so there is no other
 * path — a decision cannot be rewritten from a browser.
 *
 * Approving does NOT write profiles.customer_type from here. The RPC calls
 * admin_set_customer_type() inside PostgreSQL, which keeps that function the
 * single mechanism for granting VIP and preserves its audit stamping.
 */

type RequestRow = Database['public']['Tables']['wholesale_access_requests']['Row']

export type ReviewDecision = 'approved' | 'rejected'

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

/** Staff may read the queue; only admin and owner may decide it. */
export function canReviewRequests(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

export interface AdminWholesaleRequest extends RequestRow {
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  /** The tier the customer is on right now, for context beside the decision. */
  customerType: string | null
}

interface EmbeddedRow extends RequestRow {
  profiles: {
    full_name: string | null
    email: string | null
    phone: string | null
    customer_type: string
  } | null
}

/**
 * The embed must name its foreign key.
 *
 * wholesale_access_requests points at profiles TWICE — profile_id (who applied)
 * and reviewed_by (which administrator decided). Asking PostgREST for a bare
 * `profiles(...)` embed is therefore ambiguous, and it refuses the whole query
 * with PGRST201 rather than guessing:
 *
 *   "Could not embed because more than one relationship was found for
 *    'wholesale_access_requests' and 'profiles'"
 *
 * That refusal happens while the query is being planned, BEFORE row-level
 * security is consulted, so it failed identically for owner, admin and staff
 * and the review queue could never load a single row. Naming the constraint
 * resolves it to the applicant, which is the person the queue is about.
 */
const CUSTOMER_EMBED = 'profiles!wholesale_access_requests_profile_id_fkey(full_name, email, phone, customer_type)'

/**
 * The whole queue with its customers, in ONE request.
 *
 * The embedded profiles join means the list never issues a lookup per row, and
 * it rides the "profiles staff read" policy that already exists.
 */
export async function listWholesaleRequests(): Promise<AdminWholesaleRequest[]> {
  const { data, error } = await getSupabaseClient()
    .from('wholesale_access_requests')
    .select(`*, ${CUSTOMER_EMBED}`)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as EmbeddedRow[]).map(({ profiles, ...request }) => ({
    ...request,
    customerName: profiles?.full_name ?? null,
    customerEmail: profiles?.email ?? null,
    customerPhone: profiles?.phone ?? null,
    customerType: profiles?.customer_type ?? null,
  }))
}

/**
 * Records a decision, and on approval grants Wholesale VIP.
 *
 * The RPC is idempotent on status: a second submit against an already-decided
 * request is refused by PostgreSQL rather than silently re-deciding it.
 */
export async function reviewRequest(
  requestId: string,
  decision: ReviewDecision,
  note: string,
): Promise<RequestRow> {
  const { data, error } = await getSupabaseClient().rpc('admin_review_wholesale_request', {
    p_request_id: requestId,
    p_status: decision,
    p_note: note.trim() ? note.trim() : undefined,
  })

  if (error) throw error
  return data as unknown as RequestRow
}

/** Case-insensitive match across the fields worth searching. */
export function matchesRequestQuery(request: AdminWholesaleRequest, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    request.business_name.toLowerCase().includes(q) ||
    (request.customerName?.toLowerCase().includes(q) ?? false) ||
    (request.customerEmail?.toLowerCase().includes(q) ?? false) ||
    (request.contact_phone?.toLowerCase().includes(q) ?? false) ||
    (request.business_registration?.toLowerCase().includes(q) ?? false)
  )
}
