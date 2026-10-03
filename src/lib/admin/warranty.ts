import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { parseRupeeInput, type ParseResult } from './pricing'

/**
 * Admin access to the product condition / warranty tables and product photo
 * uploads (migration 20261002120000).
 *
 *   product_warranty_options – "product_warranty_options admin all"
 *   condition_grades         – "condition_grades admin all"
 *   storage `product-images` – "product images admin insert/update/delete"
 *
 * All owner/admin through private.has_role('admin'); staff can read, and the
 * database refuses their writes whatever the UI shows. Customers can never
 * write any of it. No service_role key is used.
 */

type Tables = Database['public']['Tables']
export type WarrantyOptionRow = Tables['product_warranty_options']['Row']
export type ConditionGradeRow = Tables['condition_grades']['Row']

/** Conditions the admin may choose. 'refurbished' exists in the database but is not offered yet. */
export const CONDITION_OPTIONS = [
  { value: 'brand_new', label: 'Brand New' },
  { value: 'pre_owned', label: 'Pre-Owned' },
] as const

export const WARRANTY_TYPE_OPTIONS = [
  { value: 'none', label: 'No Warranty' },
  { value: 'included', label: 'Included Warranty' },
  { value: 'optional_paid', label: 'Optional Paid Warranty' },
] as const

/** Whole rupees, where 0 is allowed (an option included at no extra cost). */
export function parseAddOnInput(raw: string): ParseResult {
  if (raw.trim() === '0') return { ok: true, rupees: 0 }
  return parseRupeeInput(raw)
}

// ---------------------------------------------------------------------------
// Warranty options
// ---------------------------------------------------------------------------

export async function listWarrantyOptions(productId: string): Promise<WarrantyOptionRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('product_warranty_options')
    .select('*')
    .eq('product_id', productId)
    .order('display_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addWarrantyOption(
  productId: string,
  input: { months: number; addOnCents: number },
  existing: WarrantyOptionRow[],
): Promise<WarrantyOptionRow> {
  const { data, error } = await getSupabaseClient()
    .from('product_warranty_options')
    .insert({
      product_id: productId,
      duration_months: input.months,
      additional_price_cents: input.addOnCents,
      display_order: existing.length,
      // The first option a product gets is its default.
      is_default: existing.length === 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWarrantyOption(
  id: string,
  patch: Partial<Pick<WarrantyOptionRow, 'duration_months' | 'additional_price_cents' | 'is_enabled' | 'display_order'>>,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('product_warranty_options').update(patch).eq('id', id).select('id').single()
  if (error) throw error
}

export async function deleteWarrantyOption(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('product_warranty_options').delete().eq('id', id)
  if (error) throw error
}

/**
 * Exactly one default per product (a partial unique index enforces it), so the
 * old default is cleared before the new one is set. A default must be enabled
 * (CHECK), so setting it also enables it.
 */
export async function setDefaultWarrantyOption(productId: string, id: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error: clearError } = await supabase
    .from('product_warranty_options').update({ is_default: false })
    .eq('product_id', productId).eq('is_default', true)
  if (clearError) throw clearError
  const { error } = await supabase
    .from('product_warranty_options').update({ is_default: true, is_enabled: true })
    .eq('id', id).select('id').single()
  if (error) throw error
}

/** Rewrites display_order 0..n in the given order. */
export async function reorderWarrantyOptions(orderedIds: string[]): Promise<void> {
  for (const [index, id] of orderedIds.entries()) {
    await updateWarrantyOption(id, { display_order: index })
  }
}

// ---------------------------------------------------------------------------
// Condition grades
// ---------------------------------------------------------------------------

export async function listConditionGrades(): Promise<ConditionGradeRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('condition_grades').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createConditionGrade(
  input: { code: string; label: string; description: string | null },
  existing: ConditionGradeRow[],
): Promise<void> {
  const { error } = await getSupabaseClient().from('condition_grades').insert({
    code: input.code.trim(),
    label: input.label.trim(),
    description: input.description?.trim() || null,
    sort_order: existing.length,
  })
  if (error) throw error
}

export async function updateConditionGrade(
  id: string,
  patch: Partial<Pick<ConditionGradeRow, 'code' | 'label' | 'description' | 'is_active' | 'sort_order'>>,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('condition_grades').update(patch).eq('id', id).select('id').single()
  if (error) throw error
}

/** Products using the grade keep working: the foreign key sets their grade to none. */
export async function deleteConditionGrade(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('condition_grades').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Product photos — Supabase Storage bucket `product-images`
// ---------------------------------------------------------------------------

export const PRODUCT_IMAGE_BUCKET = 'product-images'
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
/** Mirrors the bucket's own file_size_limit (5 MB). */
const IMAGE_MAX_BYTES = 5 * 1024 * 1024

export function validateProductImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.'
  if (file.size > IMAGE_MAX_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`
  }
  return null
}

/** Uploads under `<product id>/<uuid>.<ext>` and returns the storage path. */
export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const problem = validateProductImage(file)
  if (problem) throw new Error(problem)
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${productId}/${crypto.randomUUID()}.${extension}`
  const { error } = await getSupabaseClient().storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return path
}

/** Best-effort: a stale file costs storage, not correctness. */
export async function removeProductImageFile(path: string): Promise<void> {
  await getSupabaseClient().storage.from(PRODUCT_IMAGE_BUCKET).remove([path])
}
