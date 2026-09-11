import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { ProductSubcategory } from '@/types'
import type { AdminRole } from './roles'

/**
 * Admin product data access.
 *
 * Every call goes through the existing browser client and is gated by the
 * existing RLS policies — "<table> admin all" uses private.has_role('admin'),
 * which covers owner and admin. Staff hold SELECT-only policies, so a staff
 * session can read this data and simply cannot write it; the database refuses
 * the write regardless of what the UI allows.
 *
 * No service_role key is used anywhere. No schema change was required.
 */

type Tables = Database['public']['Tables']

export type ProductRow = Tables['products']['Row']
export type VariantRow = Tables['product_variants']['Row']
export type SpecRow = Tables['product_specs']['Row']
export type ImageRow = Tables['product_images']['Row']
export type CompatibilityRow = Tables['product_compatibility']['Row']
export type CategoryRow = Tables['categories']['Row']

/** Only owner and admin may write; staff is read-only by RLS. */
export function canEditCatalog(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

/**
 * Mirrors the subcategory CHECK constraint on public.products. Typed as the
 * existing ProductSubcategory union so TypeScript fails the build if the two
 * ever drift apart — this is not a second catalog model, just the pick list.
 */
export const SUBCATEGORY_OPTIONS: readonly ProductSubcategory[] = [
  'Devices',
  'Displays',
  'Batteries',
  'Cameras',
  'Charging Parts',
  'Speakers & Microphones',
  'Buttons & Flex Cables',
  'Motherboard / IC',
  'Cases',
  'iPhone Cases',
  'Chargers',
  'Power Adapters',
  'Cables',
  'USB-C Cables',
  'Screen Protection',
  'MagSafe',
  'Other Accessories',
]

export const LIFECYCLE_OPTIONS = ['NEW', 'CURRENT', 'OLDER'] as const
export const WARRANTY_STATUS_OPTIONS = ['active', 'none'] as const

/** A product row plus its category slug, for the list view. */
export interface AdminProductListItem {
  id: string
  name: string
  subcategory: string
  model: string | null
  stock: number
  is_active: boolean
  lifecycle_status: string | null
  category_id: string
  categorySlug: string
  categoryName: string
}

export interface AdminProductDetail {
  product: ProductRow
  variants: VariantRow[]
  specs: SpecRow[]
  images: ImageRow[]
  compatibility: CompatibilityRow[]
}

/** Fields an admin may edit. `id` is deliberately absent — see loadProductDetail. */
export interface ProductPatch {
  name: string
  category_id: string
  subcategory: string
  model: string | null
  description: string
  warranty_text: string | null
  warranty_status: string | null
  warranty_duration: string | null
  warranty_months: number | null
  warranty_coverage: string | null
  lifecycle_status: string | null
  is_new: boolean
}

/** Variant fields an admin may edit. legacy_key is NOT among them. */
export interface VariantPatch {
  name: string
  color: string | null
  color_code: string | null
  storage: string | null
  stock: number | null
  sort_order: number
}

export interface SpecDraft {
  /** Existing row id, or null for a spec being added. */
  id: string | null
  label: string
  value: string
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listCategories(): Promise<CategoryRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Every product the caller may see. Admins and staff see inactive rows too,
 * because their policies are not filtered by is_active.
 */
export async function listProducts(categories: CategoryRow[]): Promise<AdminProductListItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('products')
    .select('id, name, subcategory, model, stock, is_active, lifecycle_status, category_id')
    .order('sort_order', { ascending: true })

  if (error) throw error

  const bySlug = new Map(categories.map((c) => [c.id, c]))

  return (data ?? []).map((row) => {
    const category = bySlug.get(row.category_id)
    return {
      ...row,
      categorySlug: category?.slug ?? '',
      categoryName: category?.name ?? 'Uncategorised',
    }
  })
}

export async function loadProductDetail(id: string): Promise<AdminProductDetail> {
  const supabase = getSupabaseClient()

  const [product, variants, specs, images, compatibility] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).single(),
    supabase.from('product_variants').select('*').eq('product_id', id).order('sort_order', { ascending: true }),
    supabase.from('product_specs').select('*').eq('product_id', id).order('position', { ascending: true }),
    supabase.from('product_images').select('*').eq('product_id', id).order('position', { ascending: true }),
    supabase.from('product_compatibility').select('*').eq('product_id', id).order('position', { ascending: true }),
  ])

  if (product.error) throw product.error
  if (variants.error) throw variants.error
  if (specs.error) throw specs.error
  if (images.error) throw images.error
  if (compatibility.error) throw compatibility.error

  return {
    product: product.data,
    variants: variants.data ?? [],
    specs: specs.data ?? [],
    images: images.data ?? [],
    compatibility: compatibility.data ?? [],
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
// None of these touch product_prices or inventory_movements. Pricing has its own
// RPC (admin_set_price) and its own phase; stock movement has its own phase.
// `products.id` and `product_variants.legacy_key` are never written, which is
// what keeps static routes and saved cart/wishlist entries resolvable.
// ---------------------------------------------------------------------------

export async function updateProduct(id: string, patch: ProductPatch): Promise<ProductRow> {
  const { data, error } = await getSupabaseClient()
    .from('products')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function setProductActive(id: string, isActive: boolean): Promise<ProductRow> {
  const { data, error } = await getSupabaseClient()
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateVariant(variantId: string, patch: VariantPatch): Promise<VariantRow> {
  const { data, error } = await getSupabaseClient()
    .from('product_variants')
    .update(patch)
    .eq('id', variantId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Applies a specification edit incrementally: update what changed, insert what
 * is new, delete what was removed.
 *
 * Deliberately NOT delete-all-then-insert. The browser client has no
 * transaction, so a failure half way through a wipe-and-rewrite would destroy
 * a product's specifications outright.
 */
export async function saveSpecs(
  productId: string,
  drafts: SpecDraft[],
  existing: SpecRow[],
): Promise<SpecRow[]> {
  const supabase = getSupabaseClient()

  const keptIds = new Set(drafts.map((d) => d.id).filter((id): id is string => Boolean(id)))
  const removed = existing.filter((row) => !keptIds.has(row.id))

  for (const row of removed) {
    const { error } = await supabase.from('product_specs').delete().eq('id', row.id)
    if (error) throw error
  }

  for (const [index, draft] of drafts.entries()) {
    const label = draft.label.trim()
    const value = draft.value.trim()
    if (!label) continue

    if (draft.id) {
      const before = existing.find((row) => row.id === draft.id)
      if (before && before.label === label && before.value === value && before.position === index) continue

      const { error } = await supabase
        .from('product_specs')
        .update({ label, value, position: index })
        .eq('id', draft.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('product_specs')
        .insert({ product_id: productId, label, value, position: index })
      if (error) throw error
    }
  }

  const { data, error } = await supabase
    .from('product_specs')
    .select('*')
    .eq('product_id', productId)
    .order('position', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Image reference management only.
 *
 * Files are NOT uploaded: the 27MB library still ships in the APK and
 * `path` continues to hold the same /images/... strings. Supabase Storage
 * migration is a separate phase, and faking an upload here would be worse than
 * not offering one.
 */
export async function updateImage(
  imageId: string,
  patch: { path: string; alt: string | null; position: number },
): Promise<ImageRow> {
  const { data, error } = await getSupabaseClient()
    .from('product_images')
    .update(patch)
    .eq('id', imageId)
    .select()
    .single()

  if (error) throw error
  return data
}
