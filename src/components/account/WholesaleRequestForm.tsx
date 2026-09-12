"use client"

import { useState, type FormEvent } from 'react'
import { LoaderCircle, AlertCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AuthField } from '@/components/account/AuthShell'
import {
  submitRequest, BUSINESS_TYPES, MONTHLY_VOLUMES,
  type WholesaleRequest, type WholesaleRequestInput,
} from '@/lib/customer/wholesale'

/**
 * The wholesale access application.
 *
 * Submitting this grants nothing. It writes a row to
 * public.wholesale_access_requests with status 'pending' — a value the customer
 * cannot override, because the migration revoked table-level INSERT and granted
 * it back on the customer-fillable columns only. An administrator reviews it,
 * and approval routes through admin_set_customer_type() inside PostgreSQL.
 */

const SELECT =
  'focus-ring w-full h-12 rounded-2xl border border-mint-deep dark:border-border bg-card px-4 text-sm text-foreground focus:outline-none focus:border-primary/45 transition-colors disabled:opacity-60'

const EMPTY: WholesaleRequestInput = {
  businessName: '',
  businessRegistration: '',
  contactPhone: '',
  businessType: '',
  monthlyVolume: '',
  message: '',
}

export function WholesaleRequestForm({
  profileId, onSubmitted,
}: {
  profileId: string
  onSubmitted: (request: WholesaleRequest) => void
}) {
  const [input, setInput] = useState<WholesaleRequestInput>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof WholesaleRequestInput>(key: K, value: WholesaleRequestInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!input.businessName.trim()) {
      setError('Tell us the name of your business.')
      return
    }

    setSubmitting(true)
    try {
      const request = await submitRequest(profileId, input)
      onSubmitted(request)
    } catch (err) {
      // The partial unique index refuses a second open application; say so
      // plainly rather than showing the raw constraint name.
      const message = err instanceof Error ? err.message : 'Your request could not be sent.'
      setError(
        message.includes('wholesale_access_requests_one_pending_uq')
          ? 'You already have an application under review.'
          : message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[26px] border border-mint/80 dark:border-border bg-surface p-5 shadow-card"
    >
      <h2 className="text-[17px] font-bold tracking-tight text-foreground">Request wholesale access</h2>
      <p className="mt-1.5 mb-5 text-[13px] leading-relaxed text-muted-foreground">
        Tell us about your business. Apple Expert reviews every application by hand.
      </p>

      <AuthField
        label="Business name" value={input.businessName}
        onChange={(v) => set('businessName', v)} disabled={submitting}
        placeholder="e.g. Colombo Mobile Care" autoComplete="organization"
      />
      <AuthField
        label="Business registration number" value={input.businessRegistration}
        onChange={(v) => set('businessRegistration', v)} disabled={submitting}
        required={false} placeholder="Optional"
      />
      <AuthField
        label="Contact phone" type="tel" value={input.contactPhone}
        onChange={(v) => set('contactPhone', v)} disabled={submitting}
        required={false} inputMode="tel" autoComplete="tel" placeholder="Optional"
      />

      <div className="mb-4">
        <label htmlFor="business-type" className="mb-1.5 block text-[13px] font-semibold text-foreground">
          Business type
        </label>
        <select
          id="business-type" value={input.businessType} disabled={submitting}
          onChange={(e) => set('businessType', e.target.value)} className={SELECT}
        >
          <option value="">Select a type…</option>
          {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="monthly-volume" className="mb-1.5 block text-[13px] font-semibold text-foreground">
          Expected monthly volume
        </label>
        <select
          id="monthly-volume" value={input.monthlyVolume} disabled={submitting}
          onChange={(e) => set('monthlyVolume', e.target.value)} className={SELECT}
        >
          <option value="">Select a range…</option>
          {MONTHLY_VOLUMES.map((volume) => <option key={volume} value={volume}>{volume}</option>)}
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="request-message" className="mb-1.5 block text-[13px] font-semibold text-foreground">
          Anything else?
        </label>
        <textarea
          id="request-message" rows={3} value={input.message} disabled={submitting}
          onChange={(e) => set('message', e.target.value)}
          placeholder="Optional — what you buy, how often, anything we should know."
          className="focus-ring w-full rounded-2xl border border-mint-deep dark:border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45 transition-colors disabled:opacity-60 resize-none"
        />
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/8 px-3.5 py-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-[13px] leading-snug text-foreground">{error}</p>
        </div>
      )}

      <Button type="submit" fullWidth size="lg" disabled={submitting}>
        {submitting ? (
          <><LoaderCircle size={17} className="mr-2 animate-spin motion-reduce:animate-none" />Sending…</>
        ) : (
          <><Send size={16} className="mr-2" />Submit request</>
        )}
      </Button>
    </form>
  )
}
