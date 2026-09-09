
export function generateStaticParams() {
  return [
    { category: 'iphone' },
    { category: 'ipad' },
    { category: 'mac' },
    { category: 'watch' },
    { category: 'airpods' },
    { category: 'parts' },
    { category: 'accessories' }
  ]
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
