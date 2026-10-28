import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tags,
  Crown,
  ClipboardCheck,
  ShoppingCart,
  PackagePlus,
  Boxes,
  ScanBarcode,
  Truck,
  Building2,
  ClipboardList,
  Undo2,
  Wallet,
  Users,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface AdminNavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Shown under the label in the mobile drawer. */
  hint: string
}

/** A collapsible sidebar section holding several pages. */
export interface AdminNavGroup {
  group: string
  label: string
  icon: LucideIcon
  hint: string
  children: AdminNavItem[]
}

export type AdminNavEntry = AdminNavItem | AdminNavGroup

export function isNavGroup(entry: AdminNavEntry): entry is AdminNavGroup {
  return 'children' in entry
}

/**
 * The admin sidebar. Deliberately defined in one place and imported only by
 * admin components, so nothing in the customer navigation can ever surface it.
 */
export const ADMIN_NAV: AdminNavEntry[] = [
  { href: '/admin',               label: 'Dashboard',     icon: LayoutDashboard, hint: 'Overview' },
  { href: '/admin/products',      label: 'Products',      icon: Package,         hint: 'Catalog and variants' },
  {
    group: 'purchasing', label: 'Purchase & Returns', icon: Truck, hint: 'Suppliers, GRN, returns',
    children: [
      { href: '/admin/suppliers',         label: 'Supplier Details',    icon: Building2,     hint: 'Who you buy from' },
      { href: '/admin/grn',               label: 'Good Receive Notice', icon: PackagePlus,   hint: 'Goods received, barcodes' },
      { href: '/admin/purchase-orders',   label: 'Purchase Orders',     icon: ClipboardList, hint: 'Orders to suppliers' },
      { href: '/admin/supplier-returns',  label: 'Supplier Returns',    icon: Undo2,         hint: 'Items sent back' },
      { href: '/admin/supplier-payments', label: 'Supplier Payments',   icon: Wallet,        hint: 'Money paid to suppliers' },
    ],
  },
  { href: '/admin/inventory',     label: 'Inventory',     icon: Boxes,           hint: 'Units on the shelf' },
  { href: '/admin/pos',           label: 'Shop counter',  icon: ScanBarcode,     hint: 'Scan and bill (POS)' },
  { href: '/admin/categories',    label: 'Categories',    icon: FolderTree,      hint: 'How products are grouped' },
  { href: '/admin/pricing',       label: 'Pricing',       icon: Tags,            hint: 'Retail and VIP prices' },
  { href: '/admin/vip-customers', label: 'VIP Customers', icon: Crown,           hint: 'Wholesale designation' },
  { href: '/admin/wholesale-requests', label: 'Wholesale',  icon: ClipboardCheck,  hint: 'Access requests' },
  { href: '/admin/orders',        label: 'Orders',        icon: ShoppingCart,    hint: 'Fulfilment' },
  { href: '/admin/users',         label: 'Users',         icon: Users,           hint: 'Accounts and roles' },
  { href: '/admin/settings',      label: 'Settings',      icon: Settings,        hint: 'Store configuration' },
]

/** Exact-match for the dashboard, prefix-match for the rest. */
export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin' || pathname === '/admin/'
  return pathname === href || pathname.startsWith(href + '/')
}
