import { Crown } from 'lucide-react'
import { AdminPageHeading, AdminPlaceholder } from '@/components/admin/AdminPage'

export default function AdminVipCustomersPage() {
  return (
    <>
      <AdminPageHeading title="VIP Customers" subtitle="Grant and revoke Wholesale VIP status." />
      <AdminPlaceholder
        icon={Crown}
        title="VIP management is not built yet"
        description="VIP status is granted manually through the admin_set_customer_type function. It is never earned automatically by order quantity."
      />
    </>
  )
}
