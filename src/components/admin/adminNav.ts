import {
  LayoutDashboard,
  Package,
  Tags,
  Crown,
  ClipboardCheck,
  ShoppingCart,
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

/**
 * The admin sidebar. Deliberately defined in one place and imported only by
 * admin components, so nothing in the customer navigation can ever surface it.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin',               label: 'Dashboard',     icon: LayoutDashboard, hint: 'Overview' },
  { href: '/admin/products',      label: 'Products',      icon: Package,         hint: 'Catalog and variants' },
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
