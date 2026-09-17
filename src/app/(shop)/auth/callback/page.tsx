"use client"

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoaderCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AuthShell } from '@/components/account/AuthShell'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { resolvePostSignInDestination } from '@/lib/customer/profile'
import { endGuestSession } from '@/lib/auth/guestMode'

/**
 * Where both the web and native Google flows land once Supabase has a
 * session.
 *
 * On the web this page is reached by the actual OAuth redirect, and
 * supabase-js's own `detectSessionInUrl` already parses the returned `?code=`
 * before this component ever renders — CustomerAuthContext just has to pick
 * the resulting session up the same way it picks up any other sign-in.
 *
 * On native this page is reached by `nativeOAuthListener.tsx` after it has
 * already called `exchangeCodeForSession` itself, so by the time we get here
 * the two paths are identical: wait for `CustomerAuthContext` to resolve,
 * then route on exactly like the phone-OTP flow does.
 */
function CallbackBody() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status, profile, customerType } = useCustomerAuth()

  const oauthError = searchParams.get('error_description') ?? searchParams.get('error')

  useEffect(() => {
    if (oauthError) return
    if (status !== 'signed-in') return
    endGuestSession()
    router.replace(resolvePostSignInDestination(customerType))
  }, [oauthError, status, customerType, profile, router])

  if (oauthError) {
    return (
      <AuthShell
        title="Sign-in didn't complete"
        subtitle="Google sign-in was cancelled or could not finish."
        footer={
          <Button onClick={() => router.replace('/account/sign-in')} fullWidth size="lg">
            Try again
          </Button>
        }
      >
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[13px] leading-snug text-foreground">
            Nothing was signed in. You can try again, or use another sign-in method.
          </p>
        </div>
      </AuthShell>
    )
  }

  if (status === 'error') {
    return (
      <AuthShell
        title="We could not finish signing you in"
        subtitle="Your Google sign-in worked, but loading your account failed."
        footer={
          <Button onClick={() => router.replace('/account/sign-in')} fullWidth size="lg">
            Back to sign in
          </Button>
        }
      >
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[13px] leading-snug text-foreground">
            Check your connection and try again from your profile.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Signing you in" subtitle="One moment while we finish with Google." footer={null}>
      <div className="flex items-center justify-center gap-2.5 py-10 text-sm text-muted-foreground">
        <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
        Signing you in…
      </div>
    </AuthShell>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Signing you in" subtitle="One moment while we finish with Google." footer={null}>
          <div className="flex items-center justify-center gap-2.5 py-10 text-sm text-muted-foreground">
            <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
            Signing you in…
          </div>
        </AuthShell>
      }
    >
      <CallbackBody />
    </Suspense>
  )
}
