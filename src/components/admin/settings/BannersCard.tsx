"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BannerVisual } from '@/components/ui/PromoBanners'
import { TextField, SelectField, CheckboxField, FieldLabel } from '@/components/admin/products/fields'
import {
  BANNER_SLOTS, createBanner, deleteBanner, listBanners, removeBannerImage, reorderBanners,
  updateBanner, uploadBannerImage, validateBannerImage, type BannerDraft, type BannerRow,
} from '@/lib/admin/storefront'
import { bannerImageUrl } from '@/lib/store/settings'
import { describeAdminError, logAdminError } from '@/lib/admin/errors'
import { AdminDrawer, SaveFeedback, SettingsCard, type SaveState } from './AdminDrawer'

/**
 * Promotional banners, stored in public.banners with their images in the
 * Supabase Storage `banners` bucket. The storefront shows active banners inside
 * their start/end window, per slot, in this order.
 */
export function BannersCard({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<BannerRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  const [editing, setEditing] = useState<BannerRow | 'new' | null>(null)
  const busy = state.kind === 'saving'

  const load = useCallback(async () => {
    try {
      setRows(await listBanners())
      setLoadError(null)
    } catch (err) {
      logAdminError('settings.banners.load', err)
      setLoadError(describeAdminError(err, 'Could not load banners.'))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    listBanners()
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((err) => {
        logAdminError('settings.banners.load', err)
        if (!cancelled) setLoadError(describeAdminError(err, 'Could not load banners.'))
      })
    return () => { cancelled = true }
  }, [])

  async function run(action: () => Promise<void>, success: string, failure: string) {
    setState({ kind: 'saving' })
    try {
      await action()
      await load()
      setState({ kind: 'saved', message: success })
    } catch (err) {
      logAdminError('settings.banners', err)
      setState({ kind: 'error', message: describeAdminError(err, failure) })
      await load()
    }
  }

  function move(slotRows: BannerRow[], index: number, delta: -1 | 1) {
    const next = [...slotRows]
    const [row] = next.splice(index, 1)
    next.splice(index + delta, 0, row)
    void run(() => reorderBanners(next.map((r) => r.id)), 'Order saved.', 'Could not save the new order.')
  }

  return (
    <SettingsCard
      title="Promotional Banners"
      description="Image banners on the Retail and Wholesale homes. Images are stored in Supabase, not in the app."
      action={canEdit && (
        <Button size="sm" onClick={() => setEditing('new')} disabled={busy || rows === null}>
          <Plus size={15} className="mr-1" /> New banner
        </Button>
      )}
    >
      <div className="mb-3"><SaveFeedback state={state} /></div>
      {loadError && <p role="alert" className="text-[13px] text-red-500 break-words">{loadError}</p>}
      {!loadError && rows === null && (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" /> Loading…
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-mint-deep dark:border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
          No banners yet.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-5">
          {BANNER_SLOTS.map(({ value: slot, label }) => {
            const slotRows = rows.filter((r) => r.slot === slot)
            if (slotRows.length === 0) return null
            return (
              <div key={slot}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</h3>
                <ol className="space-y-2.5">
                  {slotRows.map((row, index) => (
                    <li key={row.id} className="flex flex-col gap-3 rounded-2xl border border-mint/70 dark:border-border bg-card p-3 sm:flex-row sm:items-center">
                      <div className="h-16 w-full shrink-0 overflow-hidden rounded-xl bg-gradient-cta sm:w-28">
                        {row.image_path && <img src={bannerImageUrl(row.image_path) ?? ''} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[13.5px] font-semibold ${row.is_active ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {row.title || 'Untitled banner'}
                        </p>
                        <p className="truncate text-[11.5px] text-muted-foreground">{scheduleLabel(row)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Icon label="Move up" disabled={!canEdit || busy || index === 0} onClick={() => move(slotRows, index, -1)}><ArrowUp size={15} /></Icon>
                        <Icon label="Move down" disabled={!canEdit || busy || index === slotRows.length - 1} onClick={() => move(slotRows, index, 1)}><ArrowDown size={15} /></Icon>
                        <button
                          type="button" role="switch" aria-checked={row.is_active} aria-label={row.is_active ? 'Disable banner' : 'Enable banner'}
                          disabled={!canEdit || busy}
                          onClick={() => void run(() => updateBanner(row.id, { is_active: !row.is_active }).then(() => undefined), row.is_active ? 'Banner disabled.' : 'Banner enabled.', 'Could not change the banner.')}
                          className={`focus-ring relative mx-1 flex h-6 w-10 items-center rounded-full px-0.5 transition-colors disabled:opacity-60 ${row.is_active ? 'bg-gradient-cta' : 'bg-mint-deep dark:bg-border'}`}
                        >
                          <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${row.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <Icon label="Edit" disabled={busy} onClick={() => setEditing(row)}><Pencil size={15} /></Icon>
                        <Icon label="Delete" tone="danger" disabled={!canEdit || busy}
                          onClick={() => { if (window.confirm(`Delete “${row.title || 'Untitled banner'}”? Its image is deleted too.`)) void run(() => deleteBanner(row), 'Banner deleted.', 'Could not delete the banner.') }}>
                          <Trash2 size={15} />
                        </Icon>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>
      )}

      {editing && rows && (
        <BannerEditor
          banner={editing === 'new' ? null : editing}
          canEdit={canEdit}
          nextSortOrder={(slot) => rows.filter((r) => r.slot === slot).reduce((m, r) => Math.max(m, r.sort_order), 0) + 1}
          onClose={() => setEditing(null)}
          onSaved={async (message) => { setEditing(null); await load(); setState({ kind: 'saved', message }) }}
        />
      )}
    </SettingsCard>
  )
}

function scheduleLabel(row: BannerRow): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const status = row.is_active ? 'Active' : 'Disabled'
  if (row.starts_at && row.ends_at) return `${status} · ${fmt(row.starts_at)} – ${fmt(row.ends_at)}`
  if (row.starts_at) return `${status} · from ${fmt(row.starts_at)}`
  if (row.ends_at) return `${status} · until ${fmt(row.ends_at)}`
  return `${status} · always on`
}

function Icon({
  label, onClick, disabled, tone, children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'danger'
  children: React.ReactNode
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`focus-ring flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-35 ${tone === 'danger' ? 'text-red-500 hover:bg-red-500/10' : 'text-muted-foreground hover:bg-primary-soft hover:text-primary'}`}>
      {children}
    </button>
  )
}

/** <input type="datetime-local"> value ⇄ ISO timestamp, in the device's timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

const SAFE_LINK = /^(\/|https:\/\/)/i

function BannerEditor({
  banner, canEdit, nextSortOrder, onClose, onSaved,
}: {
  banner: BannerRow | null
  canEdit: boolean
  nextSortOrder: (slot: string) => number
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const [slot, setSlot] = useState(banner?.slot ?? 'home')
  const [title, setTitle] = useState(banner?.title ?? '')
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? '')
  const [ctaLabel, setCtaLabel] = useState(banner?.cta_label ?? '')
  const [ctaHref, setCtaHref] = useState(banner?.cta_href ?? '')
  const [startsAt, setStartsAt] = useState(toLocalInput(banner?.starts_at ?? null))
  const [endsAt, setEndsAt] = useState(toLocalInput(banner?.ends_at ?? null))
  const [isActive, setIsActive] = useState(banner?.is_active ?? true)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(bannerImageUrl(banner?.image_path ?? null))
  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const saving = state.kind === 'saving'
  const disabled = !canEdit || saving

  // Revoke the local preview URL when it is replaced or the drawer closes.
  useEffect(() => {
    if (!preview?.startsWith('blob:')) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  function pickFile(next: File | undefined) {
    if (!next) return
    const problem = validateBannerImage(next)
    if (problem) { setState({ kind: 'error', message: problem }); return }
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setState({ kind: 'idle' })
  }

  async function save() {
    const href = ctaHref.trim()
    if (!file && !banner?.image_path && !title.trim()) {
      setState({ kind: 'error', message: 'Add an image or a title.' }); return
    }
    if (href && !SAFE_LINK.test(href)) {
      setState({ kind: 'error', message: 'Links must start with “/” (a page in the app) or “https://”.' }); return
    }
    if (ctaLabel.trim() && !href) {
      setState({ kind: 'error', message: 'Add a link for the button, or remove the button text.' }); return
    }
    if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
      setState({ kind: 'error', message: 'The end date must be after the start date.' }); return
    }

    setState({ kind: 'saving' })
    let uploaded: string | null = null
    try {
      if (file) uploaded = await uploadBannerImage(file)
      const draft: BannerDraft = {
        slot,
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        cta_label: ctaLabel.trim() || null,
        cta_href: href || null,
        image_path: uploaded ?? banner?.image_path ?? null,
        starts_at: fromLocalInput(startsAt),
        ends_at: fromLocalInput(endsAt),
        is_active: isActive,
      }
      if (banner) {
        // The slot is fixed once created (the select is disabled), so the
        // banner keeps its place in its own slot's order.
        await updateBanner(banner.id, { ...draft, slot: banner.slot })
        // The new image is saved; the replaced one is now orphaned.
        if (uploaded && banner.image_path) await removeBannerImage(banner.image_path)
      } else {
        await createBanner(draft, nextSortOrder(slot))
      }
      await onSaved(banner ? 'Banner saved.' : 'Banner created.')
    } catch (err) {
      // Nothing references a file whose row failed to save — remove it.
      if (uploaded) await removeBannerImage(uploaded)
      logAdminError('settings.banners.save', err)
      setState({ kind: 'error', message: describeAdminError(err, 'Could not save the banner.') })
    }
  }

  return (
    <AdminDrawer
      title={banner ? 'Edit banner' : 'New banner'}
      subtitle={canEdit ? undefined : 'Read-only — only an owner or admin can change banners.'}
      onClose={onClose}
      footer={
        <>
          <SaveFeedback state={state} />
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          {canEdit && (
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <LoaderCircle size={15} className="mr-1.5 animate-spin motion-reduce:animate-none" />}
              {saving ? (file ? 'Uploading…' : 'Saving…') : 'Save'}
            </Button>
          )}
        </>
      }
    >
      <div>
        <FieldLabel hint="Live preview">Preview</FieldLabel>
        <BannerVisual title={title.trim() || null} subtitle={subtitle.trim() || null} ctaLabel={ctaHref.trim() ? (ctaLabel.trim() || null) : null} imageUrl={preview} />
      </div>

      <div>
        <FieldLabel hint="JPG, PNG or WebP · up to 5 MB · wide images work best">Image</FieldLabel>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <ImagePlus size={15} className="mr-1.5" />
          {preview ? 'Replace image' : 'Upload image'}
        </Button>
        {file && <p className="mt-1.5 text-[11.5px] text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB — uploaded when you save.</p>}
      </div>

      <SelectField id="banner-slot" label="Shown on" value={slot} onChange={setSlot} options={BANNER_SLOTS} disabled={disabled || Boolean(banner)}
        hint={banner ? 'Fixed after creation' : undefined} />
      <TextField id="banner-title" label="Title" value={title} onChange={setTitle} disabled={disabled} />
      <TextField id="banner-subtitle" label="Subtitle" value={subtitle} onChange={setSubtitle} disabled={disabled} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="banner-cta" label="Button text" value={ctaLabel} onChange={setCtaLabel} disabled={disabled} placeholder="Shop now" />
        <TextField id="banner-href" label="Link" value={ctaHref} onChange={setCtaHref} disabled={disabled} placeholder="/categories/iphone" hint="/page or https://" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField id="banner-start" label="Start" value={startsAt} onChange={setStartsAt} disabled={disabled} />
        <DateField id="banner-end" label="End" value={endsAt} onChange={setEndsAt} disabled={disabled} />
      </div>
      <CheckboxField id="banner-active" label="Enabled" checked={isActive} onChange={setIsActive} disabled={disabled}
        hint="Disabled banners, and banners outside their dates, are never sent to customers." />
    </AdminDrawer>
  )
}

function DateField({
  id, label, value, onChange, disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <label htmlFor={id} className="block">
      <FieldLabel hint="Optional">{label}</FieldLabel>
      <input id={id} type="datetime-local" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none disabled:opacity-60" />
    </label>
  )
}
