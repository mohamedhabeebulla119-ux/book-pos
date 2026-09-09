import React from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface InfoBoxProps {
  icon: LucideIcon
  title: string
  tone?: 'info' | 'accent' | 'success'
  className?: string
  children: React.ReactNode
}

const toneClasses = {
  info: {
    box: 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30',
    title: 'text-blue-800 dark:text-blue-300',
    icon: 'text-blue-500 dark:text-blue-400',
  },
  accent: {
    box: 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30',
    title: 'text-orange-800 dark:text-orange-300',
    icon: 'text-orange-600 dark:text-orange-400',
  },
  success: {
    box: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30',
    title: 'text-emerald-800 dark:text-emerald-300',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
}

export function InfoBox({ icon: Icon, title, tone = 'info', className, children }: InfoBoxProps) {
  const t = toneClasses[tone]
  return (
    <div className={cn('rounded-2xl p-5 border', t.box, className)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={17} className={t.icon} />
        <h3 className={cn('text-sm font-bold uppercase tracking-wide', t.title)}>{title}</h3>
      </div>
      {children}
    </div>
  )
}
