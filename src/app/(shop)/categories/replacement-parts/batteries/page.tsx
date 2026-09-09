"use client"

import { Header } from '@/components/ui/Header'
import { CategoryHero } from '@/components/ui/CategoryHero'
import { PartModelGrid } from '@/components/parts/PartModelGrid'
import { iphoneModels } from '@/data/iphoneModels'
import { categoryHeroCopy } from '@/data/categoryMeta'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function BatterySelectionPage() {
  const hero = categoryHeroCopy.batteries

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header />

      <main className="flex-1 w-full max-w-md mx-auto">
        <div className="px-4 py-3 flex items-center text-sm text-muted-foreground">
          <Link href="/categories/parts" className="hover:text-primary flex items-center min-h-[44px]">
            <ArrowLeft size={16} className="mr-1" /> Back to Parts
          </Link>
        </div>

        <div className="px-5 sm:px-6 py-4">
          <CategoryHero
            eyebrow={hero.eyebrow}
            title={hero.headline}
            subtitle={hero.blurb}
            image={iphoneModels[0]?.battery.image}
            category="batteries"
            className="mb-6"
          />
          <p className="text-sm text-muted-foreground mb-4 -mt-2">Select your iPhone model</p>
          <PartModelGrid models={iphoneModels} partKind="battery" />
        </div>
      </main>
    </div>
  )
}
