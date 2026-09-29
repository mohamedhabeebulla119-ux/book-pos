"use client"

import { useState, type FormEvent } from 'react'
import { LoaderCircle, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField, TextAreaField, LockedField, CheckboxField } from '@/components/admin/products/fields'
import { saveStoreSettings } from '@/lib/admin/storefront'
import { describeAdminError, logAdminError } from '@/lib/admin/errors'
import type { StoreSettings } from '@/lib/store/settings'
import { SaveFeedback, SettingsCard, type SaveState } from './AdminDrawer'

/** The editable text fields of store_settings, as form strings. */
interface Draft {
  store_name: string
  description: string
  contact_phone: string
  whatsapp_number: string
  email: string
  address: string
  opening_hours: string
  is_open: boolean
  maintenance_mode: boolean
}

function toDraft(s: StoreSettings): Draft {
  return {
    store_name: s.store_name,
    description: s.description ?? '',
    contact_phone: s.contact_phone ?? '',
    whatsapp_number: s.whatsapp_number ?? '',
    email: s.email ?? '',
    address: s.address ?? '',
    opening_hours: s.opening_hours ?? '',
    is_open: s.is_open,
    maintenance_mode: s.maintenance_mode,
  }
}

const blank = (v: string) => (v.trim() === '' ? null : v.trim())
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function StoreConfigCard({
  settings, canEdit, onSaved,
}: {
  settings: StoreSettings
  canEdit: boolean
  onSaved: (next: StoreSettings) => void
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings))
  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  const saving = state.kind === 'saving'
  const disabled = !canEdit || saving
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(settings))

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    if (state.kind !== 'saving') setState({ kind: 'idle' })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draft.store_name.trim() === '') {
      setState({ kind: 'error', message: 'Enter the store name.' })
      return
    }
    if (draft.email.trim() !== '' && !EMAIL_SHAPE.test(draft.email.trim())) {
      setState({ kind: 'error', message: 'That email address does not look right.' })
      return
    }
    setState({ kind: 'saving' })
    try {
      const next = await saveStoreSettings({
        store_name: draft.store_name.trim(),
        description: blank(draft.description),
        contact_phone: blank(draft.contact_phone),
        whatsapp_number: blank(draft.whatsapp_number),
        email: blank(draft.email),
        address: blank(draft.address),
        opening_hours: blank(draft.opening_hours),
        is_open: draft.is_open,
        maintenance_mode: draft.maintenance_mode,
      })
      onSaved(next)
      setDraft(toDraft(next))
      setState({ kind: 'saved', message: 'Store configuration saved.' })
    } catch (err) {
      logAdminError('settings.store', err)
      setState({ kind: 'error', message: describeAdminError(err, 'Could not save the store configuration.') })
    }
  }

  return (
    <SettingsCard
      title="Store Configuration"
      description="Store details shown to customers, opening status and maintenance mode."
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="store-name" label="Store name" value={draft.store_name} onChange={(v) => set('store_name', v)} disabled={disabled} />
          <LockedField label="Currency" value="LKR (Rs.)" hint="Fixed" />
          <TextField id="store-phone" label="Contact phone" value={draft.contact_phone} onChange={(v) => set('contact_phone', v)} disabled={disabled} placeholder="+94 11 234 5678" />
          <TextField id="store-whatsapp" label="WhatsApp number" value={draft.whatsapp_number} onChange={(v) => set('whatsapp_number', v)} disabled={disabled} placeholder="+94 77 123 4567" />
          <TextField id="store-email" label="Email" value={draft.email} onChange={(v) => set('email', v)} disabled={disabled} placeholder="hello@example.com" />
          <TextField id="store-address" label="Physical address" value={draft.address} onChange={(v) => set('address', v)} disabled={disabled} />
        </div>
        <TextAreaField id="store-description" label="Store description" value={draft.description} onChange={(v) => set('description', v)} disabled={disabled} rows={3} />
        <TextAreaField id="store-hours" label="Opening hours" value={draft.opening_hours} onChange={(v) => set('opening_hours', v)} disabled={disabled} rows={3} />

        <div className="grid gap-3 rounded-2xl border border-mint/70 dark:border-border bg-card p-4 sm:grid-cols-2">
          <CheckboxField id="store-open" label="Store is open" checked={draft.is_open} onChange={(v) => set('is_open', v)} disabled={disabled}
            hint="When off, both storefront homes show a “currently closed” notice with the opening hours." />
          <CheckboxField id="store-maintenance" label="Maintenance mode" checked={draft.maintenance_mode} onChange={(v) => set('maintenance_mode', v)} disabled={disabled}
            hint="Replaces the whole customer app with a maintenance screen. The admin panel is unaffected." />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={disabled || !dirty}>
            {saving ? <LoaderCircle size={15} className="mr-1.5 animate-spin motion-reduce:animate-none" /> : <Save size={15} className="mr-1.5" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" disabled={disabled || !dirty} onClick={() => { setDraft(toDraft(settings)); setState({ kind: 'idle' }) }}>
            <RotateCcw size={15} className="mr-1.5" /> Reset
          </Button>
          <SaveFeedback state={state} />
        </div>
      </form>
    </SettingsCard>
  )
}
