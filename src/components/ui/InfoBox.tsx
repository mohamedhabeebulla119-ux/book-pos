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

/** All three tones stay in the green family and differ only by how deep the
 *  green sits, so an info panel never breaks the store's one-colour system. */
const toneClasses = {
  info: {
    box: 'bg-primary-soft border-mint-deep',
    title: 'text-primary-strong',
    icon: 'text-primary',
  },
  accent: {
    box: 'bg-mint border-mint-deep',
    title: 'text-primary-strong',
    icon: 'text-primary',
  },
  success: {
    box: 'bg-well-strong border-mint-deep',
    title: 'text-primary-strong',
    icon: 'text-primary',
  },
}

export function InfoBox({ icon: Icon, title, tone = 'info', className, children }: InfoBoxProps) {
  const t = toneClasses[tone]
  return (
    <div className={cn('rounded-3xl p-5 border shadow-card', t.box, className)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={17} className={t.icon} />
        <h3 className={cn('text-sm font-bold uppercase tracking-wide', t.title)}>{title}</h3>
      </div>
      {children}
    </div>
  )
}
