"use client"

import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { saveStoreSettings, type StoreSettingsPatch } from '@/lib/admin/storefront'
import { describeAdminError, logAdminError } from '@/lib/admin/errors'
import type { StoreSettings } from '@/lib/store/settings'
import { SaveFeedback, SettingsCard, type SaveState } from './AdminDrawer'

type ControlKey =
  | 'show_featured_products' | 'show_banners' | 'show_new_arrivals'
  | 'show_stock_status' | 'retail_enabled' | 'wholesale_enabled'

/** Only switches the storefront actually honours. */
const CONTROLS: readonly { key: ControlKey; label: string; hint: string }[] = [
  { key: 'show_featured_products', label: 'Featured Products', hint: 'The curated carousel on the Retail home.' },
  { key: 'show_banners', label: 'Promotional Banners', hint: 'Banners on the Retail and Wholesale homes.' },
  { key: 'show_new_arrivals', label: 'New Arrivals', hint: 'Products marked “New” in the product editor, on the Retail home.' },
  { key: 'show_stock_status', label: 'Show stock status', hint: 'In stock / low stock / out of stock labels.' },
  { key: 'retail_enabled', label: 'Retail Store', hint: 'When off, retail customers see a “store unavailable” screen.' },
  { key: 'wholesale_enabled', label: 'Wholesale Store', hint: 'When off, Wholesale VIP customers see a “store unavailable” screen.' },
]

export function StorefrontControlsCard({
  settings, canEdit, onSaved,
}: {
  settings: StoreSettings
  canEdit: boolean
  onSaved: (next: StoreSettings) => void
}) {
  const [pending, setPending] = useState<ControlKey | null>(null)
  const [state, setState] = useState<SaveState>({ kind: 'idle' })

  async function toggle(key: ControlKey, label: string) {
    const value = !settings[key]
    setPending(key)
    setState({ kind: 'saving' })
    try {
      const patch: StoreSettingsPatch = { [key]: value }
      onSaved(await saveStoreSettings(patch))
      setState({ kind: 'saved', message: `${label} ${value ? 'turned on' : 'turned off'}.` })
    } catch (err) {
      logAdminError('settings.controls', err)
      setState({ kind: 'error', message: describeAdminError(err, `Could not change ${label}.`) })
    } finally {
      setPending(null)
    }
  }

  return (
    <SettingsCard
      title="Storefront Controls"
      description="Changes reach customers the next time their app opens or returns to the foreground — no rebuild needed."
      action={<SaveFeedback state={state} />}
    >
      <ul className="divide-y divide-mint/70 dark:divide-border rounded-2xl border border-mint/70 dark:border-border bg-card">
        {CONTROLS.map(({ key, label, hint }) => {
          const on = settings[key]
          const busy = pending === key
          return (
            <li key={key} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-foreground">{label}</p>
                <p className="text-[11.5px] leading-snug text-muted-foreground">{hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={label}
                disabled={!canEdit || pending !== null}
                onClick={() => void toggle(key, label)}
                className={`focus-ring relative flex h-7 w-12 shrink-0 items-center rounded-full px-1 transition-colors disabled:opacity-60 ${on ? 'bg-gradient-cta' : 'bg-mint-deep dark:bg-border'}`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`}>
                  {busy && <LoaderCircle size={11} className="animate-spin text-primary motion-reduce:animate-none" />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </SettingsCard>
  )
}
