"use client"

import { useState, type FormEvent } from 'react'
import { AlertCircle, LoaderCircle, Pencil, RotateCw, ShieldCheck, User } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { AuthField } from '@/components/account/AuthShell'
import { VipBadge } from '@/components/account/VipBadge'
import { formatE164 } from '@/lib/auth/phone'
import { updateOwnProfile, type CustomerProfile, type CustomerType } from '@/lib/customer/profile'

/**
 * The "Your account" card on the profile screen: who is signed in, and at
 * which tier.
 *
 * Every value comes from the existing Supabase session and the customer's own
 * public.profiles row (read under "profiles read own"), passed in from
 * CustomerAuthContext — nothing here is hardcoded or read from local storage.
 *
 *   name   → profiles.full_name
 *   phone  → auth.users.phone, only when Supabase verified it by SMS code
 *   email  → the auth account's email; else profiles.email (the optional
 *            receipt address a phone customer gave at sign-up)
 *   tier   → profiles.customer_type via resolveCustomerType(), the same rule
 *            as private.current_customer_type() uses for pricing
 *
 * Editing is limited to what the database lets a customer write about
 * themselves (full_name, email). Tier, VIP fields, roles and the verified
 * phone are not offered, and PostgreSQL would refuse them anyway.
 */

const TIER_LABEL: Record<CustomerType, string> = {
  retail: 'Retail Customer',
  wholesale_vip: 'Wholesale VIP',
}

const CARD = 'mb-6 bg-surface border border-mint/80 dark:border-border rounded-[26px] p-4 shadow-card'
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ProfileIdentityCardProps {
  status: 'loading' | 'signed-in' | 'error'
  userId: string | null
  profile: CustomerProfile | null
  /** The auth account's email, if it has one. */
  email: string | null
  /** Verified E.164 phone from Supabase Auth, if any. */
  phone: string | null
  customerType: CustomerType
  vipExpired: boolean
  /** Re-reads the session and profile (CustomerAuthContext.refresh). */
  onReload: () => Promise<void>
}

export function ProfileIdentityCard(props: ProfileIdentityCardProps) {
  if (props.status === 'loading') return <IdentitySkeleton />
  if (props.status === 'error') return <IdentityError onRetry={props.onReload} />
  return <SignedInIdentity {...props} />
}

function IdentitySkeleton() {
  return (
    <div className={CARD} aria-busy="true">
      <span className="sr-only">Loading your account</span>
      <div className="flex items-center gap-4 animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <div className="h-[62px] w-[62px] shrink-0 rounded-full bg-well-strong" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-2/3 rounded-full bg-well-strong" />
          <div className="h-3.5 w-1/2 rounded-full bg-well-strong" />
          <div className="h-3.5 w-3/5 rounded-full bg-well-strong" />
        </div>
      </div>
      <div className="mt-3.5 h-6 w-28 rounded-full bg-well-strong animate-pulse motion-reduce:animate-none" aria-hidden="true" />
    </div>
  )
}

function IdentityError({ onRetry }: { onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false)

  async function retry() {
    setRetrying(true)
    try { await onRetry() } finally { setRetrying(false) }
  }

  return (
    <div className={`${CARD} flex items-center justify-between gap-3`}>
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <AlertCircle size={15} className="shrink-0" />
        Unable to load profile details
      </p>
      <button
        type="button"
        onClick={() => void retry()}
        disabled={retrying}
        className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-primary disabled:text-muted-foreground"
      >
        {retrying
          ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" />
          : <RotateCw size={14} />}
        Retry
      </button>
    </div>
  )
}

