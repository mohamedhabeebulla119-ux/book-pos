import { getSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { describeAdminError } from './errors'
import { newRequestId } from './inventory'
import type { AdminRole } from './roles'
import type { GrnLineInput, GrnResult } from './units'

/**
 * Purchase & Returns — suppliers, purchase orders, supplier returns and
 * supplier payments. Every write goes through a SECURITY DEFINER function from
 * migration 20261028160000; the tables are read-only for browser sessions.
 *
 * What the shop owes a supplier:
 *   opening balance + GRNs received - credit returns - payments
 * A cash return is money handed back; it is listed but does not change it.
 */

type Tables = Database['public']['Tables']
export type SupplierRow = Tables['suppliers']['Row']
export type PurchaseOrderRow = Tables['purchase_orders']['Row']
export type PurchaseOrderLineRow = Tables['purchase_order_lines']['Row']
export type SupplierReturnRow = Tables['supplier_returns']['Row']
export type SupplierReturnItemRow = Tables['supplier_return_items']['Row']
export type SupplierPaymentRow = Tables['supplier_payments']['Row']

export { newRequestId }

/** Admin and owner write here; staff can view suppliers, POs and returns. */
export function canManagePurchasing(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export async function listSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true })
    .limit(2000)
  if (error) throw error
  return data ?? []
}

export interface SupplierInput {
  id: string | null
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
  note: string
  openingBalanceCents: number
  isActive: boolean
}

export async function saveSupplier(input: SupplierInput): Promise<{ id: string; supplier_code: string; name: string }> {
  const { data, error } = await getSupabaseClient().rpc('admin_save_supplier', {
    p_id: input.id,
    p_name: input.name,
    p_contact_person: input.contactPerson,
    p_phone: input.phone,
    p_email: input.email,
    p_address: input.address,
    p_note: input.note,
    p_opening_balance_cents: input.openingBalanceCents,
    p_is_active: input.isActive,
  })
  if (error) throw error
  return data as unknown as { id: string; supplier_code: string; name: string }
}

export interface SupplierBalance {
  supplierId: string
  openingCents: number
  purchasesCents: number
  creditReturnsCents: number
  cashReturnsCents: number
  paymentsCents: number
  balanceCents: number
}

/** Admin/owner only — the database refuses everyone else. */
export async function loadSupplierBalances(): Promise<Map<string, SupplierBalance>> {
  const { data, error } = await getSupabaseClient().rpc('admin_supplier_balances')
  if (error) throw error
  return new Map((data ?? []).map((r) => [r.supplier_id, {
    supplierId: r.supplier_id,
    openingCents: Number(r.opening_cents),
    purchasesCents: Number(r.purchases_cents),
    creditReturnsCents: Number(r.credit_returns_cents),
    cashReturnsCents: Number(r.cash_returns_cents),
    paymentsCents: Number(r.payments_cents),
    balanceCents: Number(r.balance_cents),
  }]))
}

// ---------------------------------------------------------------------------
// Receiving goods (GRN) from a supplier, optionally against a PO
// ---------------------------------------------------------------------------

export interface ReceiveInput {
  supplierId: string
  purchaseOrderId: string | null
  supplierInvoice: string
  receivedOn: string
  note: string
  lines: GrnLineInput[]
  requestId: string
}

