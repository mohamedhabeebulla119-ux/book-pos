"use client"

import { useEffect, useRef, useState } from 'react'
import {
  X, LoaderCircle, Check, AlertCircle, Plus, Trash2, Lock, ImageIcon, Info, Star, Ban, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  loadProductDetail, updateProduct, updateVariant, saveSpecs, updateImage,
  addVariant, deleteVariant, addImage, deleteImage, setPrimaryImage,
  addCompatibility, deleteCompatibility, deleteProduct, countOrderLines,
  SUBCATEGORY_OPTIONS, LIFECYCLE_OPTIONS,
  type AdminProductDetail, type CategoryRow, type ProductPatch,
  type VariantPatch, type SpecDraft, type ProductRow,
} from '@/lib/admin/products'
import {
  listWarrantyOptions, addWarrantyOption, updateWarrantyOption, deleteWarrantyOption,
  setDefaultWarrantyOption, reorderWarrantyOptions, listConditionGrades,
  uploadProductImage, PRODUCT_IMAGE_BUCKET,
  type WarrantyOptionRow, type ConditionGradeRow,
} from '@/lib/admin/warranty'
import { productImageUrl } from '@/lib/catalog'
import { describeAdminError } from '@/lib/admin/errors'
import {
  ConditionEditor, WarrantyEditor, toDraft, draftToPatch, type WarrantyOptionDraft,
} from './ConditionWarrantyEditor'
import {
  TextField, NumberField, TextAreaField, SelectField, LockedField,
  CheckboxField, EditorSection,
} from './fields'

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string }

interface Props {
  productId: string
  categories: CategoryRow[]
  canEdit: boolean
  onClose: () => void
  onSaved: () => void
  /** Called after the product row itself has been removed. */
  onDeleted?: (name: string) => void
}

/**
 * A destructive action awaiting confirmation.
 *
 * Every delete in this editor goes through one of these rather than firing on
 * click: a variant carries its price history, an image is a customer-facing
 * asset, and a product is the anchor for links and saved carts.
 */
type Confirm =
  | { kind: 'variant'; id: string; label: string }
  | { kind: 'image'; id: string; label: string }
  | { kind: 'compatibility'; id: string; label: string }
  | { kind: 'warranty'; id: string; label: string }
  | { kind: 'product'; orderLines: number }

/** The editable fields of a product row, as the form holds them. */
function formFrom(p: ProductRow): ProductPatch {
  return {
    name: p.name,
    category_id: p.category_id,
    subcategory: p.subcategory,
    model: p.model,
    description: p.description,
    warranty_text: p.warranty_text,
    warranty_status: p.warranty_status,
    warranty_duration: p.warranty_duration,
    warranty_months: p.warranty_months,
    warranty_coverage: p.warranty_coverage,
    lifecycle_status: p.lifecycle_status,
    is_new: p.is_new,
    condition: p.condition,
    condition_grade_id: p.condition_grade_id,
    battery_health: p.battery_health,
    cycle_count: p.cycle_count,
    physical_condition: p.physical_condition,
    accessories_included: p.accessories_included,
    device_notes: p.device_notes,
    warranty_type: p.warranty_type,
    warranty_title: p.warranty_title,
    warranty_description: p.warranty_description,
    warranty_covered: p.warranty_covered,
    warranty_excluded: p.warranty_excluded,
  }
}

