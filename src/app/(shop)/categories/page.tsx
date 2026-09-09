"use client"

import { Header } from '@/components/ui/Header'
import { CategoryCard } from '@/components/ui/CategoryCard'
import { PageHeading } from '@/components/ui/Heading'
import { motion } from 'framer-motion'

export default function CategoriesPage() {
  const mainCategories = [
    { title: 'iPhone', subtitle: 'Pro & Standard', image: '/images/categories/iphone.jpg', href: '/categories/iphone' },
    { title: 'iPad', subtitle: 'Air, Pro & mini', image: '/images/categories/ipad.jpg', href: '/categories/ipad' },
    { title: 'Mac', subtitle: 'Laptops & Desktops', image: '/images/categories/mac.jpg', href: '/categories/mac' },
    { title: 'Apple Watch', subtitle: 'Ultra, Series & SE', image: '/images/categories/apple-watch.jpg', href: '/categories/watch' },
    { title: 'AirPods', subtitle: 'Pro, Max & Earbuds', image: '/images/categories/airpods.jpg', href: '/categories/airpods', fullWidth: true },
  ]

  const serviceCategories = [
    { title: 'Replacement Parts', subtitle: 'Displays, Batteries & More', image: '/images/categories/replacement-parts.jpg', href: '/categories/parts' },
    { title: 'Accessories', subtitle: 'Cases, Chargers & Cables', image: '/images/categories/accessories.jpg', href: '/categories/accessories' }
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
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="w-full">
        <div className="px-5 sm:px-6 py-6 sm:py-8">
          <PageHeading title="Categories" subtitle="Browse Apple devices, genuine parts and accessories." />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-12"
          >
            <div>
              <h2 className="text-2xl sm:text-[28px] font-bold mb-5 tracking-tight">Apple Devices</h2>
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
              <h2 className="text-2xl sm:text-[28px] font-bold mb-5 tracking-tight">Parts & Accessories</h2>
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
