import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { describeAdminError } from './errors'
import { newRequestId } from './inventory'
import type { AdminRole } from './roles'

/**
 * GRN, barcode units and in-store POS — data access.
 *
 * Every write goes through a SECURITY DEFINER function from migration
 * 20261028120000 (admin_post_grn, pos_create_sale, admin_write_off_units,
 * admin_return_pos_unit). The tables themselves are read-only for every
 * browser session, and only staff can read them at all — customers never see
 * a barcode or an IMEI.
 *
 * How a unit moves:
 *   GRN          -> in_stock (one barcode per physical item)
 *   online order -> reserved (oldest unit first, FIFO) -> sold when shipped
 *   counter scan -> sold
 *   write-off    -> written_off
 */

type Tables = Database['public']['Tables']
export type GrnRow = Tables['grns']['Row']
export type GrnLineRow = Tables['grn_lines']['Row']
export type UnitRow = Tables['inventory_units']['Row']
export type PosSaleRow = Tables['pos_sales']['Row']
export type PosSaleItemRow = Tables['pos_sale_items']['Row']

export const UNIT_STATUSES = ['in_stock', 'reserved', 'sold', 'written_off'] as const
export type UnitStatus = (typeof UNIT_STATUSES)[number]

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  in_stock: 'In stock',
  reserved: 'Reserved (online order)',
  sold: 'Sold',
  written_off: 'Written off',
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

export function paymentLabel(value: string): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value
}

