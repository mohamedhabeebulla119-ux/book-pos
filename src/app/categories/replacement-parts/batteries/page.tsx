"use client"

import { Header } from '@/components/ui/Header'
import { iphoneModels } from '@/data/iphoneModels'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'

export default function BatterySelectionPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  }

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header />
      
      <main className="flex-1 w-full max-w-md mx-auto">
        <div className="px-4 py-3 flex items-center text-sm text-muted-foreground">
          <Link href="/categories/parts" className="hover:text-primary flex items-center">
            <ArrowLeft size={16} className="mr-1" /> Back to Parts
          </Link>
        </div>

        <div className="px-5 sm:px-6 py-4">
          <h1 className="text-3xl font-bold tracking-tight">iPhone Battery Models</h1>
          <p className="text-muted-foreground mt-1 mb-6">Select your iPhone model</p>
          
          <motion.div 
            variants={containerVariants}
            initial="show"
            animate="show"
            className="grid grid-cols-2 gap-3 sm:gap-4"
          >
            {iphoneModels.map((model) => (
              <motion.div key={model.id} variants={itemVariants}>
                <Link href={`/categories/replacement-parts/batteries/${model.id}`} className="block w-full h-full">
                  <div className="group flex flex-col h-full bg-card rounded-2xl overflow-hidden border border-border/50 hover:border-primary/30 transition-all hover:shadow-md">
                    <div className="aspect-[4/5] bg-muted/20 relative p-3 sm:p-4 flex items-center justify-center">
                      <img 
                        src={model.image} 
                        alt={model.name} 
                        className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-3 sm:p-4 flex flex-col flex-1">
                      <h3 className="font-semibold text-sm line-clamp-1">{model.name}</h3>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {model.battery.specifications["Capacity"]}
                      </p>
                      <div className="mt-auto pt-2 flex items-center justify-between">
                        <span className="font-semibold text-sm">${model.battery.price}</span>
                        <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
