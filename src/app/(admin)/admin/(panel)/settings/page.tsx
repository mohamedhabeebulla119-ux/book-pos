import { Settings } from 'lucide-react'
import { AdminPageHeading, AdminPlaceholder } from '@/components/admin/AdminPage'

export default function AdminSettingsPage() {
  return (
    <>
      <AdminPageHeading title="Settings" subtitle="Store configuration, merchandising and banners." />
      <AdminPlaceholder
        icon={Settings}
        title="Settings are not built yet"
        description="Featured products, promotional banners and store configuration will be managed from this section."
      />
    </>
  )
}
