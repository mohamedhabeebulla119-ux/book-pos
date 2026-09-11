"use client"

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { getCategoryTheme } from '@/lib/categoryTheme'

interface CategoryCardProps {
  title: string
  subtitle?: string
  image: string
  href: string
  color?: string
  fullWidth?: boolean
}

export function CategoryCard({ title, subtitle, image, href, fullWidth = false }: CategoryCardProps) {
  const theme = getCategoryTheme(title)

  return (
    <Link href={href} className="block w-full h-full">
      <motion.div
        whileHover={{ scale: 0.98 }}
        whileTap={{ scale: 0.96 }}
        className={`relative overflow-hidden rounded-[26px] bg-[#111112] border border-mint/70 dark:border-border ${theme.glow} ${fullWidth ? 'aspect-[2/1] sm:aspect-[2.2/1]' : 'aspect-[0.95/1]'} flex flex-col group`}
      >
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <Image
            src={image}
            alt={title}
            fill
            sizes={fullWidth ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"}
            className="object-cover object-center transition-transform duration-[800ms] ease-out group-hover:scale-105"
          />
        </div>

        {/* Readability scrim only. Deliberately neutral black/transparent: the
            photography must keep its true colors, so no green tint layer here —
            the brand green lives in the UI around and on top of the photo. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-10 pointer-events-none opacity-90 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm shadow-card flex items-center justify-center text-primary group-hover:bg-white transition-colors">
          <ArrowUpRight size={16} strokeWidth={2.25} />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-5 flex flex-col justify-end">
          <h3 className="font-bold text-[22px] sm:text-[26px] text-white tracking-tight leading-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-white/80 text-[14px] sm:text-[16px] mt-1 font-medium tracking-tight">
              {subtitle}
            </p>
          )}
        </div>
      </motion.div>
    </Link>
  )
}

