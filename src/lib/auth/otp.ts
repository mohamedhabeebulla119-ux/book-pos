import type { AuthError, Session } from '@supabase/supabase-js'
import { getSupabaseClient, getSupabaseEnv } from '@/lib/supabase/client'

/**
 * THE SMS OTP BOUNDARY.
 *
 * Every part of the customer authentication UI talks to the provider through
 * this file and nothing else. Today the provider is Supabase Auth's own phone
 * channel; when Apple Expert buys an SMS gateway, it is configured in the
 * Supabase dashboard (Authentication -> Providers -> Phone) and the functions
 * below start working with NO change to any screen.
 *
 * Two rules this module exists to enforce:
 *
 *   1. There is no fake mode. Nothing here invents a code, accepts a code, or
 *      reports a message as sent. `sendOtp` calls the real endpoint, and if the
 *      project has no SMS provider the caller is told exactly that.
 *   2. Verification is the database's answer, never this app's. A session
 *      appears only because GoTrue validated the code it issued.
 */

/** Supabase's phone OTP is six digits. */
export const OTP_LENGTH = 6

/** How long before "Resend code" becomes available again. */
export const RESEND_SECONDS = 45

// ---------------------------------------------------------------------------
// Capability
// ---------------------------------------------------------------------------

/**
 * Whether this Supabase project can actually send an SMS right now.
 *
 *   'checking'    – the probe is in flight
 *   'available'   – a phone provider is configured; OTP sign-in works
 *   'unavailable' – no provider yet; the UI must say so instead of pretending
 *   'unknown'     – the probe itself failed (offline, for example)
 */
export type PhoneAuthAvailability = 'checking' | 'available' | 'unavailable' | 'unknown'

/**
 * Asks GoTrue which providers are enabled.
 *
 * /auth/v1/settings is the public capability document for the project — the
 * same one the Supabase UI libraries read to decide which buttons to render. It
 * exposes no user data and needs only the publishable key that already ships in
 * the app.
 *
 * Reading it means the screen reflects the project's real configuration: the
 * day the SMS provider is switched on, the OTP form goes live on the installed
 * APK without a rebuild.
 */
export async function fetchPhoneAuthAvailability(
  signal?: AbortSignal,
): Promise<Exclude<PhoneAuthAvailability, 'checking'>> {
  const env = getSupabaseEnv()
  if (!env) return 'unavailable'

  try {
    const response = await fetch(`${env.url}/auth/v1/settings`, {
      headers: { apikey: env.key },
      signal,
    })
    if (!response.ok) return 'unknown'

    const settings: unknown = await response.json()
    const external = (settings as { external?: Record<string, unknown> } | null)?.external
    const phone = external?.phone
    return phone === true ? 'available' : 'unavailable'
  } catch {
    // Offline, or the request was aborted by an unmounting screen.
    return 'unknown'
  }
}

// ---------------------------------------------------------------------------
// Sending and verifying
// ---------------------------------------------------------------------------

export type OtpFailure =
  /** No SMS provider configured on the Supabase project yet. */
  | 'provider-disabled'
  /** Too many requests — Supabase throttles OTP sends per number and per hour. */
  | 'rate-limited'
  /** The number was rejected by Supabase or the provider. */
  | 'invalid-phone'
  /** Wrong or expired code. */
  | 'invalid-code'
  /** Could not reach Supabase at all. */
  | 'network'
  | 'unknown'

export type SendOtpResult =
  | { ok: true }
  | { ok: false; kind: OtpFailure; message: string }

export type VerifyOtpResult =
  | { ok: true; session: Session }
  | { ok: false; kind: OtpFailure; message: string }

/**
 * Classifies a GoTrue error.
 *
 * Matched on `code` first, which is stable, and on the message only as a
 * fallback for older Supabase releases that predate the error codes.
 */
function classify(error: AuthError): { kind: OtpFailure; message: string } {
  const code = error.code ?? ''
  const text = error.message.toLowerCase()

  if (code === 'phone_provider_disabled' || text.includes('unsupported phone provider')) {
    return {
      kind: 'provider-disabled',
      message: 'SMS verification is not switched on for this store yet.',
    }
  }
  if (code === 'over_sms_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429) {
    return {
      kind: 'rate-limited',
      message: 'Too many codes requested. Wait a minute and try again.',
    }
  }
  if (code === 'otp_expired') {
    return { kind: 'invalid-code', message: 'That code has expired. Request a new one.' }
  }
  if (code === 'otp_disabled') {
    return { kind: 'provider-disabled', message: 'SMS sign-in is disabled for this store.' }
  }
  if (code === 'validation_failed' || code === 'invalid_credentials' || error.status === 400) {
    return { kind: 'invalid-code', message: 'That code was not accepted. Check it and try again.' }
  }
  if (code === 'phone_not_confirmed') {
    return { kind: 'invalid-code', message: 'That number has not been verified yet.' }
  }
  return { kind: 'unknown', message: error.message }
}

/**
 * Asks Supabase to send a verification code to an E.164 number.
 *
 * `shouldCreateUser` is left at its default of true, which is what makes one
 * flow serve both sign-in and sign-up: an unknown number becomes an account on
 * successful verification, and public.handle_new_user() creates the matching
 * profiles row with customer_type taking its 'retail' default. Nothing in this
 * request can influence that tier.
 */
export async function sendOtp(e164: string): Promise<SendOtpResult> {
  try {
    const { error } = await getSupabaseClient().auth.signInWithOtp({ phone: e164 })
    if (error) return { ok: false, ...classify(error) }
    return { ok: true }
  } catch {
    return {
      ok: false,
      kind: 'network',
      message: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

/**
 * Verifies a code against the one GoTrue issued.
 *
 * The session in the result was minted by Supabase. This app never decides that
 * a code was correct, and there is no branch here that can return ok:true
 * without a real session.
 */
export async function verifyOtp(e164: string, token: string): Promise<VerifyOtpResult> {
  try {
    const { data, error } = await getSupabaseClient().auth.verifyOtp({
      phone: e164,
      token,
      type: 'sms',
    })
    if (error) return { ok: false, ...classify(error) }
    if (!data.session) {
      // Defensive: a 200 with no session is not a signed-in customer.
      return {
        ok: false,
        kind: 'unknown',
        message: 'Verification did not return a session. Please try again.',
      }
    }
    return { ok: true, session: data.session }
  } catch {
    return {
      ok: false,
      kind: 'network',
      message: 'Could not reach the server. Check your connection and try again.',
    }
  }
}
