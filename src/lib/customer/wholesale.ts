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
 * The customer may SELECT their own rows, and writes go through
 * customer_save_wholesale_application() (draft / submit / request assistance).
 * There is deliberately no UPDATE or DELETE policy for anyone, so a submitted
 * application cannot be edited by the customer, and a decision cannot be
 * rewritten from a browser.
 */

type RequestRow = Database['public']['Tables']['wholesale_access_requests']['Row']

/**
 * The application lifecycle. 'pending' is the stored value for SUBMITTED — the
 * original name is kept so installed builds keep working (see migration
 * 20261005120000). None of these statuses grants anything: access comes only
 * from profiles.customer_type, which an approval sets inside PostgreSQL.
 */
export const REQUEST_STATUSES = [
  'draft', 'pending', 'assistance_requested', 'under_review', 'approved', 'rejected',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** Statuses that still await a decision. At most one per customer (unique index). */
export const OPEN_STATUSES: readonly RequestStatus[] = ['draft', 'pending', 'assistance_requested', 'under_review']

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  draft: 'Draft',
  pending: 'Submitted',
  assistance_requested: 'Assistance requested',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Changes required',
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

export const EMPTY_REQUEST_INPUT: WholesaleRequestInput = {
  businessName: '',
  businessRegistration: '',
  contactPhone: '',
  businessType: '',
  monthlyVolume: '',
  message: '',
}

/** Prefills the form from an earlier application (a draft, or a rejected one being resubmitted). */
export function inputFromRequest(request: WholesaleRequest): WholesaleRequestInput {
  return {
    businessName: request.business_name ?? '',
    businessRegistration: request.business_registration ?? '',
    contactPhone: request.contact_phone ?? '',
    businessType: request.business_type ?? '',
    monthlyVolume: request.monthly_volume ?? '',
    message: request.message ?? '',
  }
}

/** The JSON keys customer_save_wholesale_application() / admin_update_wholesale_request() read. */
export function requestFieldsJson(input: WholesaleRequestInput) {
  return {
    business_name: input.businessName,
    business_registration: input.businessRegistration,
    contact_phone: input.contactPhone,
    business_type: input.businessType,
    monthly_volume: input.monthlyVolume,
    message: input.message,
  }
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
export function openRequest(requests: WholesaleRequest[]): WholesaleRequest | null {
  return requests.find((request) => (OPEN_STATUSES as readonly string[]).includes(request.status)) ?? null
}

/** The most recent decision, used to explain a rejection before re-applying. */
export function latestDecision(requests: WholesaleRequest[]): WholesaleRequest | null {
  return requests.find((request) => request.status === 'approved' || request.status === 'rejected') ?? null
}

export type SaveAction = 'draft' | 'submit' | 'assistance'

/**
 * Saves, submits, or asks Apple Expert staff to complete the caller's
 * application — all through customer_save_wholesale_application().
 *
 * Only the six form fields and the action are sent. The function resolves the
 * applicant from auth.uid() and decides the status itself, so there is no
 * profile id, status or customer type for a client to tamper with; extra JSON
 * keys are ignored by PostgreSQL. A submitted application cannot be edited by
 * the customer; the one change still allowed is asking for assistance.
 */
export async function saveApplication(
  input: WholesaleRequestInput,
  action: SaveAction,
): Promise<WholesaleRequest> {
  const { data, error } = await getSupabaseClient().rpc('customer_save_wholesale_application', {
    p_fields: requestFieldsJson(input),
    p_action: action,
  })

  if (error) throw error
  return data as unknown as WholesaleRequest
}

/** Plain-language versions of the RPC's refusals. */
export function describeSaveError(err: unknown): string {
  const message = err instanceof Error ? err.message
    : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message)
    : ''
  if (message.includes('business_name_required')) return 'Tell us the name of your business.'
  if (message.includes('application_locked') || message.includes('wholesale_access_requests_one_pending_uq')) {
    return 'You already have an application with our team.'
  }
  if (message.includes('already_wholesale')) return 'Your account already has wholesale access.'
  return message || 'Your application could not be sent.'
}
