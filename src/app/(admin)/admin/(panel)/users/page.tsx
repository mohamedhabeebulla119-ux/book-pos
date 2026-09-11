import { Users } from 'lucide-react'
import { AdminPageHeading, AdminPlaceholder } from '@/components/admin/AdminPage'

export default function AdminUsersPage() {
  return (
    <>
      <AdminPageHeading title="Users" subtitle="Customer accounts and administrator roles." />
      <AdminPlaceholder
        icon={Users}
        title="User management is not built yet"
        description="Accounts and role grants will be managed here. Only an owner can change who holds an administrator role."
      />
    </>
  )
}
