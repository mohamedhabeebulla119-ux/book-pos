import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminShell } from '@/components/admin/AdminShell'

/**
 * Wraps every admin page EXCEPT /admin/login, which sits outside this route
 * group precisely so the guard cannot redirect the sign-in page to itself.
 */
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  )
}
