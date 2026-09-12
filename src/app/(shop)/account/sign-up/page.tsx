"use client"

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoaderCircle, MailCheck, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AuthShell, AuthField, PasswordField } from '@/components/account/AuthShell'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { getExperience } from '@/utils/experience'

/**
 * Customer sign-up.
 *
 * Every account created here is a RETAIL account. Nothing on this form can
 * change that: public.profiles is populated by the handle_new_user() trigger
 * with customer_type taking its 'retail' default, and the column's UPDATE
 * privilege is revoked from `authenticated`. A shopper who came through the
 * Wholesale entry card signs up exactly the same way, then applies for
 * wholesale access — which an administrator reviews.
 *
 * full_name is passed as auth metadata rather than written to profiles
 * afterwards, because handle_new_user() already reads
 * raw_user_meta_data ->> 'full_name'. A second client-side write would race it.
 */

const MIN_PASSWORD_LENGTH = 8

export default function CustomerSignUpPage() {
  const router = useRouter()
  const { status, refresh } = useCustomerAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  /** Set when Supabase created the account but withheld a session pending email confirmation. */
  const [confirmSent, setConfirmSent] = useState(false)

  function destination(): string {
    return getExperience() === 'wholesale' ? '/wholesale' : '/'
  }

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
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await getSupabaseClient().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      })

      if (error) {
        setFormError(error.message)
        return
      }

      // With email confirmation enabled Supabase returns a user but no session.
      // Claiming success and routing into the store would strand them signed out.
      if (!data.session) {
        setConfirmSent(true)
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

  if (confirmSent) {
    return (
      <AuthShell
        title="Confirm your email"
        subtitle="Your account has been created."
        footer={
          <p className="text-[13px] text-muted-foreground">
            Already confirmed?{' '}
            <Link href="/account/sign-in" className="focus-ring rounded font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        }
      >
        <div className="rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 text-center shadow-card">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-mint-deep bg-well-strong text-primary">
            <MailCheck size={25} strokeWidth={1.8} />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We sent a confirmation link to{' '}
            <strong className="font-semibold text-foreground">{email.trim()}</strong>. Open it to
            activate your account, then sign in.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="One account for orders, saved items and pricing."
      footer={
        <p className="text-[13px] text-muted-foreground">
          Already have an account?{' '}
          <Link href="/account/sign-in" className="focus-ring rounded font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-[26px] border border-mint/80 dark:border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <AuthField
          label="Full name" value={fullName} onChange={setFullName}
          autoComplete="name" disabled={submitting} placeholder="Your name"
        />
        <AuthField
          label="Email" type="email" value={email} onChange={setEmail}
          autoComplete="username" inputMode="email" disabled={submitting}
          placeholder="you@example.com"
        />
        <PasswordField
          label="Password" value={password} onChange={setPassword}
          autoComplete="new-password" disabled={submitting}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />

        {formError && (
          <p role="alert" className="mb-4 text-[13px] font-medium text-red-500">{formError}</p>
        )}

        <Button type="submit" fullWidth size="lg" disabled={submitting}>
          {submitting ? (
            <><LoaderCircle size={17} className="mr-2 animate-spin motion-reduce:animate-none" />Creating account…</>
          ) : 'Create account'}
        </Button>

        <p className="mt-4 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          New accounts start on Retail pricing. Wholesale pricing is granted by Apple Expert after
          reviewing a wholesale access request.
        </p>
      </form>
    </AuthShell>
  )
}
