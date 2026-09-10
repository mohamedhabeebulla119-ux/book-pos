import React from 'react'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const initials = parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
  return initials || '?'
}

interface AvatarProps {
  name: string
  size?: number
}

export function Avatar({ name, size = 64 }: AvatarProps) {
  return (
    <div
      className="rounded-full bg-gradient-cta p-[2.5px] shrink-0 shadow-glow"
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full rounded-full bg-card bg-surface flex items-center justify-center overflow-hidden">
        <span
          className="font-bold text-gradient-green select-none"
          style={{ fontSize: size * 0.32 }}
        >
          {getInitials(name)}
        </span>
      </div>
    </div>
  )
}
