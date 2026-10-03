"use client"

import { Header } from '@/components/ui/Header'
import { CategoryCard } from '@/components/ui/CategoryCard'
import { PageHeading } from '@/components/ui/Heading'
import { motion } from 'framer-motion'
import { CATEGORY_GROUPS } from '@/data/categoryMeta'

export default function CategoriesPage() {
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
        <div className="px-4 sm:px-6 py-6 sm:py-8">
          <PageHeading title="Categories" subtitle="Browse Apple devices, genuine parts and accessories." />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-9"
          >
            {CATEGORY_GROUPS.map((group) => (
              <div key={group.title}>
                <h2 className="text-xl sm:text-[28px] font-bold mb-4 tracking-tight">{group.title}</h2>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {group.categories.map((category) => (
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
            ))}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
