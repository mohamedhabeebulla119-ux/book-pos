import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { getSupabaseClient, getSupabaseEnv } from '@/lib/supabase/client'

/**
 * THE GOOGLE OAUTH BOUNDARY.
 *
 * Every part of the customer authentication UI that wants Google sign-in talks
 * to Supabase through this file and nothing else — the same shape as
 * `src/lib/auth/otp.ts` for phone. If a second OAuth provider is ever added, it
 * gets its own module beside this one rather than a branch inside it.
 *
 * On the web this is a plain full-page redirect: Supabase Auth sends the
 * browser to Google and back to `redirectTo`, and supabase-js's own
 * `detectSessionInUrl` (on by default) finishes the sign-in the moment the
 * returned page constructs its Supabase client — no code in this app has to
 * touch the token.
 *
 * Inside the Capacitor Android app there is no page navigation to catch a
 * redirect with: Google will not complete OAuth inside an embedded WebView at
 * all (their own policy), so the flow instead opens the system browser
 * (Chrome Custom Tabs, via @capacitor/browser) and asks Supabase to redirect
 * to a custom URL scheme instead of a web page. Android hands that scheme back
 * to the app as an `appUrlOpen` event, which `nativeOAuthListener.tsx` is
 * listening for — this module only has to know how to kick the flow off.
 */

/** Registered in AndroidManifest.xml's second <intent-filter> on MainActivity. */
export const NATIVE_REDIRECT_URL = 'com.appleexpert.app://auth-callback'

// ---------------------------------------------------------------------------
// Capability
// ---------------------------------------------------------------------------

/**
 * Whether this Supabase project has the Google provider turned on.
 *
 * Same technique as `fetchPhoneAuthAvailability`: /auth/v1/settings is
 * GoTrue's public capability document, needing only the publishable key that
 * already ships in the app. The day Google is configured in the dashboard,
 * this flips to 'available' on the installed APK with no rebuild.
 */
export type GoogleAuthAvailability = 'checking' | 'available' | 'unavailable' | 'unknown'

export async function fetchGoogleAuthAvailability(
  signal?: AbortSignal,
): Promise<Exclude<GoogleAuthAvailability, 'checking'>> {
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
    return external?.google === true ? 'available' : 'unavailable'
  } catch {
    // Offline, or the request was aborted by an unmounting screen.
    return 'unknown'
  }
}

// ---------------------------------------------------------------------------
// Starting the flow
// ---------------------------------------------------------------------------

export type GoogleSignInResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Starts "Continue with Google". Never returns a session directly — on the
 * web the browser is about to navigate away entirely, and on native the
 * result arrives later through the appUrlOpen listener.
 *
 * `onBrowserClosed`, native only: fires when the Custom Tab closes for any
 * reason, including the customer cancelling instead of finishing with Google.
 * There is no separate "the user cancelled" event to listen for — a completed
 * sign-in also closes the tab (nativeOAuthListener.tsx calls Browser.close()
 * itself) — so callers use this only to stop a busy spinner, never to assume
 * failure.
 */
export async function signInWithGoogle(onBrowserClosed?: () => void): Promise<GoogleSignInResult> {
  const supabase = getSupabaseClient()

  if (Capacitor.isNativePlatform()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: NATIVE_REDIRECT_URL, skipBrowserRedirect: true },
    })
    if (error || !data.url) {
      return { ok: false, message: error?.message ?? 'Could not start Google sign-in.' }
    }
    if (onBrowserClosed) {
      const handle = await Browser.addListener('browserFinished', () => {
        onBrowserClosed()
        void handle.remove()
      })
    }
    await Browser.open({ url: data.url })
    return { ok: true }
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
  if (error) return { ok: false, message: error.message }
  // On success the browser is already navigating to Google; nothing left to do.
  return { ok: true }
}