/** GRN and write-off are admin/owner, like Adjust stock. */
export function canReceiveStock(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

/** Anyone in the admin panel can bill at the counter. */
export function canSell(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'staff'
}

/** Mirrors private.normalize_serial(): upper case, no spaces. */
export function normalizeCode(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

/** Luhn check, the same rule the database applies to a 15-digit IMEI. */
export function isValidImei(value: string): boolean {
  if (!/^[0-9]{15}$/.test(value)) return false
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let d = Number(value[i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

/** Same pattern as the inventory_units.serial_number CHECK. */
export function isValidSerial(value: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{3,29}$/.test(value)
}

/** Splits a pasted / scanned block into codes: one per line (or comma). */
export function splitCodes(text: string): string[] {
  return text.split(/[\n,;\t]+/).map(normalizeCode).filter((s) => s.length > 0)
}

export { newRequestId }

// ---------------------------------------------------------------------------
// Products for the GRN form
// ---------------------------------------------------------------------------

export interface GrnProductOption {
  id: string
  name: string
  isActive: boolean
  categoryName: string | null
  requiresSerial: boolean
  /** Units on the shelf right now (products.stock). */
  stock: number
  variants: { id: string; name: string; stock: number | null }[]
}

interface ProductEmbedRow {
  id: string
  name: string
  is_active: boolean
  stock: number
  sort_order: number
  categories: { name: string; requires_serial: boolean } | null
  product_variants: { id: string; name: string; stock: number | null; sort_order: number }[]
}

export async function listProductsForGrn(): Promise<GrnProductOption[]> {
  const { data, error } = await getSupabaseClient()
    .from('products')
    .select('id, name, is_active, stock, sort_order, categories(name, requires_serial), product_variants(id, name, stock, sort_order)')
    .order('name', { ascending: true })
    .limit(2000)

  if (error) throw error
  return ((data ?? []) as unknown as ProductEmbedRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    isActive: p.is_active,
    categoryName: p.categories?.name ?? null,
    requiresSerial: p.categories?.requires_serial ?? false,
    stock: p.stock,
    variants: [...(p.product_variants ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((v) => ({ id: v.id, name: v.name, stock: v.stock })),
  }))
}

// ---------------------------------------------------------------------------
// GRN
// ---------------------------------------------------------------------------

export interface GrnLineInput {
  productId: string
  variantId: string | null
  quantity: number
  unitCostCents: number
  /** Empty, or exactly one per unit (blank entries allowed when optional). */
  serials: string[]
}

export interface GrnInput {
  supplierName: string
  supplierInvoice: string
  /** yyyy-mm-dd */
  receivedOn: string
  note: string
  lines: GrnLineInput[]
  requestId: string
}

export interface GrnResult {
  id: string
  grn_number: string
  total_units: number
  replayed: boolean
}

export async function postGrn(input: GrnInput): Promise<GrnResult> {
  const { data, error } = await getSupabaseClient().rpc('admin_post_grn', {
    p_supplier_name: input.supplierName,
    p_supplier_invoice: input.supplierInvoice,
    p_received_on: input.receivedOn,
    p_note: input.note,
    p_lines: input.lines.map((l) => ({
      product_id: l.productId,
      variant_id: l.variantId,
      quantity: l.quantity,
      unit_cost_cents: l.unitCostCents,
      serials: l.serials,
    })),
    p_request_id: input.requestId,
  })
  if (error) throw error
  return data as unknown as GrnResult
}

export interface GrnListItem extends GrnRow {
  createdByName: string | null
}

export async function listGrns(): Promise<GrnListItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('grns')
    .select('*, profiles(full_name, email)')
    .order('received_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data ?? []).map(({ profiles, ...row }) => ({
    ...(row as GrnRow),
    createdByName: profiles?.full_name ?? profiles?.email ?? null,
  }))
}

/** A unit with the names a label and a list need. */
export interface UnitView extends UnitRow {
  productName: string
  variantName: string | null
  grnNumber: string | null
  supplierName: string | null
}

const UNIT_SELECT = '*, products(name), product_variants(name), grns(grn_number, supplier_name)'

interface UnitEmbedRow extends UnitRow {
  products: { name: string } | null
  product_variants: { name: string } | null
  grns: { grn_number: string; supplier_name: string } | null
}

function toUnitView(row: UnitEmbedRow): UnitView {
  const { products, product_variants, grns, ...unit } = row
  return {
    ...unit,
    productName: products?.name ?? unit.product_id,
    variantName: product_variants?.name ?? null,
    grnNumber: grns?.grn_number ?? null,
    supplierName: grns?.supplier_name ?? null,
  }
}

export interface GrnDetail {
  grn: GrnRow
  lines: GrnLineRow[]
  units: UnitView[]
}

export async function loadGrn(grnId: string): Promise<GrnDetail> {
  const supabase = getSupabaseClient()
  const [grn, lines, units] = await Promise.all([
    supabase.from('grns').select('*').eq('id', grnId).single(),
    supabase.from('grn_lines').select('*').eq('grn_id', grnId).order('line_no'),
    supabase.from('inventory_units').select(UNIT_SELECT).eq('grn_id', grnId).order('fifo_seq').limit(2000),
  ])
  if (grn.error) throw grn.error
  if (lines.error) throw lines.error
  if (units.error) throw units.error
  return {
    grn: grn.data,
    lines: lines.data ?? [],
    units: ((units.data ?? []) as unknown as UnitEmbedRow[]).map(toUnitView),
  }
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export const UNIT_FETCH_LIMIT = 500

export interface UnitFilter {
  status: UnitStatus | 'all'
  productId: string | null
  /** Barcode or IMEI fragment. */
  code: string
}

export async function listUnits(filter: UnitFilter): Promise<UnitView[]> {
  let query = getSupabaseClient()
    .from('inventory_units')
    .select(UNIT_SELECT)
    .order('received_on', { ascending: true })
    .order('fifo_seq', { ascending: true })
    .limit(UNIT_FETCH_LIMIT)

  if (filter.status !== 'all') query = query.eq('status', filter.status)
  if (filter.productId) query = query.eq('product_id', filter.productId)
  const code = normalizeCode(filter.code).replace(/[^A-Z0-9-]/g, '')
  if (code) query = query.or(`barcode.ilike.%${code}%,serial_number.ilike.%${code}%`)

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as UnitEmbedRow[]).map(toUnitView)
}

export interface UnitSummaryRow {
  productId: string
  variantId: string | null
  productName: string
  variantName: string | null
  inStock: number
  reserved: number
  sold: number
  writtenOff: number
  oldestReceivedOn: string | null
}

export async function loadUnitSummary(products: GrnProductOption[]): Promise<UnitSummaryRow[]> {
  const { data, error } = await getSupabaseClient().rpc('admin_unit_stock_summary')
  if (error) throw error

  const byId = new Map(products.map((p) => [p.id, p]))
  return (data ?? []).map((r) => {
    const product = byId.get(r.product_id)
    return {
      productId: r.product_id,
      variantId: r.variant_id ?? null,
      productName: product?.name ?? r.product_id,
      variantName: product?.variants.find((v) => v.id === r.variant_id)?.name ?? null,
      inStock: Number(r.in_stock),
      reserved: Number(r.reserved),
      sold: Number(r.sold),
      writtenOff: Number(r.written_off),
      oldestReceivedOn: r.oldest_received_on ?? null,
    }
  }).sort((a, b) => a.productName.localeCompare(b.productName) || (a.variantName ?? '').localeCompare(b.variantName ?? ''))
}

export async function writeOffUnits(unitIds: string[], reason: 'damage' | 'correction', note: string): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('admin_write_off_units', {
    p_unit_ids: unitIds,
    p_reason: reason,
    p_note: note,
  })
  if (error) throw error
  return (data as unknown as { written_off: number }).written_off
}

export async function returnPosUnit(unitId: string, note: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_return_pos_unit', { p_unit_id: unitId, p_note: note })
  if (error) throw error
}

/** Units an online order holds — what staff pick and pack. */
export async function listOrderUnits(orderId: string): Promise<UnitView[]> {
  const { data, error } = await getSupabaseClient()
    .from('inventory_units')
    .select(UNIT_SELECT)
    .eq('order_id', orderId)
    .order('received_on')
    .order('fifo_seq')
  if (error) throw error
  return ((data ?? []) as unknown as UnitEmbedRow[]).map(toUnitView)
}

// ---------------------------------------------------------------------------
// POS
// ---------------------------------------------------------------------------

export interface ScannedUnit {
  unit_id: string
  barcode: string
  serial_number: string | null
  status: UnitStatus
  product_id: string
  variant_id: string | null
  product_name: string
  variant_name: string | null
  /** Live retail price; null when the item has none (it cannot be sold). */
  price_cents: number | null
}

export async function lookupUnit(code: string): Promise<ScannedUnit> {
  const { data, error } = await getSupabaseClient().rpc('pos_lookup_unit', { p_code: code })
  if (error) throw error
  return data as unknown as ScannedUnit
}

export interface PosSaleInput {
  codes: string[]
  paymentMethod: PaymentMethod
  discountCents: number
  customerName: string
  customerPhone: string
  note: string
  requestId: string
}

export interface PosSaleResult {
  id: string
  bill_number: string
  total_cents: number
  replayed: boolean
}

export async function createPosSale(input: PosSaleInput): Promise<PosSaleResult> {
  const { data, error } = await getSupabaseClient().rpc('pos_create_sale', {
    p_codes: input.codes,
    p_payment_method: input.paymentMethod,
    p_discount_cents: input.discountCents,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_note: input.note,
    p_request_id: input.requestId,
  })
  if (error) throw error
  return data as unknown as PosSaleResult
}

export interface PosSaleListItem extends PosSaleRow {
  cashierName: string | null
  itemCount: number
}

export async function listPosSales(): Promise<PosSaleListItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('pos_sales')
    .select('*, profiles(full_name, email), pos_sale_items(count)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(({ profiles, pos_sale_items, ...row }) => ({
    ...(row as PosSaleRow),
    cashierName: profiles?.full_name ?? profiles?.email ?? null,
    itemCount: (pos_sale_items as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }))
}

