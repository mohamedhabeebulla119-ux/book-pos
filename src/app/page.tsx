"use client"

import { Header } from '@/components/ui/Header'
import { CategoryCard } from '@/components/ui/CategoryCard'
import { ProductCard } from '@/components/ui/ProductCard'
import { products } from '@/data/mockData'
import { allDevices } from '@/data/deviceData'
import { Button } from '@/components/ui/Button'
import { motion } from 'framer-motion'
import Link from 'next/link'

const combinedProducts = [
  ...allDevices,
  ...products.filter(p => !allDevices.some(d => d.id === p.id))
]

export default function Home() {
  const featuredProducts = combinedProducts.filter(p => p.featured)

  const categories = [
    { title: 'iPhone', subtitle: 'Pro & Standard', image: '/images/categories/iphone.jpg', href: '/categories/iphone', color: 'bg-zinc-800' },
    { title: 'Mac', subtitle: 'Laptops & Desktops', image: '/images/categories/mac.jpg', href: '/categories/mac', color: 'bg-neutral-800' },
    { title: 'Replacement Parts', subtitle: 'Displays & Batteries', image: '/images/categories/replacement-parts.jpg', href: '/categories/parts', color: 'bg-blue-900' },
    { title: 'Accessories', subtitle: 'Cases & Chargers', image: '/images/categories/accessories.jpg', href: '/categories/accessories', color: 'bg-indigo-900' }
  ]

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <Header />
      
      {/* Hero Section */}
      <section className="px-4 py-8 md:py-12 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Your Apple.<br />Your Way.
          </h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-sm mx-auto">
            Premium Apple products, genuine-quality replacement parts and accessories.
          </p>
          <Link href="/categories">
            <Button size="lg" className="px-10">Shop Now</Button>
          </Link>
        </motion.div>
        
        <motion.div 
          className="mt-12 w-full max-w-sm mx-auto aspect-square relative rounded-3xl overflow-hidden bg-gradient-to-tr from-zinc-200 to-zinc-50 dark:from-zinc-900 dark:to-zinc-800"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <img 
            src="https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&q=80&w=800" 
            alt="Apple Products" 
            className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal p-8"
          />
        </motion.div>
      </section>

      {/* Featured Categories */}
      <section className="px-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Explore Categories</h2>
          <Link href="/categories" className="text-sm text-primary font-medium hover:underline">
            See All
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {categories.map((category) => (
            <CategoryCard key={category.title} {...category} />
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="mt-12 mb-8">
        <div className="px-4 mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Featured Products</h2>
        </div>
        
        {/* Horizontal Scroll Snap */}
        <div className="flex overflow-x-auto gap-4 px-4 pb-6 snap-x snap-mandatory no-scrollbar">
          {featuredProducts.map(product => (
            <ProductCard key={product.id} product={product} featured />
          ))}
        </div>
      </section>
    </div>
  )
}
