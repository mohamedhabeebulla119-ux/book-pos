"use client"

import { motion } from 'framer-motion'
import { Box, ShieldCheck, Wrench, Check, ShoppingBag } from 'lucide-react'
import { formatPrice } from '@/utils/formatPrice'

const easeOut = [0.22, 1, 0.36, 1] as const

export function WelcomeVisual() {
  return (
    <div className="relative w-full aspect-square max-w-[280px] mx-auto flex items-center justify-center">
      <div className="absolute w-3/4 h-3/4 bg-primary/15 blur-[70px] rounded-full" />
      <motion.img
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: easeOut }}
        src="/images/products/iphone/iphone-17-pro.jpg"
        alt="iPhone 17 Pro"
        className="relative z-10 w-[70%] h-auto object-contain drop-shadow-2xl mix-blend-multiply dark:mix-blend-normal"
      />
    </div>
  )
}

export function DiscoverVisual() {
  const tiles = [
    { label: 'iPhone', image: '/images/categories/iphone.jpg', span: 'row-span-2' },
    { label: 'Mac', image: '/images/categories/mac.jpg', span: '' },
    { label: 'iPad', image: '/images/categories/ipad.jpg', span: '' },
    { label: 'Apple Watch', image: '/images/categories/apple-watch.jpg', span: '' },
    { label: 'AirPods', image: '/images/categories/airpods.jpg', span: '' },
  ]

  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-2.5 w-full max-w-[300px] mx-auto aspect-[3/2]">
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.label}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 * i, ease: easeOut }}
          className={`relative overflow-hidden rounded-2xl bg-muted ${tile.span}`}
        >
          <img
            src={tile.image}
            alt={tile.label}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <span className="absolute bottom-2 left-2.5 text-white text-[11px] sm:text-xs font-semibold tracking-tight drop-shadow">
            {tile.label}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

export function PartsVisual() {
  return (
    <div className="relative w-full max-w-[300px] mx-auto">
      <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-muted">
        <img
          src="/images/categories/replacement-parts.jpg"
          alt="Genuine-quality replacement parts"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.35, ease: easeOut }}
        className="absolute -bottom-4 -left-3 bg-card border border-border/60 rounded-2xl shadow-lg px-3.5 py-2.5 flex items-center gap-2"
      >
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <ShieldCheck size={14} strokeWidth={2.2} />
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-foreground whitespace-nowrap">Genuine Quality</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.5, ease: easeOut }}
        className="absolute -top-4 -right-3 bg-card border border-border/60 rounded-2xl shadow-lg px-3.5 py-2.5 flex items-center gap-2"
      >
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Wrench size={14} strokeWidth={2.2} />
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-foreground whitespace-nowrap">Displays & Batteries</span>
      </motion.div>
    </div>
  )
}

export function ShoppingVisual() {
  return (
    <div className="w-full max-w-[220px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="relative bg-card border border-border/50 rounded-2xl overflow-hidden shadow-lg"
      >
        <div className="relative aspect-square w-full bg-muted/40 flex items-center justify-center p-6">
          <img
            src="/images/products/iphone/iphone-17-pro-max.jpg"
            alt="iPhone 17 Pro Max"
            className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal"
          />
        </div>
        <div className="p-3.5">
          <h3 className="font-semibold text-foreground text-sm leading-tight mb-1">iPhone 17 Pro Max</h3>
          <span className="text-xs font-medium text-muted-foreground">{formatPrice(359000)}</span>

          <div className="mt-3 h-9 rounded-full bg-muted text-foreground text-xs font-medium flex items-center justify-center gap-1.5">
            <ShoppingBag size={13} strokeWidth={2.2} />
            Add to Cart
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.6, ease: easeOut }}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
        >
          <Check size={15} strokeWidth={3} />
        </motion.div>
      </motion.div>
    </div>
  )
}

export function ReadyVisual() {
  return (
    <div className="relative w-full aspect-square max-w-[260px] mx-auto flex items-center justify-center">
      <div className="absolute w-3/4 h-3/4 bg-primary/15 blur-[70px] rounded-full" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: easeOut }}
        className="relative z-10 bg-white rounded-[28px] px-6 py-4 shadow-xl flex items-center justify-center"
      >
        <img
          src="/logo.jpg"
          alt="Apple Expert"
          className="h-14 sm:h-16 w-auto object-contain"
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="absolute bottom-2 flex items-center gap-1.5 text-muted-foreground"
      >
        <Box size={13} />
        <span className="text-[11px] font-medium tracking-wide uppercase">Ready when you are</span>
      </motion.div>
    </div>
  )
}