export async function receiveGoods(input: ReceiveInput): Promise<GrnResult> {
  const { data, error } = await getSupabaseClient().rpc('admin_receive_goods', {
    p_supplier_id: input.supplierId,
    p_purchase_order_id: input.purchaseOrderId,
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

// ---------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------

export const PO_STATUSES = ['open', 'partially_received', 'received', 'closed', 'cancelled'] as const
export type PoStatus = (typeof PO_STATUSES)[number]

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  open: 'Open',
  partially_received: 'Partly received',
  received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export function isPoReceivable(status: string): boolean {
  return status === 'open' || status === 'partially_received'
}

export interface PurchaseOrderListItem extends PurchaseOrderRow {
  supplierName: string
}

export async function listPurchaseOrders(): Promise<PurchaseOrderListItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('purchase_orders')
    .select('*, suppliers(name)')
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map(({ suppliers, ...row }) => ({
    ...(row as PurchaseOrderRow),
    supplierName: (suppliers as { name: string } | null)?.name ?? '—',
  }))
}

export interface PurchaseOrderDetail {
  po: PurchaseOrderListItem
  lines: PurchaseOrderLineRow[]
  grns: { id: string; grn_number: string; received_on: string; total_units: number }[]
}

export async function loadPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
  const supabase = getSupabaseClient()
  const [po, lines, grns] = await Promise.all([
    supabase.from('purchase_orders').select('*, suppliers(name)').eq('id', id).single(),
    supabase.from('purchase_order_lines').select('*').eq('purchase_order_id', id).order('line_no'),
    supabase.from('grns').select('id, grn_number, received_on, total_units').eq('purchase_order_id', id).order('created_at'),
  ])
  if (po.error) throw po.error
  if (lines.error) throw lines.error
  if (grns.error) throw grns.error
  const { suppliers, ...row } = po.data
  return {
    po: { ...(row as PurchaseOrderRow), supplierName: (suppliers as { name: string } | null)?.name ?? '—' },
    lines: lines.data ?? [],
    grns: grns.data ?? [],
  }
}

export interface PoLineInput {
  productId: string
  variantId: string | null
  quantity: number
  unitCostCents: number
}

export async function createPurchaseOrder(input: {
  supplierId: string
  orderDate: string
  expectedDate: string | null
  note: string
  lines: PoLineInput[]
  requestId: string
}): Promise<{ id: string; po_number: string; replayed: boolean }> {
  const { data, error } = await getSupabaseClient().rpc('admin_create_purchase_order', {
    p_supplier_id: input.supplierId,
    p_order_date: input.orderDate,
    p_expected_date: input.expectedDate,
    p_note: input.note,
    p_lines: input.lines.map((l) => ({
      product_id: l.productId,
      variant_id: l.variantId,
      quantity: l.quantity,
      unit_cost_cents: l.unitCostCents,
    })),
    p_request_id: input.requestId,
  })
  if (error) throw error
  return data as unknown as { id: string; po_number: string; replayed: boolean }
}

export async function closePurchaseOrder(id: string, note: string): Promise<{ status: PoStatus }> {
  const { data, error } = await getSupabaseClient().rpc('admin_close_purchase_order', {
    p_purchase_order_id: id,
    p_note: note,
  })
  if (error) throw error
  return data as unknown as { status: PoStatus }
}

// ---------------------------------------------------------------------------
// Supplier returns
// ---------------------------------------------------------------------------

export const RETURN_TYPES = [
  { value: 'credit', label: 'Credit', hint: 'Deducted from what you owe the supplier' },
  { value: 'cash', label: 'Cash', hint: 'The supplier paid the money back' },
] as const
export type ReturnType = (typeof RETURN_TYPES)[number]['value']

export function returnTypeLabel(value: string): string {
  return RETURN_TYPES.find((t) => t.value === value)?.label ?? value
}

export interface SupplierReturnListItem extends SupplierReturnRow {
  supplierName: string
}

export async function listSupplierReturns(): Promise<SupplierReturnListItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('supplier_returns')
    .select('*, suppliers(name)')
    .order('return_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map(({ suppliers, ...row }) => ({
    ...(row as SupplierReturnRow),
    supplierName: (suppliers as { name: string } | null)?.name ?? '—',
  }))
}

export async function loadSupplierReturnItems(returnId: string): Promise<SupplierReturnItemRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('supplier_return_items')
    .select('*')
    .eq('supplier_return_id', returnId)
    .order('barcode_snapshot')
  if (error) throw error
  return data ?? []
}

export async function createSupplierReturn(input: {
  supplierId: string
  returnDate: string
  returnType: ReturnType
  codes: string[]
  note: string
  requestId: string
}): Promise<{ id: string; return_number: string; total_cents: number; total_units: number; replayed: boolean }> {
  const { data, error } = await getSupabaseClient().rpc('admin_create_supplier_return', {
    p_supplier_id: input.supplierId,
    p_return_date: input.returnDate,
    p_return_type: input.returnType,
    p_codes: input.codes,
    p_note: input.note,
    p_request_id: input.requestId,
  })
  if (error) throw error
  return data as unknown as { id: string; return_number: string; total_cents: number; total_units: number; replayed: boolean }
}

// ---------------------------------------------------------------------------
// Supplier payments
// ---------------------------------------------------------------------------

export const SUPPLIER_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
] as const
export type SupplierPaymentMethod = (typeof SUPPLIER_PAYMENT_METHODS)[number]['value']

export function supplierPaymentMethodLabel(value: string): string {
  return SUPPLIER_PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value
}

export interface SupplierPaymentListItem extends SupplierPaymentRow {
  supplierName: string
}

export async function listSupplierPayments(): Promise<SupplierPaymentListItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('supplier_payments')
    .select('*, suppliers(name)')
    .order('paid_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map(({ suppliers, ...row }) => ({
    ...(row as SupplierPaymentRow),
    supplierName: (suppliers as { name: string } | null)?.name ?? '—',
  }))
}

