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
      className="rounded-full bg-gradient-to-tr from-violet-500 via-primary to-sky-400 p-[2.5px] shrink-0"
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
        <span
          className="font-bold bg-gradient-to-br from-violet-600 to-primary bg-clip-text text-transparent select-none"
          style={{ fontSize: size * 0.32 }}
        >
          {getInitials(name)}
        </span>
      </div>
    </div>
  )
}