export interface PosSaleDetail {
  sale: PosSaleRow
  items: PosSaleItemRow[]
  cashierName: string | null
}

export async function loadPosSale(saleId: string): Promise<PosSaleDetail> {
  const supabase = getSupabaseClient()
  const [sale, items] = await Promise.all([
    supabase.from('pos_sales').select('*, profiles(full_name, email)').eq('id', saleId).single(),
    supabase.from('pos_sale_items').select('*').eq('pos_sale_id', saleId).order('barcode_snapshot'),
  ])
  if (sale.error) throw sale.error
  if (items.error) throw items.error
  const { profiles, ...row } = sale.data
  return {
    sale: row as PosSaleRow,
    items: items.data ?? [],
    cashierName: profiles?.full_name ?? profiles?.email ?? null,
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * A sentence the shop can act on. The database raises '<code>: <detail>';
 * the detail already names the item, barcode or IMEI concerned.
 */
export function describeUnitError(err: unknown, fallback: string): string {
  const message = typeof (err as { message?: unknown })?.message === 'string' ? (err as { message: string }).message : ''
  const code = message.split(':')[0]?.trim()
  const detail = message.slice(message.indexOf(':') + 1).trim()
  switch (code) {
    case 'not_authenticated':
    case 'insufficient_privilege': return 'Your role cannot do this. GRNs and write-offs need an owner or admin.'
    case 'serial_required':
    case 'invalid_serial':
    case 'invalid_imei':
    case 'invalid_serials':
    case 'duplicate_serial':
    case 'untracked_stock':
    case 'variant_required':
    case 'invalid_date':
    case 'invalid_supplier':
    case 'invalid_invoice':
    case 'invalid_variant':
    case 'unknown_product':
    case 'variant_product_mismatch':
    case 'invalid_quantity':
    case 'invalid_cost':
    case 'invalid_lines':
    case 'unit_not_found':
    case 'unit_not_available':
    case 'unit_not_returnable':
    case 'duplicate_item':
    case 'invalid_discount':
    case 'invalid_note':
    case 'invalid_customer':
    case 'insufficient_stock':
    case 'price_unavailable': return capitalise(detail)
    default:
      if (isFunctionMissing(err)) return 'This feature becomes available after the next server update. Nothing was changed.'
      return describeAdminError(err, fallback)
  }
}

function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.') : text
}

function isFunctionMissing(err: unknown): boolean {
  const e = (err ?? {}) as { code?: unknown; message?: unknown }
  return e.code === 'PGRST202' || (typeof e.message === 'string' && e.message.includes('Could not find the function'))
}

/** yyyy-mm-dd in Sri Lanka time — the GRN date default. */
export function todayInColombo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
