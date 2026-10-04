import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { AdminRole } from './roles'
import { requestFieldsJson, type WholesaleRequestInput } from '@/lib/customer/wholesale'

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
 *
 * Completing or correcting an application on the customer's behalf goes
 * through admin_update_wholesale_request() (admin/owner only). It changes the
 * live fields and stamps admin_updated_by/_at, but never customer_values — the
 * snapshot of what the customer entered — so every field can be shown as
 * customer-provided, admin-entered or admin-corrected.
 */

type RequestRow = Database['public']['Tables']['wholesale_access_requests']['Row']

export type ReviewDecision = 'approved' | 'rejected'

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending: 'Submitted',
  assistance_requested: 'Assistance requested',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
}

/** Submitted and awaiting a decision — what "Pending" means in the queue. Drafts are not submitted. */
export const DECIDABLE_STATUSES = ['pending', 'assistance_requested', 'under_review'] as const

export function isDecidable(status: string): boolean {
  return (DECIDABLE_STATUSES as readonly string[]).includes(status)
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
  /** Internal staff note — stored apart from the application so the applicant can never read it. */
  adminNotes: string | null
  adminNotesUpdatedAt: string | null
}

interface EmbeddedRow extends RequestRow {
  profiles: {
    full_name: string | null
    email: string | null
    phone: string | null
    customer_type: string
  } | null
  wholesale_access_request_notes: { admin_notes: string; updated_at: string } | null
}

/**
 * The embed must name its foreign key.
 *
 * wholesale_access_requests points at profiles more than once — profile_id
 * (who applied), reviewed_by (which administrator decided) and
 * admin_updated_by (who last edited the application). Asking PostgREST for a bare
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

/** One-to-one (request_id is the notes table's primary key), staff-read RLS. */
const NOTES_EMBED = 'wholesale_access_request_notes(admin_notes, updated_at)'

/**
 * The whole queue with its customers, in ONE request.
 *
 * The embedded profiles join means the list never issues a lookup per row, and
 * it rides the "profiles staff read" policy that already exists.
 */
export async function listWholesaleRequests(): Promise<AdminWholesaleRequest[]> {
  const { data, error } = await getSupabaseClient()
    .from('wholesale_access_requests')
    .select(`*, ${CUSTOMER_EMBED}, ${NOTES_EMBED}`)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as EmbeddedRow[]).map(({ profiles, wholesale_access_request_notes: notes, ...request }) => ({
    ...request,
    customerName: profiles?.full_name ?? null,
    customerEmail: profiles?.email ?? null,
    customerPhone: profiles?.phone ?? null,
    customerType: profiles?.customer_type ?? null,
    adminNotes: notes?.admin_notes ?? null,
    adminNotesUpdatedAt: notes?.updated_at ?? null,
  }))
}

/**
 * Saves an administrator's completion/correction of an OPEN application and/or
 * the internal note. Editing moves the application to 'under_review'.
 *
 *   fields = null → application fields left untouched (e.g. notes on a closed one)
 *   notes  = null → note left untouched; '' clears it
 */
export async function updateRequest(
  requestId: string,
  fields: WholesaleRequestInput | null,
  notes: string | null,
): Promise<RequestRow> {
  const { data, error } = await getSupabaseClient().rpc('admin_update_wholesale_request', {
    p_request_id: requestId,
    p_fields: fields ? requestFieldsJson(fields) : undefined,
    p_admin_notes: notes ?? undefined,
  })

  if (error) throw error
  return data as unknown as RequestRow
}

/** The application fields, in form order, with their database column. */
export const APPLICATION_FIELDS = [
  { key: 'businessName', column: 'business_name', label: 'Business name' },
  { key: 'businessRegistration', column: 'business_registration', label: 'Business registration number' },
  { key: 'contactPhone', column: 'contact_phone', label: 'Contact phone' },
  { key: 'businessType', column: 'business_type', label: 'Business type' },
  { key: 'monthlyVolume', column: 'monthly_volume', label: 'Expected monthly volume' },
  { key: 'message', column: 'message', label: 'Additional details' },
] as const satisfies readonly { key: keyof WholesaleRequestInput; column: keyof RequestRow; label: string }[]

export type ApplicationField = (typeof APPLICATION_FIELDS)[number]

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Fields still blank. "Additional details" is free text and never counts as
 * missing. Only the business name is required to approve (unchanged rule);
 * the rest are flagged for the reviewer, not enforced — which fields a
 * wholesale customer must provide is a business decision not yet made.
 */
export function missingFields(request: RequestRow): ApplicationField[] {
  return APPLICATION_FIELDS.filter((field) => field.column !== 'message' && !text(request[field.column]))
}

export type FieldSource = 'customer' | 'admin-entered' | 'admin-corrected' | 'empty'

/** Where a field's current value came from, by comparing it with the customer's own snapshot. */
export function fieldSource(request: RequestRow, field: ApplicationField): FieldSource {
  const current = text(request[field.column])
  const snapshot = request.customer_values
  const original = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? text((snapshot as Record<string, unknown>)[field.column])
    : current
  if (!current) return 'empty'
  if (current === original) return 'customer'
  return original ? 'admin-corrected' : 'admin-entered'
}

/** The customer's own value for a field, when an admin has since corrected it. */
export function customerValue(request: RequestRow, field: ApplicationField): string {
  const snapshot = request.customer_values
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? text((snapshot as Record<string, unknown>)[field.column])
    : ''
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
