"use client"

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AuthShell, AuthField, PasswordField } from '@/components/account/AuthShell'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { getExperience } from '@/utils/experience'

/**
 * Customer sign-in.
 *
 * Signing in proves identity. It grants no pricing tier of its own: the
 * customer's tier is whatever public.profiles.customer_type already says, and
 * the catalog is re-read against the new session by CustomerAuthProvider so
 * prices update without a reload.
 *
 * Where the customer lands is decided by the experience they chose on the entry
 * screen — deliberately read from storage rather than a ?next= parameter, which
 * under `output: "export"` would force a Suspense boundary around
 * useSearchParams for no benefit.
 */
export default function CustomerSignInPage() {
  const router = useRouter()
  const { status, refresh } = useCustomerAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function destination(): string {
    return getExperience() === 'wholesale' ? '/wholesale' : '/'
  }

  // Already signed in? Nothing to do here.
  useEffect(() => {
    if (status === 'signed-in') router.replace(destination())
  }, [status, router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!isSupabaseConfigured()) {
      setFormError('Accounts are unavailable in this build.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        // Deliberately generic: never reveal whether the address has an account.
        setFormError('Those details were not accepted. Check your email and password.')
        return
      }

      await refresh()
      router.replace(destination())
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your orders, saved items and your pricing."
      footer={
        <p className="text-[13px] text-muted-foreground">
          New to Apple Expert?{' '}
          <Link href="/account/sign-up" className="focus-ring rounded font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-[26px] border border-mint/80 dark:border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <AuthField
          label="Email" type="email" value={email} onChange={setEmail}
          autoComplete="username" inputMode="email" disabled={submitting}
          placeholder="you@example.com"
        />
        <PasswordField
          label="Password" value={password} onChange={setPassword}
          autoComplete="current-password" disabled={submitting}
        />

        {formError && (
          <p role="alert" className="mb-4 text-[13px] font-medium text-red-500">{formError}</p>
        )}

        <Button type="submit" fullWidth size="lg" disabled={submitting}>
          {submitting ? (
            <><LoaderCircle size={17} className="mr-2 animate-spin motion-reduce:animate-none" />Signing in…</>
          ) : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}
