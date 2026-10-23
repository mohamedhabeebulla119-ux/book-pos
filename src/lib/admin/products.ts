import { getSupabaseClient } from '@/lib/supabase/client'
import { setPrice } from './pricing'
import { setStock, newRequestId, isStockFunctionMissing, describeStockError, wasStockRequestRecorded } from './inventory'
import { resolveRequestOutcome } from './stockFlow'
import { describeAdminError } from './errors'
import type { Database } from '@/lib/supabase/database.types'
import type { ProductSubcategory } from '@/types'
import type { AdminRole } from './roles'
import { conditionLabel, MIXED_CONDITION_LABEL } from '@/lib/catalog'

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
  /**
   * What customers see on the card, by the same rules as the storefront: the
   * product's own condition, the shared variant condition, or "New & Pre-Owned".
   * Null when the stored value is one the UI does not offer (refurbished).
   */
  conditionSummary: string | null
  /** True when any purchasable item is pre-owned (badge styling). */
  hasPreOwned: boolean
  /** Older product-level condition data on a product with variants, awaiting assignment. */
  legacyCondition: boolean
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
  warranty_coverage: string | null
  lifecycle_status: string | null
  is_new: boolean
}

/*
 * Condition (product_conditions) and warranty type/duration/terms
 * (product_warranty_plans) are NOT product columns any more: they are edited
 * per product or per variant through lib/admin/warranty.ts. The old
 * products.condition* / warranty_* columns are only mirrored into by database
 * triggers, for app builds already installed, and are never written here.
 */

/**
 * Variant fields an admin may edit. legacy_key is NOT among them, and neither
 * is stock: it changes only through admin_set_stock() (lib/admin/inventory.ts).
 */
export interface VariantPatch {
  name: string
  color: string | null
  color_code: string | null
  storage: string | null
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
    .select('id, name, subcategory, model, stock, is_active, lifecycle_status, category_id, condition, battery_health, device_notes, product_variants(id), product_conditions(variant_id, condition, condition_grades(label))')
    .order('sort_order', { ascending: true })

  if (error) throw error

  const bySlug = new Map(categories.map((c) => [c.id, c]))

