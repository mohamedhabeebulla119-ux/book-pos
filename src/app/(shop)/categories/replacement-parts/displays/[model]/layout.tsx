
import { iphoneModels } from '@/data/iphoneModels'

export function generateStaticParams() {
  return iphoneModels.map((m) => ({
    model: m.id
  }))
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
