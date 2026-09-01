"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Box } from 'lucide-react'

interface CategoryCardProps {
  title: string
  subtitle?: string
  image: string
  href: string
  color?: string
  fullWidth?: boolean
}

export function CategoryCard({ title, subtitle, image, href, color = "bg-[#111111]", fullWidth = false }: CategoryCardProps) {
  return (
    <Link href={href} className="block w-full h-full">
      <motion.div 
        whileHover={{ scale: 0.98 }}
        whileTap={{ scale: 0.96 }}
        className={`relative overflow-hidden rounded-[24px] ${fullWidth ? 'aspect-[2/1] sm:aspect-[2.2/1]' : 'aspect-[0.95/1]'} flex flex-col group ${color}`}
      >
        <div className="absolute inset-0 w-full h-full">
          <img 
            src={image} 
            alt={title}
            className="w-full h-full object-cover object-center transition-transform duration-[800ms] ease-out group-hover:scale-105"
          />
        </div>
        
        {/* Subtle, smooth gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent/0 z-10 pointer-events-none opacity-90 transition-opacity duration-500 group-hover:opacity-100" />
        
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