  return (data ?? []).map(({ product_variants: variantRows, product_conditions: conditionRows, condition: legacy, battery_health, device_notes, ...row }) => {
    const category = bySlug.get(row.category_id)
    const variantIds = (variantRows ?? []).map((v) => v.id)
    const rowFor = (variantId: string | null) => (conditionRows ?? []).find((c) => c.variant_id === variantId)
    // Each item's label: a variant's own row (none = Brand New), or the
    // product's row when it has no variants.
    const items = variantIds.length > 0
      ? variantIds.map((id) => rowFor(id))
      : [rowFor(null)]
    const labelled = items.map((c) => ({
      condition: c?.condition ?? 'brand_new',
      label: conditionLabel(c?.condition ?? 'brand_new', c?.condition_grades?.label ?? null),
    }))
    const kinds = new Set(labelled.map((l) => l.condition))
    const labels = new Set(labelled.map((l) => l.label))
    const conditionSummary =
      kinds.has('brand_new') && kinds.has('pre_owned') ? MIXED_CONDITION_LABEL
      : labels.size === 1 ? [...labels][0]
      : kinds.has('pre_owned') ? 'Pre-Owned'
      : null
    return {
      ...row,
      conditionSummary,
      hasPreOwned: kinds.has('pre_owned'),
      legacyCondition: variantIds.length > 0 && (legacy !== 'brand_new' || battery_health !== null || device_notes !== null),
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
// None of these touch product_prices, inventory_movements or a stock column.
// Prices change through admin_set_price() and stock through admin_set_stock();
// the database refuses direct writes to either.
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
  /** variant_id: null = shown for every variant; set = that variant only. */
  patch: { path: string; alt: string | null; position: number; variant_id: string | null },
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

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------
// products.id is the human slug and the primary key: the URL segment, the image
// filename, the cart line id and the wishlist entry all derive from it. It is
// therefore chosen once, at creation, and never edited afterwards.
// ---------------------------------------------------------------------------

/** Mirrors the CHECK constraint on products.id and categories.slug. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Suggests a slug from a name. The admin can always overwrite it. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export type SlugCheck = { ok: true } | { ok: false; reason: string }

export function validateSlug(slug: string, label = 'ID'): SlugCheck {
  if (slug.trim() === '') return { ok: false, reason: `${label} is required.` }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      reason: `${label} may use lowercase letters, numbers and single hyphens only — for example iphone-18-pro.`,
    }
  }
  return { ok: true }
}

/**
 * Whether a product id is already in use.
 *
 * Checked before the insert so the admin gets "that id is taken" rather than a
 * raw 23505 from PostgreSQL. The unique constraint remains the real guard: this
 * is a courtesy, and a race still ends in a clean database error.
 */
export async function isProductIdTaken(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from('products')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data !== null
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
// The categories table already models everything the admin screen needs,
// including a self-referencing parent_id for subcategories and the hero copy
// the storefront renders. Nothing new was added for this.
//
// NOTE ON SLUGS: a category slug is the /categories/<slug> URL segment. Those
// routes are prerendered from a fixed list at build time, so a category created
// here is fully usable for grouping products in the admin panel and for
// labelling them on the storefront, but it does not get a customer-facing
// listing route until the next build. That is a property of the static export,
// and the UI says so rather than quietly producing a dead link.
// ---------------------------------------------------------------------------

export interface CategoryInput {
  slug: string
  name: string
  subtitle: string | null
  parent_id: string | null
  hero_eyebrow: string | null
  hero_headline: string | null
  hero_blurb: string | null
  image_path: string | null
  sort_order: number
  is_active: boolean
}

export async function createCategory(input: CategoryInput): Promise<CategoryRow> {
  const { data, error } = await getSupabaseClient()
    .from('categories')
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data
}

/** Slug is editable here but doing so moves the customer URL — the UI warns. */
export async function updateCategory(id: string, patch: Partial<CategoryInput>): Promise<CategoryRow> {
  const { data, error } = await getSupabaseClient()
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<CategoryRow> {
  return updateCategory(id, { is_active: isActive })
}

/** How many products sit in each category, so the UI can warn before hiding one. */
export async function countProductsByCategory(): Promise<Map<string, number>> {
  const { data, error } = await getSupabaseClient().from('products').select('category_id')
  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1)
  }
  return counts
}

// ---------------------------------------------------------------------------
// Product creation
// ---------------------------------------------------------------------------
// Creating a product writes to up to six tables plus the pricing RPC, and the
// browser client has no transaction. The safety model here is therefore:
//
//   1. The product row is ALWAYS inserted with is_active = false. A half-built
//      product is invisible to customers by construction, not by luck.
//   2. Children are written next, then prices through admin_set_price().
//   3. Only when every step has succeeded is the product published, and only if
//      the admin asked for that AND a retail price actually exists.
//   4. If any step fails, the draft is removed and the original error is
//      reported. If even the cleanup fails, the caller is told the id of the
//      unpublished draft rather than being left to wonder.
//   5. Stock starts at zero (the stock guard refuses anything else on insert)
//      and variants share the product's stock. Opening stock is recorded last,
//      through admin_set_stock() as an opening_balance, just before publishing.
//      From that point the product has ledger history and can no longer be
//      deleted, so a later failure leaves it UNPUBLISHED rather than removing
//      it.
//
// A SECURITY DEFINER RPC would give a true all-or-nothing transaction and is
// the right eventual home for this, but it needs a migration applied to the
// database before it exists. This path works against the schema as it stands
// today, using only policies that are already in place.
// ---------------------------------------------------------------------------

export interface NewVariantInput {
  name: string
  color: string | null
  color_code: string | null
  storage: string | null
  /** Whole rupees, or null to leave the tier unpriced. */
  retailRupees: number | null
  vipRupees: number | null
  /** This variant's own condition. Pre-owned details are added in the editor. */
  condition: 'brand_new' | 'pre_owned'
}

export interface NewProductInput {
  id: string
  name: string
  category_id: string
  subcategory: string
  model: string | null
  description: string
  /** Recorded as an opening_balance once everything else has been written. 0 = none. */
  openingStock: number
  lifecycle_status: string | null
  is_new: boolean
  /**
   * brand_new | pre_owned for a product WITHOUT variants. A product with
   * variants takes each variant's own condition instead.
   */
  condition: 'brand_new' | 'pre_owned'
  warranty_text: string | null
  warranty_status: string | null
  warranty_duration: string | null
  warranty_months: number | null
  warranty_coverage: string | null
  specs: { label: string; value: string }[]
  images: { path: string; alt: string | null }[]
  compatibility: { label: string; device_model_id: string | null }[]
  variants: NewVariantInput[]
  /** Product-level prices, used when the product is not sold by variant. */
  retailRupees: number | null
  vipRupees: number | null
  /** Publish on success. Ignored unless at least one retail price was written. */
  publish: boolean
}

export interface CreateProductResult {
  id: string
  published: boolean
  /** Set when publishing was requested but withheld, with the reason. */
  withheld: string | null
  /** Set when opening stock could not be recorded yet (database not updated). */
  stockPending: string | null
}

/**
 * Thrown when creation did not fully succeed but the product was KEPT, as an
 * unpublished draft: it has stock history, its opening stock could not be
 * confirmed, or the database refused to remove it. The caller should refresh
 * the product list so the admin can find it.
 */
export class ProductKeptError extends Error {}

/** Variant ids the rest of the app uses: v1, v2, v3 … See product_variants.legacy_key. */
function legacyKeyFor(index: number): string {
  return `v${index + 1}`
}

export async function createProduct(input: NewProductInput): Promise<CreateProductResult> {
  const supabase = getSupabaseClient()

  const { error: productError } = await supabase.from('products').insert({
    id: input.id,
    name: input.name.trim(),
    category_id: input.category_id,
    subcategory: input.subcategory,
    model: input.model,
    description: input.description,
    // No stock column: it defaults to 0, the only value the stock guard accepts.
    lifecycle_status: input.lifecycle_status,
    is_new: input.is_new,
    warranty_text: input.warranty_text,
    warranty_status: input.warranty_status,
    warranty_duration: input.warranty_duration,
    warranty_months: input.warranty_months,
    warranty_coverage: input.warranty_coverage,
    // Never active on insert — see the note above.
    is_active: false,
  })
  if (productError) throw productError

  // Set once opening stock is in the ledger: the draft must then be kept.
  let stockRecorded = false

  try {
    if (input.variants.length > 0) {
      const { error } = await supabase.from('product_variants').insert(
        input.variants.map((variant, index) => ({
          product_id: input.id,
          legacy_key: legacyKeyFor(index),
          name: variant.name.trim(),
          color: variant.color,
          color_code: variant.color_code,
          storage: variant.storage,
          // No stock column: NULL = shares the product's stock.
          sort_order: index,
        })),
      )
      if (error) throw error
    }

    if (input.specs.length > 0) {
      const { error } = await supabase.from('product_specs').insert(
        input.specs.map((spec, index) => ({
          product_id: input.id,
          label: spec.label.trim(),
          value: spec.value.trim(),
          position: index,
        })),
      )
      if (error) throw error
    }

    if (input.images.length > 0) {
      const { error } = await supabase.from('product_images').insert(
        input.images.map((image, index) => ({
          product_id: input.id,
          path: image.path.trim(),
          alt: image.alt,
          position: index,
          is_primary: index === 0,
        })),
      )
      if (error) throw error
    }

    if (input.compatibility.length > 0) {
      const { error } = await supabase.from('product_compatibility').insert(
        input.compatibility.map((entry, index) => ({
          product_id: input.id,
          label: entry.label.trim(),
          device_model_id: entry.device_model_id,
          position: index,
        })),
      )
      if (error) throw error
    }

    // Variant uuids are needed for per-variant prices, and only the database
    // knows them — legacy_key is what ties them back to the drafts above.
    const { data: savedVariants, error: readBackError } = await supabase
      .from('product_variants')
      .select('id, legacy_key')
      .eq('product_id', input.id)
    if (readBackError) throw readBackError

    const variantIdByKey = new Map(
      (savedVariants ?? []).map((row) => [row.legacy_key ?? '', row.id]),
    )

    // The product's default warranty plan — the same rule migration
    // 20261002120000 applied to existing products ('active' = included). Type,
    // options and terms are then managed in the editor.
    const { error: planError } = await supabase.from('product_warranty_plans').insert({
      product_id: input.id,
      variant_id: null,
      warranty_type: input.warranty_status === 'active' ? 'included' : 'none',
      warranty_duration: input.warranty_duration,
      warranty_months: input.warranty_months,
    })
    if (planError) throw planError

    // Condition: the product's own row when it has no variants; otherwise a row
    // only for each Pre-Owned variant (no row = Brand New). Never one value
    // spread across every variant.
    const conditionRows: { product_id: string; variant_id: string | null; condition: string }[] = input.variants.length === 0
      ? [{ product_id: input.id, variant_id: null, condition: input.condition }]
      : input.variants.flatMap((variant, index) => {
          const variantId = variantIdByKey.get(legacyKeyFor(index))
          return variant.condition === 'pre_owned' && variantId
            ? [{ product_id: input.id, variant_id: variantId, condition: 'pre_owned' }]
            : []
        })
    if (conditionRows.length > 0) {
      const { error: conditionError } = await supabase.from('product_conditions').insert(conditionRows)
      if (conditionError) throw conditionError
    }

    let retailPriced = false

    // Prices go through admin_set_price() exactly like every other price change
    // in this app: it re-checks the admin role inside PostgreSQL, stamps the
    // history and is the only path with write access to product_prices.
    if (input.retailRupees !== null) {
      await setPrice({ productId: input.id, variantId: null, tierCode: 'retail', rupees: input.retailRupees })
      retailPriced = true
    }
    if (input.vipRupees !== null) {
      await setPrice({ productId: input.id, variantId: null, tierCode: 'wholesale_vip', rupees: input.vipRupees })
    }

    for (const [index, variant] of input.variants.entries()) {
      const variantId = variantIdByKey.get(legacyKeyFor(index))
      if (!variantId) continue

      if (variant.retailRupees !== null) {
        await setPrice({ productId: input.id, variantId, tierCode: 'retail', rupees: variant.retailRupees })
        retailPriced = true
      }
      if (variant.vipRupees !== null) {
        await setPrice({ productId: input.id, variantId, tierCode: 'wholesale_vip', rupees: variant.vipRupees })
      }
    }

    // Opening stock: last write before publishing, so every earlier failure can
    // still remove a draft that has no stock history.
    let stockPending: string | null = null
    if (input.openingStock > 0) {
      // One id for this attempt: it is how the ledger is asked afterwards
      // whether this exact request was applied.
      const requestId = newRequestId()
      try {
        await setStock({
          productId: input.id,
          variantId: null,
          expected: 0,
          next: input.openingStock,
          reason: 'opening_balance',
          note: 'Opening stock recorded when the product was created',
          requestId,
        })
        stockRecorded = true
      } catch (err) {
        if (isStockFunctionMissing(err)) {
          // A database without admin_set_stock() yet: keep the product at zero
          // stock and say so. Never fall back to writing stock directly.
          stockPending = `Opening stock of ${input.openingStock} was not recorded: stock adjustments become available after the next server update. Stock is 0 until then.`
        } else {
          // The request may have been applied even though no answer arrived
          // (a lost response). Ask the ledger before deciding anything.
          const outcome = await resolveRequestOutcome(() => wasStockRequestRecorded(requestId))
          if (outcome === 'uncertain') {
            throw new ProductKeptError(
              `Could not confirm whether the opening stock of ${input.openingStock} was recorded for "${input.id}" ` +
              `(${describeStockError(err)}). The product was kept UNPUBLISHED so nothing is lost. ` +
              'Open it from the products list and check its stock history before publishing.',
            )
          }
          if (outcome === 'not_recorded') throw err   // nothing applied: the draft can be removed
          stockRecorded = true                         // applied; only the answer was lost
        }
      }
    }

    if (input.publish && !retailPriced) {
      return {
        id: input.id,
        published: false,
        withheld: 'Saved as a draft: a product needs a retail price before customers can see it.',
        stockPending,
      }
    }

    if (input.publish) {
      await setProductActive(input.id, true)
      return { id: input.id, published: true, withheld: null, stockPending }
    }

    return { id: input.id, published: false, withheld: null, stockPending }
  } catch (err) {
    // Already decided: the product is kept.
    if (err instanceof ProductKeptError) throw err

    if (stockRecorded) {
      // Opening stock is in the ledger, which must never lose history: keep
      // the product, unpublished, rather than attempting a delete.
      throw new ProductKeptError(
        `Publishing failed: ${describeAdminError(err, 'the database refused the change.')} ` +
        `"${input.id}" was saved UNPUBLISHED with its opening stock of ${input.openingStock} recorded. ` +
        'Open it from the products list to publish it.',
      )
    }

    // Roll the draft back. Children and price rows go with it through the
    // ON DELETE CASCADE declared on every child table.
    const { error: cleanupError } = await supabase.from('products').delete().eq('id', input.id)
    if (cleanupError) {
      // The database refused the delete (for example, stock arrived after
      // all). The draft stays; it is never forced.
      throw new ProductKeptError(
        `${describeAdminError(err, 'The database refused part of the product.')} ` +
        `The unpublished draft "${input.id}" could not be removed automatically — ` +
        'open it from the products list to review it.',
      )
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Child rows on an existing product
// ---------------------------------------------------------------------------

export async function addVariant(
  productId: string,
  input: { name: string; color: string | null; color_code: string | null; storage: string | null },
  existing: VariantRow[],
): Promise<VariantRow> {
  // Continue the v1, v2, v3 … sequence without ever reusing a retired key: a
  // legacy_key is referenced by saved carts and by price rows.
  const used = new Set(existing.map((row) => row.legacy_key))
  let index = existing.length
  while (used.has(legacyKeyFor(index))) index += 1

  const { data, error } = await getSupabaseClient()
    .from('product_variants')
    .insert({
      product_id: productId,
      legacy_key: legacyKeyFor(index),
      name: input.name.trim(),
      color: input.color,
      color_code: input.color_code,
      storage: input.storage,
      // No stock column: a new variant shares its product's stock (P1 does not
      // switch variants between shared and own stock).
      sort_order: existing.length,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Destructive: the variant's price history goes with it. Always confirm first. */
export async function deleteVariant(variantId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('product_variants').delete().eq('id', variantId)
  if (error) throw error
}

export async function addImage(
  productId: string,
  input: { path: string; alt: string | null; storage_bucket?: string | null; variant_id?: string | null },
  existing: ImageRow[],
): Promise<ImageRow> {
  const { data, error } = await getSupabaseClient()
    .from('product_images')
    .insert({
      product_id: productId,
      path: input.path.trim(),
      alt: input.alt,
      // NULL = a bundled /images/... path; 'product-images' = an uploaded file.
      storage_bucket: input.storage_bucket ?? null,
      variant_id: input.variant_id ?? null,
      position: existing.length,
      // The first image a product gets is its card image.
      is_primary: existing.length === 0,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Removes the image row; an UPLOADED file is then removed from Storage too.
 * Bundled files ship in the APK and are never touched.
 */
export async function deleteImage(imageId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('product_images').delete().eq('id', imageId).select('path, storage_bucket').maybeSingle()
  if (error) throw error
  if (data?.storage_bucket) {
    // Best-effort: a stale file costs storage, not correctness.
    await supabase.storage.from(data.storage_bucket).remove([data.path])
  }
}

/** Exactly one primary image per product; the storefront shows it first. */
export async function setPrimaryImage(productId: string, imageId: string): Promise<void> {
  const supabase = getSupabaseClient()

  const { error: clearError } = await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)
  if (clearError) throw clearError

  const { error } = await supabase.from('product_images').update({ is_primary: true }).eq('id', imageId)
  if (error) throw error
}

export async function addCompatibility(
  productId: string,
  input: { label: string; device_model_id: string | null },
  existing: CompatibilityRow[],
): Promise<CompatibilityRow> {
  const { data, error } = await getSupabaseClient()
    .from('product_compatibility')
    .insert({
      product_id: productId,
      label: input.label.trim(),
      device_model_id: input.device_model_id,
      position: existing.length,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCompatibility(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('product_compatibility').delete().eq('id', id)
  if (error) throw error
}

/** Device models, for the compatibility picker. Existing table, unchanged. */
export async function listDeviceModels(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await getSupabaseClient()
    .from('device_models')
    .select('id, name')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data ?? []
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------
// order_items.product_id is ON DELETE SET NULL, so deleting a product does not
// destroy order history — but it does sever the line from the product it was.
// A product that has ever been ordered is therefore UNPUBLISHED, never deleted,
// which is also what keeps the admin order screens readable.
// ---------------------------------------------------------------------------

/** How many order lines reference this product. 0 means it is safe to delete. */
export async function countOrderLines(productId: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)

  if (error) throw error
  return count ?? 0
}

export type DeleteOutcome =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Deletes a product that has never been ordered.
 *
 * Refuses — rather than cascading — as soon as an order line references it. The
 * caller is expected to unpublish instead, which hides the product from
 * customers while leaving every order intact.
 */
export async function deleteProduct(productId: string): Promise<DeleteOutcome> {
  const orderLines = await countOrderLines(productId)
  if (orderLines > 0) {
    return {
      ok: false,
      reason:
        `This product appears on ${orderLines} order line${orderLines === 1 ? '' : 's'}. ` +
        'Unpublish it instead — deleting would cut those orders loose from what was bought.',
    }
  }

  const { error } = await getSupabaseClient().from('products').delete().eq('id', productId)
  // Stock on hand or stock history refuses the delete in the database.
  if (error) return { ok: false, reason: describeStockError(error) }
  return { ok: true }
}

/**
 * Product ids that have at least one live retail price.
 *
 * The storefront will not list a product it cannot price — the same rule that
 * keeps the unpriced replacement parts out of the catalog — so the products
 * screen uses this to say plainly which rows are published but still invisible.
 */
export async function listRetailPricedProductIds(): Promise<Set<string>> {
  const { data, error } = await getSupabaseClient()
    .from('product_prices')
    .select('product_id')
    .eq('tier_code', 'retail')
    .is('ends_at', null)

  if (error) throw error
  return new Set((data ?? []).map((row) => row.product_id))
}
