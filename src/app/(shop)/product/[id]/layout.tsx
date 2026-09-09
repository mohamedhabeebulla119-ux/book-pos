
import { products } from '@/data/mockData'
import { allDevices } from '@/data/deviceData'

export function generateStaticParams() {
  const combinedProducts = [
    ...allDevices,
    ...products.filter(p => !allDevices.some(d => d.id === p.id))
  ]
  return combinedProducts.map((p) => ({
    id: p.id
  }))
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
