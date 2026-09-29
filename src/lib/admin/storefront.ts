import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { StoreSettings } from '@/lib/store/settings'

/**
 * Admin data access for /admin/settings: store configuration, storefront
 * switches, featured products and promotional banners.
 *
 * Everything goes through the existing browser client and is gated by RLS:
 *   store_settings     – "store_settings admin update"   (owner/admin)
 *   featured_products  – "featured_products admin all"   (owner/admin)
 *   banners            – "banners admin all"             (owner/admin)
 *   storage `banners`  – "banners images admin insert/update/delete"
 * Staff can read all of it and write none of it; the database refuses the
 * write whatever the UI does. No service-role key is involved.
 */

type Tables = Database['public']['Tables']
export type FeaturedRow = Tables['featured_products']['Row']
export type BannerRow = Tables['banners']['Row']

/** The storefront slot the homepage carousel reads (liveCatalog.ts). */
export const FEATURED_SLOT = 'home'

// ---------------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------------

export type StoreSettingsPatch = Partial<Omit<StoreSettings, 'id' | 'currency' | 'created_at' | 'updated_at' | 'updated_by'>>

export async function loadStoreSettings(): Promise<StoreSettings> {
  const { data, error } = await getSupabaseClient()
    .from('store_settings')
    .select('*')
    .eq('id', true)
    .single()
  if (error) throw error
  return data
}

/**
 * Saves a change to the one settings row. `.select().single()` makes a write
 * RLS silently filtered out (0 rows) surface as an error instead of looking
 * like a success.
 */
export async function saveStoreSettings(patch: StoreSettingsPatch): Promise<StoreSettings> {
  const { data, error } = await getSupabaseClient()
    .from('store_settings')
    .update(patch)
    .eq('id', true)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Featured products
// ---------------------------------------------------------------------------

export async function listFeatured(): Promise<FeaturedRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('featured_products')
    .select('*')
    .eq('slot', FEATURED_SLOT)
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Appends a product. unique (slot, product_id) refuses a duplicate. */
export async function addFeatured(productId: string, position: number): Promise<FeaturedRow> {
  const { data, error } = await getSupabaseClient()
    .from('featured_products')
    .insert({ slot: FEATURED_SLOT, product_id: productId, position, is_active: true })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function setFeaturedActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('featured_products').update({ is_active: isActive }).eq('id', id).select('id').single()
  if (error) throw error
}

export async function removeFeatured(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('featured_products').delete().eq('id', id)
  if (error) throw error
}

/** Rewrites positions 1..n in the given order. */
export async function reorderFeatured(orderedIds: string[]): Promise<void> {
  const supabase = getSupabaseClient()
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from('featured_products').update({ position: index + 1 }).eq('id', id).select('id').single()
    if (error) throw error
  }
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

export const BANNER_SLOTS = [
  { value: 'home', label: 'Retail home' },
  { value: 'wholesale', label: 'Wholesale home' },
] as const

export interface BannerDraft {
  slot: string
  title: string | null
  subtitle: string | null
  cta_label: string | null
  cta_href: string | null
  image_path: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

export async function listBanners(): Promise<BannerRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('banners')
    .select('*')
    .order('slot', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createBanner(draft: BannerDraft, sortOrder: number): Promise<BannerRow> {
  const { data, error } = await getSupabaseClient()
    .from('banners')
    .insert({ ...draft, sort_order: sortOrder })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateBanner(id: string, patch: Partial<BannerDraft>): Promise<BannerRow> {
  const { data, error } = await getSupabaseClient()
    .from('banners').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function deleteBanner(banner: BannerRow): Promise<void> {
  const { error } = await getSupabaseClient().from('banners').delete().eq('id', banner.id)
  if (error) throw error
  // The row is gone, so its image is orphaned; removing it is safe.
  if (banner.image_path) await removeBannerImage(banner.image_path)
}

/** Rewrites sort_order 1..n in the given order (one slot at a time). */
export async function reorderBanners(orderedIds: string[]): Promise<void> {
  const supabase = getSupabaseClient()
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from('banners').update({ sort_order: index + 1 }).eq('id', id).select('id').single()
    if (error) throw error
  }
}

// ---------------------------------------------------------------------------
// Banner images — Supabase Storage bucket `banners`
// ---------------------------------------------------------------------------

export const BANNER_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
/** Mirrors the bucket's own file_size_limit (5 MB). */
export const BANNER_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export function validateBannerImage(file: File): string | null {
  if (!(BANNER_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Use a JPG, PNG or WebP image.'
  }
  if (file.size > BANNER_IMAGE_MAX_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`
  }
  return null
}

/** Uploads a new image under a unique name and returns its storage path. */
export async function uploadBannerImage(file: File): Promise<string> {
  const problem = validateBannerImage(file)
  if (problem) throw new Error(problem)
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${crypto.randomUUID()}.${extension}`
  const { error } = await getSupabaseClient().storage
    .from('banners')
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return path
}

/** Best-effort: a stale file costs storage, not correctness. */
export async function removeBannerImage(path: string): Promise<void> {
  await getSupabaseClient().storage.from('banners').remove([path])
}
