"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { getSupabaseClient } from '@/lib/supabase/client'
import { NATIVE_REDIRECT_URL } from '@/lib/auth/google'

/**
 * Catches Google's redirect coming back into the Capacitor app.
 *
 * `signInWithGoogle()` opens the system browser rather than navigating this
 * WebView, so there is no page load here to auto-detect a session from — the
 * OS instead hands the returned URL to this listener as an `appUrlOpen`
 * event once Supabase finishes its own exchange with Google and redirects to
 * NATIVE_REDIRECT_URL. From here it is the same PKCE code exchange
 * `supabase.auth.exchangeCodeForSession` performs for the web, just triggered
 * manually instead of by URL detection.
 *
 * Mounted once, near the root of the customer shell. A pure no-op on the web
 * build, where Capacitor.isNativePlatform() is false.
 */
export function NativeOAuthListener() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const handle = App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      if (!event.url.startsWith(NATIVE_REDIRECT_URL)) return

      const code = new URL(event.url).searchParams.get('code')
      void (async () => {
        if (code) {
          await getSupabaseClient().auth.exchangeCodeForSession(code)
        }
        await Browser.close().catch(() => { /* already closed */ })
        router.replace('/auth/callback')
      })()
    })

    return () => { void handle.then((h) => h.remove()) }
  }, [router])

  return null
}