export function ProductEditor({ productId, categories, canEdit, onClose, onSaved, onDeleted }: Props) {
  const [detail, setDetail] = useState<AdminProductDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>({ kind: 'idle' })

  const [form, setForm] = useState<ProductPatch | null>(null)
  const [variants, setVariants] = useState<(VariantPatch & { id: string; legacyKey: string | null })[]>([])
  const [specs, setSpecs] = useState<SpecDraft[]>([])
  const [images, setImages] = useState<{ id: string; path: string; alt: string; position: number }[]>([])
  const [grades, setGrades] = useState<ConditionGradeRow[]>([])
  const [gradesError, setGradesError] = useState<string | null>(null)
  const [optionRows, setOptionRows] = useState<WarrantyOptionRow[]>([])
  const [optionDrafts, setOptionDrafts] = useState<WarrantyOptionDraft[]>([])
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Rows added or removed here are written immediately rather than batched with
  // "Save changes": an insert needs a database id before its fields can be
  // edited, and a delete deserves its own confirmation rather than riding along
  // with unrelated edits.
  const [newVariantName, setNewVariantName] = useState('')
  const [newImagePath, setNewImagePath] = useState('')
  const [newCompatibility, setNewCompatibility] = useState('')
  const [rowBusy, setRowBusy] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  // The parent mounts this component with key={productId}, so a different
  // product gets a fresh instance and the initial state above is already the
  // reset — no synchronous state writes are needed in this effect.
  useEffect(() => {
    let cancelled = false

    // Grades and warranty options load beside the product; a failure there is
    // reported in its own section rather than blocking the whole editor.
    listConditionGrades()
      .then((rows) => { if (!cancelled) setGrades(rows) })
      .catch((err) => { if (!cancelled) setGradesError(describeAdminError(err, 'Could not load condition grades.')) })
    listWarrantyOptions(productId)
      .then((rows) => { if (!cancelled) { setOptionRows(rows); setOptionDrafts(rows.map(toDraft)) } })
      .catch((err) => { if (!cancelled) setOptionsError(describeAdminError(err, 'Could not load warranty options.')) })

    loadProductDetail(productId)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setForm(formFrom(d.product))
        setVariants(d.variants.map((v) => ({
          id: v.id, legacyKey: v.legacy_key, name: v.name, color: v.color,
          color_code: v.color_code, storage: v.storage, stock: v.stock, sort_order: v.sort_order,
        })))
        setSpecs(d.specs.map((s) => ({ id: s.id, label: s.label, value: s.value })))
        setImages(d.images.map((i) => ({ id: i.id, path: i.path, alt: i.alt ?? '', position: i.position })))
      })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load this product.') })

    return () => { cancelled = true }
  }, [productId])

  function patchForm<K extends keyof ProductPatch>(key: K, value: ProductPatch[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSave({ kind: 'idle' })
  }

  /** Re-reads the product so newly inserted rows arrive with their ids. */
  async function reload() {
    const fresh = await loadProductDetail(productId)
    setDetail(fresh)
    setVariants(fresh.variants.map((v) => ({
      id: v.id, legacyKey: v.legacy_key, name: v.name, color: v.color,
      color_code: v.color_code, storage: v.storage, stock: v.stock, sort_order: v.sort_order,
    })))
    setSpecs(fresh.specs.map((sp) => ({ id: sp.id, label: sp.label, value: sp.value })))
    setImages(fresh.images.map((i) => ({ id: i.id, path: i.path, alt: i.alt ?? '', position: i.position })))
    await reloadOptions()
  }

  /** Re-reads warranty options, keeping unsaved edits to options that still exist. */
  async function reloadOptions() {
    const rows = await listWarrantyOptions(productId)
    setOptionRows(rows)
    setOptionDrafts((prev) => rows.map((row) => prev.find((d) => d.id === row.id) ?? toDraft(row)))
    setOptionsError(null)
  }

  async function reloadGrades() {
    setGrades(await listConditionGrades())
    setGradesError(null)
  }

  /** Swaps an option with its neighbour and rewrites the order. */
  function moveOption(id: string, direction: -1 | 1) {
    const ids = optionDrafts.map((d) => d.id)
    const from = ids.indexOf(id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    void runRowAction(() => reorderWarrantyOptions(ids))
  }

  /** Uploads a photo to the product-images bucket and attaches it to this product. */
  async function uploadImages(files: FileList | null) {
    if (!files || files.length === 0 || !detail) return
    const list = Array.from(files)
    await runRowAction(async () => {
      let existing = detail.images
      for (const file of list) {
        const path = await uploadProductImage(productId, file)
        const row = await addImage(productId, { path, alt: null, storage_bucket: PRODUCT_IMAGE_BUCKET }, existing)
        existing = [...existing, row]
      }
    })
    if (fileInput.current) fileInput.current.value = ''
  }

  /** Runs one immediate row write, keeping its error separate from the form's. */
  async function runRowAction(action: () => Promise<void>) {
    setRowBusy(true)
    setRowError(null)
    try {
      await action()
      await reload()
      onSaved()
    } catch (err) {
      setRowError(describeAdminError(err, 'The database refused that change.'))
    } finally {
      setRowBusy(false)
    }
  }

  async function handleDeleteProduct() {
    if (!detail) return
    setRowBusy(true)
    setRowError(null)
    try {
      const outcome = await deleteProduct(detail.product.id)
      if (!outcome.ok) {
        setRowError(outcome.reason)
        setConfirm(null)
        return
      }
      onDeleted?.(detail.product.name)
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'The database refused the deletion.')
    } finally {
      setRowBusy(false)
    }
  }

  async function handleSave() {
    if (!form || !detail) return
    // Validate warranty option edits before writing anything.
    const optionPatches: { id: string; patch: Parameters<typeof updateWarrantyOption>[1] }[] = []
    for (const draft of optionDrafts) {
      const before = optionRows.find((r) => r.id === draft.id)
      if (!before) continue
      const parsed = draftToPatch(draft)
      if (!parsed.ok) { setSave({ kind: 'error', message: parsed.reason }); return }
      const p = parsed.patch
      if (p.duration_months !== before.duration_months || p.additional_price_cents !== before.additional_price_cents
          || p.is_enabled !== before.is_enabled) {
        optionPatches.push({ id: draft.id, patch: p })
      }
    }

    setSave({ kind: 'saving' })
    try {
      // warranty_status is the older display flag; it follows warranty_type so
      // the two can never contradict each other.
      await updateProduct(detail.product.id, {
        ...form,
        warranty_status: form.warranty_type === 'none' ? 'none' : 'active',
      })

      for (const { id, patch } of optionPatches) await updateWarrantyOption(id, patch)

      for (const variant of variants) {
        const before = detail.variants.find((v) => v.id === variant.id)
        if (!before) continue
        const changed =
          before.name !== variant.name || before.color !== variant.color ||
          before.color_code !== variant.color_code || before.storage !== variant.storage ||
          before.stock !== variant.stock || before.sort_order !== variant.sort_order
        if (!changed) continue
        // legacy_key is never sent — cart and wishlist identity depends on it.
        await updateVariant(variant.id, {
          name: variant.name, color: variant.color, color_code: variant.color_code,
          storage: variant.storage, stock: variant.stock, sort_order: variant.sort_order,
        })
      }

      await saveSpecs(detail.product.id, specs, detail.specs)

      for (const image of images) {
        const before = detail.images.find((i) => i.id === image.id)
        if (!before) continue
        if (before.path === image.path && (before.alt ?? '') === image.alt && before.position === image.position) continue
        await updateImage(image.id, { path: image.path, alt: image.alt || null, position: image.position })
      }

      const fresh = await loadProductDetail(detail.product.id)
      setDetail(fresh)
      setForm(formFrom(fresh.product))
      setSpecs(fresh.specs.map((s) => ({ id: s.id, label: s.label, value: s.value })))
      if (optionPatches.length > 0) {
        const rows = await listWarrantyOptions(productId)
        setOptionRows(rows)
        setOptionDrafts(rows.map(toDraft))
      }
      setSave({ kind: 'saved' })
      onSaved()
    } catch (err) {
      setSave({ kind: 'error', message: describeAdminError(err, 'Save failed.') })
    }
  }

  const disabled = !canEdit || save.kind === 'saving'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close editor" onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />

      <div role="dialog" aria-modal="true" aria-label="Edit product"
        className="relative flex h-full w-full max-w-2xl flex-col bg-background border-l border-mint/80 dark:border-border shadow-float">

        <header className="flex items-center gap-3 border-b border-mint/80 dark:border-border px-5 py-4 bg-glass backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-bold tracking-tight text-foreground">
              {detail?.product.name ?? 'Loading…'}
            </h2>
            {detail && <p className="truncate font-mono text-[11px] text-muted-foreground">{detail.product.id}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor"
            className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-primary-soft active:scale-95 transition">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {!detail && !loadError && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground py-10 justify-center">
              <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
              Loading product…
            </div>
          )}

          {loadError && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-[13px] text-foreground">{loadError}</p>
            </div>
          )}

          {!canEdit && detail && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <Lock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-[13px] leading-snug text-foreground">
                Read-only. Your role can view the catalog but the database refuses catalog writes.
              </p>
            </div>
          )}

          {detail && form && (
            <>
              <EditorSection title="Details">
                <div className="grid gap-4">
                  <LockedField label="Product ID" value={detail.product.id}
                    hint="read-only — static routes, cart and wishlist entries depend on it" />
                  <TextField id="p-name" label="Name" value={form.name} disabled={disabled}
                    onChange={(v) => patchForm('name', v)} />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <SelectField id="p-cat" label="Category" value={form.category_id} disabled={disabled}
                      onChange={(v) => patchForm('category_id', v)}
                      options={categories.map((c) => ({ value: c.id, label: c.name }))} />
                    <SelectField id="p-sub" label="Subcategory" value={form.subcategory} disabled={disabled}
                      onChange={(v) => patchForm('subcategory', v)}
                      options={SUBCATEGORY_OPTIONS.map((s) => ({ value: s, label: s }))} />
                  </div>
                  <TextField id="p-model" label="Model" value={form.model ?? ''} disabled={disabled}
                    onChange={(v) => patchForm('model', v || null)} />
                  <TextAreaField id="p-desc" label="Description" value={form.description} disabled={disabled}
                    onChange={(v) => patchForm('description', v)} />
                </div>
              </EditorSection>

              <EditorSection title="Status">
                <div className="grid sm:grid-cols-2 gap-4 items-start">
                  <SelectField id="p-life" label="Lifecycle" value={form.lifecycle_status ?? ''} disabled={disabled}
                    allowEmpty onChange={(v) => patchForm('lifecycle_status', v || null)}
                    options={LIFECYCLE_OPTIONS.map((s) => ({ value: s, label: s }))} />
                  <div className="pt-6">
                    <CheckboxField id="p-isnew" label="Show “New” badge" checked={form.is_new} disabled={disabled}
                      onChange={(v) => patchForm('is_new', v)} />
                  </div>
                </div>
              </EditorSection>

              <ConditionEditor form={form} patchForm={patchForm} grades={grades} gradesError={gradesError}
                disabled={disabled} canEdit={canEdit}
                onGradesChanged={reloadGrades} />

              <WarrantyEditor form={form} patchForm={patchForm} subcategory={form.subcategory}
                rows={optionRows} drafts={optionDrafts} setDrafts={setOptionDrafts} optionsError={optionsError}
                disabled={disabled} rowBusy={rowBusy}
                onAdd={async (months, addOnCents) => {
                  let ok = false
                  await runRowAction(async () => {
                    await addWarrantyOption(productId, { months, addOnCents }, optionRows)
                    ok = true
                  })
                  return ok
                }}
                onSetDefault={(id) => void runRowAction(() => setDefaultWarrantyOption(productId, id))}
                onMove={moveOption}
                onAskDelete={(id, label) => setConfirm({ kind: 'warranty', id, label })} />

              <EditorSection title="Variants"
                  description="Variant keys are fixed once created: they map database rows back to saved carts and wishlists. Prices for each variant live on the Pricing screen.">
                  <div className="space-y-4">
                    {variants.map((variant, index) => (
                      <div key={variant.id} className="rounded-2xl border border-mint/70 dark:border-border bg-card p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="rounded-full border border-mint-deep bg-primary-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                            {variant.legacyKey ?? '—'}
                          </span>
                          <Lock size={12} className="text-muted-foreground" />
                          <button type="button" disabled={disabled || rowBusy}
                            aria-label={`Remove variant ${variant.name}`}
                            onClick={() => setConfirm({ kind: 'variant', id: variant.id, label: variant.name })}
                            className="focus-ring ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-red-500/8 hover:text-red-500 active:scale-95 disabled:opacity-40">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="grid gap-3">
                          <TextField id={`v-name-${variant.id}`} label="Label" value={variant.name} disabled={disabled}
                            onChange={(v) => setVariants((p) => p.map((x, i) => i === index ? { ...x, name: v } : x))} />
                          <div className="grid sm:grid-cols-3 gap-3">
                            <TextField id={`v-color-${variant.id}`} label="Colour" value={variant.color ?? ''} disabled={disabled}
                              onChange={(v) => setVariants((p) => p.map((x, i) => i === index ? { ...x, color: v || null } : x))} />
                            <TextField id={`v-hex-${variant.id}`} label="Colour code" value={variant.color_code ?? ''} disabled={disabled}
                              onChange={(v) => setVariants((p) => p.map((x, i) => i === index ? { ...x, color_code: v || null } : x))} />
                            <TextField id={`v-store-${variant.id}`} label="Storage" value={variant.storage ?? ''} disabled={disabled}
                              onChange={(v) => setVariants((p) => p.map((x, i) => i === index ? { ...x, storage: v || null } : x))} />
                          </div>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <NumberField id={`v-stock-${variant.id}`} label="Stock" min={0} value={variant.stock} disabled={disabled}
                              hint="blank inherits the product" onChange={(v) => setVariants((p) => p.map((x, i) => i === index ? { ...x, stock: v } : x))} />
                            <NumberField id={`v-sort-${variant.id}`} label="Order" min={0} value={variant.sort_order} disabled={disabled}
                              onChange={(v) => setVariants((p) => p.map((x, i) => i === index ? { ...x, sort_order: v ?? 0 } : x))} />
                          </div>
                        </div>
                      </div>
                    ))}

                    {variants.length === 0 && (
                      <p className="text-[13px] text-muted-foreground">
                        This product is sold as one thing. Add a variant to offer storage, colour or size
                        options — each one can then be priced separately.
                      </p>
                    )}

                    <div className="flex items-start gap-2">
                      <input aria-label="New variant label" value={newVariantName} disabled={disabled || rowBusy}
                        placeholder="New variant, e.g. 512GB"
                        onChange={(e) => setNewVariantName(e.target.value)}
                        className="focus-ring flex-1 rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2 text-[13px] text-foreground focus:border-primary/45 focus:outline-none disabled:opacity-60" />
                      <Button type="button" variant="outline" size="sm"
                        disabled={disabled || rowBusy || newVariantName.trim() === ''}
                        onClick={() => void runRowAction(async () => {
                          await addVariant(
                            productId,
                            { name: newVariantName, color: null, color_code: null, storage: null, stock: null },
                            detail.variants,
                          )
                          setNewVariantName('')
                        })}>
                        <Plus size={14} className="mr-1.5" /> Add
                      </Button>
                    </div>
                  </div>
                </EditorSection>

              <EditorSection title="Specifications" description="Rendered on the product page in this order.">
                <div className="space-y-2.5">
                  {specs.map((spec, index) => (
                    <div key={spec.id ?? `new-${index}`} className="flex items-start gap-2">
                      <input aria-label="Specification label" value={spec.label} disabled={disabled}
                        placeholder="Label"
                        onChange={(e) => setSpecs((p) => p.map((s, i) => i === index ? { ...s, label: e.target.value } : s))}
                        className="focus-ring w-[38%] rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2 text-[13px] font-semibold text-foreground focus:outline-none focus:border-primary/45 disabled:opacity-60" />
                      <input aria-label="Specification value" value={spec.value} disabled={disabled}
                        placeholder="Value"
                        onChange={(e) => setSpecs((p) => p.map((s, i) => i === index ? { ...s, value: e.target.value } : s))}
                        className="focus-ring flex-1 rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/45 disabled:opacity-60" />
                      <button type="button" disabled={disabled} aria-label={`Remove ${spec.label || 'specification'}`}
                        onClick={() => setSpecs((p) => p.filter((_, i) => i !== index))}
                        className="focus-ring mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/8 active:scale-95 transition disabled:opacity-40">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" disabled={disabled}
                    onClick={() => setSpecs((p) => [...p, { id: null, label: '', value: '' }])}>
                    <Plus size={14} className="mr-1.5" /> Add specification
                  </Button>
                </div>
              </EditorSection>

              <EditorSection title="Images"
                description="Upload photos to Supabase Storage (JPG, PNG or WebP, up to 5 MB) — never bundled into the app. For a pre-owned unit, upload photos of the actual device and label each one (Front, Back, Battery health…). Older images keep their bundled paths.">
                <div className="space-y-3">
                  {images.length === 0 && (
                    <p className="text-[13px] text-muted-foreground">
                      No images yet. The first one added becomes the card image customers see.
                    </p>
                  )}
                  {images.map((image, index) => {
                    const row = detail.images.find((i) => i.id === image.id)
                    const uploaded = Boolean(row?.storage_bucket)
                    return (
                    <div key={image.id} className="flex items-start gap-3 rounded-2xl border border-mint/70 dark:border-border bg-card p-3">
                      <span className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${
                        row?.is_primary
                          ? 'border-mint-deep bg-primary-soft text-primary'
                          : 'border-mint/70 dark:border-border bg-muted text-muted-foreground'
                      }`}>
                        {row
                          ? <img src={productImageUrl(row)} alt="" className="h-full w-full object-cover" />
                          : <ImageIcon size={16} />}
                      </span>
                      <div className="min-w-0 flex-1 grid gap-2">
                        {uploaded ? (
                          <p className="truncate rounded-xl border border-dashed border-mint-deep dark:border-border bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">
                            Uploaded · {image.path}
                          </p>
                        ) : (
                          <input aria-label="Image path" value={image.path} disabled={disabled}
                            onChange={(e) => setImages((p) => p.map((x, i) => i === index ? { ...x, path: e.target.value } : x))}
                            className="focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-background px-3 py-2 font-mono text-[12px] text-foreground focus:outline-none focus:border-primary/45 disabled:opacity-60" />
                        )}
                        <input aria-label="Image label" value={image.alt} disabled={disabled} placeholder="Label, e.g. Front, Back, Battery health"
                          onChange={(e) => setImages((p) => p.map((x, i) => i === index ? { ...x, alt: e.target.value } : x))}
                          className="focus-ring w-full rounded-xl border border-mint-deep dark:border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/45 disabled:opacity-60" />
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button type="button" disabled={disabled || rowBusy}
                          aria-label={detail.images.find((i) => i.id === image.id)?.is_primary ? 'Primary image' : 'Make primary image'}
                          onClick={() => void runRowAction(() => setPrimaryImage(productId, image.id))}
                          className={`focus-ring flex h-9 w-9 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-40 ${
                            detail.images.find((i) => i.id === image.id)?.is_primary
                              ? 'text-primary'
                              : 'text-muted-foreground hover:bg-primary-soft hover:text-primary'
                          }`}>
                          <Star size={15} fill={detail.images.find((i) => i.id === image.id)?.is_primary ? 'currentColor' : 'none'} />
                        </button>
                        <button type="button" disabled={disabled || rowBusy} aria-label="Remove image"
                          onClick={() => setConfirm({ kind: 'image', id: image.id, label: image.path })}
                          className="focus-ring flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-red-500/8 hover:text-red-500 active:scale-95 disabled:opacity-40">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    )
                  })}

                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
                    onChange={(e) => void uploadImages(e.target.files)} />
                  <Button type="button" variant="outline" size="sm" disabled={disabled || rowBusy}
                    onClick={() => fileInput.current?.click()}>
                    {rowBusy
                      ? <LoaderCircle size={14} className="mr-1.5 animate-spin motion-reduce:animate-none" />
                      : <Upload size={14} className="mr-1.5" />}
                    Upload photos
                  </Button>

                  <p className="pt-1 text-[11.5px] text-muted-foreground">Or reference a bundled image path:</p>
                  <div className="flex items-start gap-2">
                    <input aria-label="New image path" value={newImagePath} disabled={disabled || rowBusy}
                      placeholder="/images/products/iphone/iphone-18-pro.jpg"
                      onChange={(e) => setNewImagePath(e.target.value)}
                      className="focus-ring flex-1 rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2 font-mono text-[12px] text-foreground focus:border-primary/45 focus:outline-none disabled:opacity-60" />
                    <Button type="button" variant="outline" size="sm"
                      disabled={disabled || rowBusy || newImagePath.trim() === ''}
                      onClick={() => void runRowAction(async () => {
                        await addImage(productId, { path: newImagePath, alt: null }, detail.images)
                        setNewImagePath('')
                      })}>
                      <Plus size={14} className="mr-1.5" /> Add
                    </Button>
                  </div>
                </div>
              </EditorSection>

              <EditorSection title="Compatibility"
                description="Which devices this product fits. Shown on the product page for parts and accessories.">
                <div className="space-y-2.5">
                  {detail.compatibility.length === 0 && (
                    <p className="text-[13px] text-muted-foreground">No compatibility entries.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {detail.compatibility.map((c) => (
                      <span key={c.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-mint-deep bg-primary-soft py-1 pl-3 pr-1 text-[12px] text-primary">
                        {c.label}
                        <button type="button" disabled={disabled || rowBusy} aria-label={`Remove ${c.label}`}
                          onClick={() => setConfirm({ kind: 'compatibility', id: c.id, label: c.label })}
                          className="focus-ring flex h-5 w-5 items-center justify-center rounded-full text-primary/70 transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-start gap-2">
                    <input aria-label="New compatibility entry" value={newCompatibility} disabled={disabled || rowBusy}
                      placeholder="iPhone 18 Pro"
                      onChange={(e) => setNewCompatibility(e.target.value)}
                      className="focus-ring flex-1 rounded-xl border border-mint-deep dark:border-border bg-card px-3 py-2 text-[13px] text-foreground focus:border-primary/45 focus:outline-none disabled:opacity-60" />
                    <Button type="button" variant="outline" size="sm"
                      disabled={disabled || rowBusy || newCompatibility.trim() === ''}
                      onClick={() => void runRowAction(async () => {
                        await addCompatibility(productId, { label: newCompatibility, device_model_id: null }, detail.compatibility)
                        setNewCompatibility('')
                      })}>
                      <Plus size={14} className="mr-1.5" /> Add
                    </Button>
                  </div>
                </div>
              </EditorSection>

              {canEdit && (
                <EditorSection title="Danger zone"
                  description="A product that has ever been ordered is unpublished, never deleted — that is what keeps past orders readable.">
                  <Button type="button" variant="outline" disabled={rowBusy}
                    className="border-red-500/40 text-red-500 hover:bg-red-500/8"
                    onClick={() => void (async () => {
                      setRowError(null)
                      try {
                        setConfirm({ kind: 'product', orderLines: await countOrderLines(productId) })
                      } catch (err) {
                        setRowError(err instanceof Error ? err.message : 'Could not check order history.')
                      }
                    })()}>
                    <Ban size={15} className="mr-1.5" />
                    Delete this product
                  </Button>
                </EditorSection>
              )}

              {rowError && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                  <p className="text-[13px] text-foreground">{rowError}</p>
                </div>
              )}

              <div className="flex items-start gap-2.5 rounded-2xl border border-mint/70 dark:border-border bg-muted px-4 py-3">
                <Info size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-[12.5px] leading-snug text-muted-foreground">
                  Prices and stock movements are not editable here. Each has its own page and its own audited database function.
                </p>
              </div>
            </>
          )}
        </div>

        {confirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-5">
            <button type="button" aria-label="Cancel" onClick={() => setConfirm(null)}
              className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
            <div role="dialog" aria-modal="true"
              className="relative w-full max-w-sm rounded-[26px] border border-mint/80 dark:border-border bg-surface p-6 shadow-float">
              <h3 className="mb-2 text-lg font-bold tracking-tight text-foreground">
                {confirm.kind === 'variant' ? 'Remove this variant?'
                  : confirm.kind === 'image' ? 'Remove this image?'
                  : confirm.kind === 'compatibility' ? 'Remove this entry?'
                  : confirm.kind === 'warranty' ? 'Delete this warranty option?'
                  : confirm.orderLines > 0 ? 'This product has been ordered' : 'Delete this product?'}
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                {confirm.kind === 'variant'
                  ? `“${confirm.label}” and its price history are removed permanently. Carts that hold it will no longer resolve it.`
                  : confirm.kind === 'image'
                    ? `${confirm.label} stops being shown. An uploaded file is deleted from storage; a bundled file is untouched.`
                  : confirm.kind === 'warranty'
                    ? `The ${confirm.label} stops being offered. Orders already placed with it keep their recorded warranty and price.`
                    : confirm.kind === 'compatibility'
                      ? `“${confirm.label}” is removed from this product's compatibility list.`
                      : confirm.orderLines > 0
                        ? `It appears on ${confirm.orderLines} order line${confirm.orderLines === 1 ? '' : 's'}, so it cannot be deleted. Unpublish it instead — customers stop seeing it and every order stays intact.`
                        : 'The product, its variants, images, specifications and price history are removed permanently. It has never been ordered, so no order history is affected.'}
              </p>
              <div className="flex gap-2.5">
                <Button variant="ghost" fullWidth onClick={() => setConfirm(null)} disabled={rowBusy}>
                  {confirm.kind === 'product' && confirm.orderLines > 0 ? 'Close' : 'Cancel'}
                </Button>
                {!(confirm.kind === 'product' && confirm.orderLines > 0) && (
                  <Button fullWidth disabled={rowBusy}
                    className="bg-red-500 hover:bg-red-500/90 shadow-none"
                    onClick={() => {
                      const target = confirm
                      setConfirm(null)
                      if (target.kind === 'variant') void runRowAction(() => deleteVariant(target.id))
                      else if (target.kind === 'image') void runRowAction(() => deleteImage(target.id))
                      else if (target.kind === 'compatibility') void runRowAction(() => deleteCompatibility(target.id))
                      else if (target.kind === 'warranty') void runRowAction(() => deleteWarrantyOption(target.id))
                      else void handleDeleteProduct()
                    }}>
                    {rowBusy
                      ? <><LoaderCircle size={16} className="mr-2 animate-spin motion-reduce:animate-none" />Removing…</>
                      : 'Remove'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <footer className="border-t border-mint/80 dark:border-border px-5 py-4 bg-glass backdrop-blur-xl">
          {save.kind === 'error' && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 px-3 py-2">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-[12.5px] text-foreground">{save.message}</p>
            </div>
          )}
          {save.kind === 'saved' && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-mint-deep bg-primary-soft px-3 py-2">
              <Check size={15} className="shrink-0 text-primary" />
              <p className="text-[12.5px] font-medium text-primary">Saved to the database.</p>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" onClick={onClose} disabled={save.kind === 'saving'}>Cancel</Button>
            <Button className="flex-1" onClick={() => void handleSave()} disabled={disabled || !detail}>
              {save.kind === 'saving' ? (
                <><LoaderCircle size={16} className="mr-2 animate-spin motion-reduce:animate-none" />Saving…</>
              ) : 'Save changes'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
