"use client"

import { Header } from '@/components/ui/Header'
import { CategoryCard } from '@/components/ui/CategoryCard'
import { motion } from 'framer-motion'

export default function CategoriesPage() {
  const mainCategories = [
    { title: 'iPhone', subtitle: 'Pro & Standard', image: 'https://images.unsplash.com/photo-1512054502232-10a0a035d672?auto=format&fit=crop&q=80&w=800', href: '/categories/iphone' },
    { title: 'iPad', subtitle: 'Air, Pro & mini', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=800', href: '/categories/ipad' },
    { title: 'Mac', subtitle: 'Laptops & Desktops', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=800', href: '/categories/mac' },
    { title: 'Apple Watch', subtitle: 'Ultra, Series & SE', image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&q=80&w=800', href: '/categories/watch' },
    { title: 'AirPods', subtitle: 'Pro, Max & Earbuds', image: 'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?auto=format&fit=crop&q=80&w=800', href: '/categories/airpods', fullWidth: true },
  ]

  const serviceCategories = [
    { title: 'Replacement Parts', subtitle: 'Displays, Batteries & More', image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=400', href: '/categories/parts' },
    { title: 'Accessories', subtitle: 'Cases, Chargers & Cables', image: 'https://images.unsplash.com/photo-1616428784116-2a62886ed2d0?auto=format&fit=crop&q=80&w=400', href: '/categories/accessories' }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  }

  return (
    <div className="flex flex-col min-h-screen pb-6">
      <Header />
      
      <main className="w-full">
        <div className="px-5 sm:px-6 py-6 sm:py-8">
          <h1 className="text-[36px] sm:text-[42px] leading-tight font-bold tracking-tight mb-8">Categories</h1>
          
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-12"
          >
            <div>
              <h2 className="text-[28px] sm:text-[32px] font-semibold mb-5 tracking-tight">Apple Devices</h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {mainCategories.map((category) => (
                  <motion.div 
                    key={category.title} 
                    variants={itemVariants} 
                    className={category.fullWidth ? 'col-span-2' : ''}
                  >
                    <CategoryCard {...category} />
                  </motion.div>
                ))}
              </div>
            </div>
            
            <div>
              <h2 className="text-[28px] sm:text-[32px] font-semibold mb-5 tracking-tight">Parts & Accessories</h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {serviceCategories.map((category) => (
                  <motion.div key={category.title} variants={itemVariants}>
                    <CategoryCard {...category} />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
