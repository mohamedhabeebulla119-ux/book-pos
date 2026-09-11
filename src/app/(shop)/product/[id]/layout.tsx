
import { getStaticProductIds } from '@/lib/catalog/staticCatalog'

/**
 * Runs at BUILD time, so it reads the bundled catalog only — never Supabase.
 * Static export resolves every route up front and has no fallback for an
 * unknown id, so adding a product still requires a rebuild. Price, stock and
 * publication state remain live at runtime.
 */
export function generateStaticParams() {
  return getStaticProductIds().map((id) => ({ id }))
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
