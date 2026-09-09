"use client"

import { use } from 'react'
import { Header } from '@/components/ui/Header'
import { iphoneModels } from '@/data/iphoneModels'
import { PartDetailView } from '@/components/parts/PartDetailView'

export default function DisplayDetailsPage({ params }: { params: Promise<{ model: string }> }) {
  const resolvedParams = use(params)
  const model = iphoneModels.find(m => m.id === resolvedParams.model)

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <PartDetailView model={model} partKind="display" />
    </div>
  )
}