function SignedInIdentity({
  userId, profile, email, phone, customerType, vipExpired, onReload,
}: ProfileIdentityCardProps) {
  const [editing, setEditing] = useState(false)

  const name = profile?.full_name?.trim() || null
  const contactEmail = email || profile?.email?.trim() || null
  const phoneLabel = phone ? formatE164(phone) : null

  // The heading is the best identity available; the lines below never repeat it.
  const heading = name ?? phoneLabel ?? contactEmail ?? 'Your account'
  const details = [phoneLabel, contactEmail].filter((v): v is string => v !== null && v !== heading)
  const canEdit = userId !== null && profile !== null

  if (editing && canEdit) {
    return (
      <EditProfileForm
        userId={userId}
        initialName={name ?? ''}
        // An auth email is the sign-in identity, not something edited here.
        initialContactEmail={email ? null : (profile?.email?.trim() ?? '')}
        verifiedPhone={phoneLabel}
        onCancel={() => setEditing(false)}
        onSaved={async () => { await onReload(); setEditing(false) }}
      />
    )
  }

  return (
    <div className={CARD}>
      <div className="flex items-center gap-4">
        {name ? (
          <Avatar name={name} size={62} />
        ) : (
          <div className="rounded-full bg-gradient-cta p-[2.5px] shrink-0 shadow-glow" style={{ width: 62, height: 62 }}>
            <div className="flex h-full w-full items-center justify-center rounded-full bg-surface text-primary">
              <User size={26} strokeWidth={1.8} aria-hidden="true" />
            </div>
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{heading}</h1>
          {details.map((line) => (
            <p key={line} className="text-muted-foreground text-[13px] truncate">{line}</p>
          ))}
          {!name && canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="focus-ring mt-0.5 rounded-full text-[13px] font-semibold text-primary"
            >
              Add your name
            </button>
          )}
        </div>
      </div>

      {/* The tier the DATABASE resolved, not the experience chosen on the
          entry screen. An expired VIP grant is shown as retail, because that is
          what the customer is actually charged. */}
      <p className="mt-3.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Customer type
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {customerType === 'wholesale_vip' ? (
          <>
            <VipBadge />
            <span className="text-[12px] font-semibold text-foreground whitespace-nowrap">{TIER_LABEL.wholesale_vip}</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
            <User size={12} />
            {TIER_LABEL.retail}
          </span>
        )}
        {vipExpired && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
            Wholesale pricing expired
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-primary hover:bg-primary-soft transition-colors"
          >
            <Pencil size={13} />
            Edit profile
          </button>
        )}
      </div>
    </div>
  )
}

function EditProfileForm({
  userId, initialName, initialContactEmail, verifiedPhone, onCancel, onSaved,
}: {
  userId: string
  initialName: string
  /** null when the account signs in with an email, which is not edited here. */
  initialContactEmail: string | null
  verifiedPhone: string | null
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [fullName, setFullName] = useState(initialName)
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? '')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = fullName.trim()
    const mail = contactEmail.trim()

    if (name.length < 2) {
      setFormError('Enter your name so we know who to address orders to.')
      return
    }
    if (initialContactEmail !== null && mail !== '' && !EMAIL_SHAPE.test(mail)) {
      setFormError('That email address does not look right.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      // Only columns the database grants to customers (full_name, email).
      await updateOwnProfile(userId, initialContactEmail === null
        ? { full_name: name }
        : { full_name: name, email: mail === '' ? null : mail })
      await onSaved()
    } catch {
      setFormError('Could not save your details. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={CARD}>
      <h1 className="mb-4 text-lg font-bold tracking-tight">Edit profile</h1>

      <AuthField
        label="Full name" value={fullName} onChange={setFullName}
        autoComplete="name" disabled={saving} placeholder="Your name"
      />
      {initialContactEmail !== null && (
        <AuthField
          label="Email (optional)" type="email" value={contactEmail} onChange={setContactEmail}
          autoComplete="email" inputMode="email" required={false} disabled={saving}
          placeholder="you@example.com" hint="Only for order receipts. You sign in with your phone."
        />
      )}

      {verifiedPhone && (
        <p className="mb-4 flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <ShieldCheck size={14} className="shrink-0 text-primary" />
          {verifiedPhone} · verified sign-in number
        </p>
      )}

      {formError && (
        <p role="alert" className="mb-4 text-[13px] font-medium text-red-500">{formError}</p>
      )}

      <div className="flex gap-2.5">
        <Button type="button" variant="secondary" fullWidth disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" fullWidth disabled={saving}>
          {saving
            ? <><LoaderCircle size={16} className="mr-2 animate-spin motion-reduce:animate-none" />Saving…</>
            : 'Save'}
        </Button>
      </div>
    </form>
  )
}