export async function recordSupplierPayment(input: {
  supplierId: string
  paidOn: string
  amountCents: number
  method: SupplierPaymentMethod
  reference: string
  note: string
  requestId: string
}): Promise<{ id: string; payment_number: string; replayed: boolean }> {
  const { data, error } = await getSupabaseClient().rpc('admin_record_supplier_payment', {
    p_supplier_id: input.supplierId,
    p_paid_on: input.paidOn,
    p_amount_cents: input.amountCents,
    p_method: input.method,
    p_reference: input.reference,
    p_note: input.note,
    p_request_id: input.requestId,
  })
  if (error) throw error
  return data as unknown as { id: string; payment_number: string; replayed: boolean }
}

export async function voidSupplierPayment(id: string, note: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_void_supplier_payment', { p_payment_id: id, p_note: note })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const DETAIL_CODES = new Set([
  'invalid_supplier', 'invalid_phone', 'invalid_email', 'invalid_amount', 'invalid_note', 'invalid_date',
  'duplicate_supplier', 'unknown_supplier', 'supplier_inactive', 'invalid_lines', 'invalid_quantity',
  'invalid_cost', 'unknown_product', 'invalid_variant', 'variant_product_mismatch', 'variant_required',
  'unknown_purchase_order', 'purchase_order_finished', 'purchase_order_mismatch', 'exceeds_purchase_order',
  'invalid_return_type', 'invalid_items', 'unit_not_found', 'duplicate_item', 'wrong_supplier',
  'unit_not_available', 'insufficient_stock', 'invalid_method', 'reference_required', 'invalid_reference',
  'unknown_payment', 'payment_voided',
  // GRN rules, raised when receiving goods
  'serial_required', 'invalid_serial', 'invalid_imei', 'invalid_serials', 'duplicate_serial',
  'untracked_stock', 'invalid_invoice',
])

/** A sentence the shop can act on. The database raises '<code>: <detail>'. */
export function describePurchasingError(err: unknown, fallback: string): string {
  const message = typeof (err as { message?: unknown })?.message === 'string' ? (err as { message: string }).message : ''
  const code = message.split(':')[0]?.trim()
  const detail = message.slice(message.indexOf(':') + 1).trim()
  if (code === 'not_authenticated' || code === 'insufficient_privilege') {
    return 'Your role cannot do this. It needs an owner or admin.'
  }
  if (DETAIL_CODES.has(code)) {
    return detail ? detail[0].toUpperCase() + detail.slice(1) + (detail.endsWith('.') ? '' : '.') : fallback
  }
  const e = (err ?? {}) as { code?: unknown }
  if (e.code === 'PGRST202' || e.code === 'PGRST205' || message.includes('Could not find the')) {
    return 'This screen needs the latest database update. Run the Purchase & Returns SQL in Supabase, then try again.'
  }
  return describeAdminError(err, fallback)
}

export function formatRupeesFromCents(cents: number): string {
  return `Rs. ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ---------------------------------------------------------------------------
// Scanning a unit for a supplier return
// ---------------------------------------------------------------------------

export interface ReturnUnit {
  id: string
  barcode: string
  serial: string | null
  status: string
  productName: string
  variantName: string | null
  unitCostCents: number
  grnNumber: string | null
  grnSupplierId: string | null
  grnSupplierName: string | null
}

interface ReturnUnitRow {
  id: string
  barcode: string
  serial_number: string | null
  status: string
  unit_cost_cents: number
  products: { name: string } | null
  product_variants: { name: string } | null
  grns: { grn_number: string; supplier_id: string | null; supplier_name: string } | null
}

/** Finds one unit by its barcode label or IMEI / serial. Staff can read units. */
export async function findUnitForReturn(code: string): Promise<ReturnUnit | null> {
  const value = code.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z0-9-]{4,40}$/.test(value)) return null
  const { data, error } = await getSupabaseClient()
    .from('inventory_units')
    .select('id, barcode, serial_number, status, unit_cost_cents, products(name), product_variants(name), grns(grn_number, supplier_id, supplier_name)')
    .or(`barcode.eq.${value},serial_number.eq.${value}`)
    .limit(1)
  if (error) throw error
  const row = (data as unknown as ReturnUnitRow[] | null)?.[0]
  if (!row) return null
  return {
    id: row.id,
    barcode: row.barcode,
    serial: row.serial_number,
    status: row.status,
    productName: row.products?.name ?? '—',
    variantName: row.product_variants?.name ?? null,
    unitCostCents: Number(row.unit_cost_cents),
    grnNumber: row.grns?.grn_number ?? null,
    grnSupplierId: row.grns?.supplier_id ?? null,
    grnSupplierName: row.grns?.supplier_name ?? null,
  }
}
