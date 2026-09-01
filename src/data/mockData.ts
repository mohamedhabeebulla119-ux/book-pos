import { Product } from '@/types'

export const products: Product[] = [
  {
    id: 'iphone-17-pro-max',
    name: 'iPhone 17 Pro Max',
    category: 'iPhone',
    subcategory: 'Devices',
    model: 'iPhone 17 Pro Max',
    price: 1199,
    images: [
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1695048132711-2856230f2520?auto=format&fit=crop&q=80&w=800'
    ],
    description: 'The ultimate iPhone. Forged in titanium and featuring the groundbreaking A19 Pro chip, customizable Action button, and the most advanced Pro camera system ever.',
    specifications: {
      'Display': '6.9" Super Retina XDR OLED',
      'Chip': 'A19 Pro chip',
      'Camera': 'Pro camera system (48MP Main, 12MP Ultra Wide, 12MP Telephoto)',
      'Material': 'Titanium with textured matte glass back'
    },
    stock: 50,
    rating: 4.9,
    reviewsCount: 1284,
    warranty: '1 Year Apple Limited Warranty',
    featured: true,
    isNew: true,
    variants: [
      { id: 'v1', name: 'Natural Titanium 256GB', price: 1199, color: 'Natural Titanium', colorCode: '#B8B3A9', storage: '256GB' },
      { id: 'v2', name: 'Black Titanium 256GB', price: 1199, color: 'Black Titanium', colorCode: '#4B4C4F', storage: '256GB' },
      { id: 'v3', name: 'Natural Titanium 512GB', price: 1399, color: 'Natural Titanium', colorCode: '#B8B3A9', storage: '512GB' }
    ]
  },
  {
    id: 'macbook-pro-16',
    name: 'MacBook Pro 16"',
    category: 'Mac',
    subcategory: 'Devices',
    model: 'MacBook Pro',
    price: 2499,
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&q=80&w=800'
    ],
    description: 'Mind-blowing. Head-turning. MacBook Pro blasts forward with the M3 Max chip. Built for all types of creators.',
    specifications: {
      'Display': '16.2" Liquid Retina XDR display',
      'Chip': 'M3 Pro or M3 Max',
      'Memory': 'Up to 128GB unified memory',
      'Storage': 'Up to 8TB SSD'
    },
    stock: 20,
    rating: 4.8,
    reviewsCount: 843,
    warranty: '1 Year Apple Limited Warranty',
    featured: true,
    variants: [
      { id: 'v4', name: 'Space Black M3 Pro 18GB', price: 2499, color: 'Space Black', colorCode: '#2E2E2E', storage: '512GB' },
      { id: 'v5', name: 'Silver M3 Pro 18GB', price: 2499, color: 'Silver', colorCode: '#E3E4E5', storage: '512GB' }
    ]
  },
  {
    id: 'airpods-pro-2',
    name: 'AirPods Pro (2nd generation)',
    category: 'AirPods',
    subcategory: 'Devices',
    model: 'AirPods Pro',
    price: 249,
    images: [
      'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&q=80&w=800'
    ],
    description: 'Reengineered for richer audio, up to 2x more Active Noise Cancellation, and Adaptive Transparency.',
    specifications: {
      'Audio': 'Active Noise Cancellation, Adaptive Transparency',
      'Chip': 'H2 headphone chip',
      'Battery': 'Up to 6 hours of listening time',
      'Charging': 'MagSafe Charging Case (USB-C)'
    },
    stock: 150,
    rating: 4.9,
    reviewsCount: 4231,
    warranty: '1 Year Apple Limited Warranty',
    featured: true
  },
  {
    id: 'apple-watch-ultra-2',
    name: 'Apple Watch Ultra 2',
    category: 'Apple Watch',
    subcategory: 'Devices',
    model: 'Apple Watch Ultra',
    price: 799,
    images: [
      'https://images.unsplash.com/photo-1664478546384-d57ffe74a78c?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1696446700622-48ec59a7ee1d?auto=format&fit=crop&q=80&w=800'
    ],
    description: 'The most rugged and capable Apple Watch pushes the limits again. Featuring the all-new S9 SiP.',
    specifications: {
      'Display': 'Always-On Retina LTPO OLED, up to 3000 nits',
      'Material': 'Aerospace-grade titanium',
      'Water Resistance': '100m water resistant',
      'Battery': 'Up to 36 hours'
    },
    stock: 35,
    rating: 4.7,
    reviewsCount: 932,
    warranty: '1 Year Apple Limited Warranty',
    featured: true
  },
  {
    id: 'part-iphone-15-pro-display',
    name: 'OLED Display Assembly',
    category: 'Replacement Parts',
    subcategory: 'Displays',
    model: 'iPhone 15 Pro',
    price: 329,
    images: [
      'https://images.unsplash.com/photo-1593108625902-8a9d12a203f1?auto=format&fit=crop&q=80&w=800'
    ],
    description: 'Genuine Apple OLED Display Assembly replacement for iPhone 15 Pro. Includes display, digitizer, and front glass.',
    specifications: {
      'Part Type': 'OLED Display Assembly',
      'Condition': 'New (Genuine Apple)',
      'Resolution': '2556x1179-pixel resolution at 460 ppi',
      'Features': 'Dynamic Island, ProMotion, True Tone'
    },
    compatibility: ['iPhone 15 Pro'],
    stock: 12,
    rating: 5.0,
    reviewsCount: 24,
    warranty: '90 Days Part Warranty',
    featured: true
  },
  {
    id: 'part-iphone-15-pro-battery',
    name: 'Replacement Battery Kit',
    category: 'Replacement Parts',
    subcategory: 'Batteries',
    model: 'iPhone 15 Pro',
    price: 99,
    images: [
      'https://images.unsplash.com/photo-1588636979603-9975765664db?auto=format&fit=crop&q=80&w=800'
    ],
    description: 'Genuine replacement battery for iPhone 15 Pro. Restores factory battery life and performance.',
    specifications: {
      'Capacity': '3274 mAh',
      'Type': 'Lithium-ion polymer',
      'Condition': 'New (Genuine Apple)'
    },
    compatibility: ['iPhone 15 Pro'],
    stock: 45,
    rating: 4.8,
    reviewsCount: 112,
    warranty: '1 Year Part Warranty'
  },
  {
    id: 'acc-magsafe-charger',
    name: 'MagSafe Charger',
    category: 'Accessories',
    subcategory: 'MagSafe',
    price: 39,
    images: [
      'https://images.unsplash.com/photo-1616428784116-2a62886ed2d0?auto=format&fit=crop&q=80&w=800'
    ],
    description: 'The MagSafe Charger makes wireless charging a snap. The perfectly aligned magnets attach to your iPhone.',
    specifications: {
      'Connector': 'USB-C',
      'Output': 'Up to 15W wireless charging',
      'Cable Length': '1m'
    },
    compatibility: ['iPhone 15', 'iPhone 15 Pro', 'iPhone 14', 'iPhone 13', 'iPhone 12 Series'],
    stock: 200,
    rating: 4.6,
    reviewsCount: 840,
    warranty: '1 Year Apple Limited Warranty'
  },
  {
    id: 'part-macbook-pro-14-display',
    name: 'Liquid Retina XDR Display Assembly',
    category: 'Replacement Parts',
    subcategory: 'Displays',
    model: 'MacBook Pro 14"',
    price: 799,
    images: [
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&q=80&w=800'
    ],
    description: 'Complete display assembly for the 14-inch MacBook Pro. Includes the aluminum housing, LCD panel, and camera module.',
    specifications: {
      'Part Type': 'Complete Display Assembly',
      'Color': 'Space Gray',
      'Resolution': '3024-by-1964 native resolution at 254 pixels per inch'
    },
    compatibility: ['MacBook Pro 14" (2021)', 'MacBook Pro 14" (2023)'],
    stock: 4,
    rating: 4.9,
    reviewsCount: 15,
    warranty: '90 Days Part Warranty'
  }
]
