import { ShoppingCart } from 'lucide-react'
import { AdminPageHeading, AdminPlaceholder } from '@/components/admin/AdminPage'

export default function AdminOrdersPage() {
  return (
    <>
      <AdminPageHeading title="Orders" subtitle="Order history, status and fulfilment." />
      <AdminPlaceholder
        icon={ShoppingCart}
        title="Order management is not built yet"
        description="Orders will read from the orders and order_items tables, where each line stores the exact price paid so historical orders never change."
      />
    </>
  )
}
