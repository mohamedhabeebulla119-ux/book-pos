export const categorySlugToName: Record<string, string> = {
  iphone: 'iPhone',
  ipad: 'iPad',
  mac: 'Mac',
  watch: 'Apple Watch',
  airpods: 'AirPods',
  parts: 'Replacement Parts',
  accessories: 'Accessories',
}

export const categorySubtitle: Record<string, string> = {
  iphone: 'All iPhone models',
  ipad: 'All iPad models',
  mac: 'All Mac models',
  parts: 'Genuine Apple replacement parts',
  accessories: 'Apple accessories & cables',
  watch: 'Apple Watch collection',
  airpods: 'AirPods collection',
}

const categoryNameToSlug: Record<string, string> = Object.fromEntries(
  Object.entries(categorySlugToName).map(([slug, name]) => [name, slug])
)

export function categorySlugFromName(categoryName: string): string {
  return categoryNameToSlug[categoryName] ?? categoryName.toLowerCase()
}

export interface CategoryHeroCopy {
  eyebrow: string
  headline: string
  blurb: string
}

export const categoryHeroCopy: Record<string, CategoryHeroCopy> = {
  iphone: { eyebrow: 'Apple iPhone', headline: 'Discover the iPhone', blurb: 'The complete iPhone lineup, from everyday performance to Pro power.' },
  ipad: { eyebrow: 'Apple iPad', headline: 'Discover iPad', blurb: 'Powerful, portable, and ready for anything you create.' },
  mac: { eyebrow: 'Apple Mac', headline: 'Discover Mac', blurb: 'Laptops and desktops built for speed, power and everyday work.' },
  watch: { eyebrow: 'Apple Watch', headline: 'Discover Apple Watch', blurb: 'Your health, fitness and connectivity — right on your wrist.' },
  airpods: { eyebrow: 'Apple AirPods', headline: 'Discover AirPods', blurb: 'Immersive sound and a seamless connection to every Apple device.' },
  parts: { eyebrow: 'Genuine Parts', headline: 'Replacement Parts', blurb: 'Quality displays, batteries and components for every repair.' },
  accessories: { eyebrow: 'Apple Expert', headline: 'Accessories', blurb: 'Cases, chargers, cables and everything else you need.' },
  displays: { eyebrow: 'Genuine Displays', headline: 'iPhone Displays', blurb: 'Sharp, true-to-life replacement screens for every iPhone.' },
  batteries: { eyebrow: 'Genuine Batteries', headline: 'iPhone Batteries', blurb: 'Restore full-day battery life with a genuine replacement.' },
}
