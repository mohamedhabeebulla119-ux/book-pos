"use client"

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { formatPrice } from '@/utils/formatPrice'
import { Badge } from '@/components/ui/Badge'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { buildPartProduct } from '@/lib/partProduct'
import { getProductSpecChips } from '@/lib/productSpecChips'
import type { IPhoneModel } from '@/data/iphoneModels'

const EASE = [0.22, 1, 0.36, 1] as const

interface PartModelGridProps {
  models: IPhoneModel[]
  partKind: 'display' | 'battery'
}

export function PartModelGrid({ models, partKind }: PartModelGridProps) {
  const basePath = `/categories/replacement-parts/${partKind === 'display' ? 'displays' : 'batteries'}`
  const theme = getCategoryTheme(partKind === 'display' ? 'displays' : 'batteries')

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {models.map((model, i) => {
        const part = partKind === 'display' ? model.display : model.battery
        const technology = partKind === 'display' ? part.specifications['Technology'] : undefined
        const partType = part.specifications['Part Type']
        const specChips = getProductSpecChips(buildPartProduct(model, partKind))

        return (
          <motion.div
            key={model.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04, ease: EASE }}
          >
            <Link href={`${basePath}/${model.id}`} className="block w-full h-full">
              <div className={`group flex flex-col h-full bg-surface rounded-[26px] overflow-hidden border border-mint/80 dark:border-border ${theme.glow} hover:shadow-float hover:border-primary/25 transition-all duration-400 p-2.5 sm:p-3`}>
                <div className={`aspect-[4/5] ${theme.well} rounded-[20px] relative p-3 sm:p-4 flex items-center justify-center overflow-hidden`}>
                  {technology && (
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <Badge tone={technology.includes('LCD') ? 'neutral' : 'current'}>
                        {technology.includes('LCD') ? 'LCD' : 'OLED'}
                      </Badge>
                    </div>
                  )}
                  <img
                    src={model.image}
                    alt={model.name}
                    className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="pt-3 px-1 pb-1 flex flex-col flex-1">
                  <h3 className="font-semibold text-sm line-clamp-1">{model.name}</h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {partType}
                  </p>
                  <div className="mt-auto pt-2">
                    <span className="text-[15px] font-bold tracking-tight block mb-2">
                      <span className="text-[11px] font-medium text-muted-foreground mr-0.5">From</span>
                      {formatPrice(part.price)}
                    </span>
                    {specChips.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                        {specChips.map(({ icon: Icon, label }) => (
                          <span
                            key={label}
                            className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg bg-primary-soft text-[10px] font-semibold text-primary whitespace-nowrap"
                          >
                            <Icon size={11} className="shrink-0" />
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="h-9 rounded-full bg-gradient-cta text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-glow group-hover:bg-gradient-cta-hover transition-all duration-300">
                      View Details <ArrowRight size={13} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}
