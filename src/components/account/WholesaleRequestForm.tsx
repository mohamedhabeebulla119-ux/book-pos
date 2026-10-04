"use client"

import { useState, type FormEvent } from 'react'
import { LoaderCircle, AlertCircle, Send, LifeBuoy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AuthField } from '@/components/account/AuthShell'
import {
  saveApplication, describeSaveError, BUSINESS_TYPES, MONTHLY_VOLUMES, EMPTY_REQUEST_INPUT,
  type SaveAction, type WholesaleRequest, type WholesaleRequestInput,
} from '@/lib/customer/wholesale'

/**
 * The wholesale access application.
 *
 * Nothing here grants anything. Every action goes through
 * customer_save_wholesale_application(), which sets the status itself (draft,
 * submitted, or assistance requested) from the action name — the client never
 * sends a status. An administrator reviews it, and approval routes through
 * admin_set_customer_type() inside PostgreSQL.
 *
 * "Request Admin Assistance" sends whatever has been filled in so far (all of
 * it optional) and asks Apple Expert staff to complete the rest.
 */

const SELECT =
  'focus-ring w-full h-12 rounded-2xl border border-mint-deep dark:border-border bg-card px-4 text-sm text-foreground focus:outline-none focus:border-primary/45 transition-colors disabled:opacity-60'

export function WholesaleRequestForm({
  initial, title = 'Request wholesale access', onSaved,
}: {
  /** Prefill — a saved draft, or a rejected application being resubmitted. */
  initial?: WholesaleRequestInput
  title?: string
  onSaved: (request: WholesaleRequest, action: SaveAction) => void
}) {
  const [input, setInput] = useState<WholesaleRequestInput>(initial ?? EMPTY_REQUEST_INPUT)
  const [busy, setBusy] = useState<SaveAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [askingHelp, setAskingHelp] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const submitting = busy !== null

  function set<K extends keyof WholesaleRequestInput>(key: K, value: WholesaleRequestInput[K]) {
    setDraftSaved(false)
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  async function save(action: SaveAction) {
    setError(null)
    if (action === 'submit' && !input.businessName.trim()) {
      setError('Tell us the name of your business — or ask our team to help below.')
      return
    }

    setBusy(action)
    try {
      const request = await saveApplication(input, action)
      if (action === 'draft') setDraftSaved(true)
      onSaved(request, action)
    } catch (err) {
      setError(describeSaveError(err))
    } finally {
      setBusy(null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save('submit')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[26px] border border-mint/80 dark:border-border bg-surface p-5 shadow-card"
    >
      <h2 className="text-[17px] font-bold tracking-tight text-foreground">{title}</h2>
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
        {busy === 'submit' ? (
          <><LoaderCircle size={17} className="mr-2 animate-spin motion-reduce:animate-none" />Sending…</>
        ) : (
          <><Send size={16} className="mr-2" />Submit application</>
        )}
      </Button>

      <button
        type="button" disabled={submitting} onClick={() => void save('draft')}
        className="focus-ring mx-auto mt-2.5 block rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60 transition-colors"
      >
        {busy === 'draft' ? 'Saving…' : draftSaved ? 'Draft saved' : 'Save as draft'}
      </button>

      {/* Secondary path: Apple Expert staff complete the application. */}
      <div className="mt-4 rounded-2xl border border-mint-deep/70 dark:border-border bg-card px-4 py-3.5">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <LifeBuoy size={15} className="shrink-0 text-primary" />
          Need help completing this form?
        </p>

        {askingHelp ? (
          <>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              Our Apple Expert team can complete the application with you. We&apos;ll send what
              you&apos;ve filled in so far — nothing else is required — and contact you on the phone
              number on your account. Your account stays on retail prices until an administrator
              approves the application.
            </p>
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={() => setAskingHelp(false)}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={submitting} onClick={() => void save('assistance')}>
                {busy === 'assistance'
                  ? <><LoaderCircle size={14} className="mr-1.5 animate-spin motion-reduce:animate-none" />Sending…</>
                  : 'Send request to admin team'}
              </Button>
            </div>
          </>
        ) : (
          <Button
            type="button" variant="secondary" size="sm" className="mt-2.5"
            disabled={submitting} onClick={() => { setError(null); setAskingHelp(true) }}
          >
            Request Admin Assistance
          </Button>
        )}
      </div>
    </form>
  )
}
