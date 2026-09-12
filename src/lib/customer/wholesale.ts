import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'

/**
 * Wholesale access requests, customer side.
 *
 * A request is an APPLICATION, never a grant. Inserting one changes no pricing
 * whatsoever: public.wholesale_access_requests has no relationship to
 * profiles.customer_type, and the only thing that can change that column is
 * admin_set_customer_type() — which an administrator reaches by reviewing the
 * request, not by the customer submitting it.
 *
 * The customer may INSERT (own rows only) and SELECT (own rows only). There is
 * deliberately no UPDATE or DELETE policy for anyone, so a submitted
 * application cannot be edited after the fact, and a decision cannot be
 * rewritten from a browser.
 */

type RequestRow = Database['public']['Tables']['wholesale_access_requests']['Row']

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Under review',
  approved: 'Approved',
  rejected: 'Not approved',
}

export function isRequestStatus(value: string): value is RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(value)
}

export type WholesaleRequest = RequestRow

/** What the application form collects. */
export interface WholesaleRequestInput {
  businessName: string
  businessRegistration: string
  contactPhone: string
  businessType: string
  monthlyVolume: string
  message: string
}

export const BUSINESS_TYPES = [
  'Repair shop',
  'Retailer / reseller',
  'Corporate / bulk buyer',
  'Distributor',
  'Other',
] as const

export const MONTHLY_VOLUMES = [
  'Under 10 units',
  '10 – 50 units',
  '50 – 200 units',
  '200+ units',
] as const

/**
 * The caller's own applications, newest first.
 *
 * "wholesale_requests own read" scopes this to profile_id = auth.uid(), so no
 * customer id needs to be passed or trusted from the client.
 */
export async function listOwnRequests(): Promise<WholesaleRequest[]> {
  const { data, error } = await getSupabaseClient()
    .from('wholesale_access_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/** The open application, if one exists. At most one can, by partial unique index. */
export function pendingRequest(requests: WholesaleRequest[]): WholesaleRequest | null {
  return requests.find((request) => request.status === 'pending') ?? null
}

/** The most recent decision, used to explain a rejection before re-applying. */
export function latestDecision(requests: WholesaleRequest[]): WholesaleRequest | null {
  return requests.find((request) => request.status !== 'pending') ?? null
}

/** Empty optional fields are stored as NULL rather than as empty strings. */
function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Submits an application.
 *
 * `status`, `reviewed_by`, `reviewed_at` and `review_note` are not sent and
 * could not be written if they were: the migration revoked table-level INSERT
 * and granted it back on the customer-fillable columns only, so status takes
 * its 'pending' default inside PostgreSQL.
 *
 * profile_id is passed explicitly because it is a NOT NULL column, and the
 * insert policy independently checks it equals auth.uid() — a client that sent
 * someone else's id would simply be refused.
 */
export async function submitRequest(
  profileId: string,
  input: WholesaleRequestInput,
): Promise<WholesaleRequest> {
  const { data, error } = await getSupabaseClient()
    .from('wholesale_access_requests')
    .insert({
      profile_id: profileId,
      business_name: input.businessName.trim(),
      business_registration: orNull(input.businessRegistration),
      contact_phone: orNull(input.contactPhone),
      business_type: orNull(input.businessType),
      monthly_volume: orNull(input.monthlyVolume),
      message: orNull(input.message),
    })
    .select()
    .single()

  if (error) throw error
  return data
}
