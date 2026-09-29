"use client"

import { Header } from '@/components/ui/Header'
import { CategoryCard } from '@/components/ui/CategoryCard'
import { ProductCard } from '@/components/ui/ProductCard'
import { SectionHeading } from '@/components/ui/Heading'
import { useFeaturedProducts } from '@/lib/catalog'
import { Button } from '@/components/ui/Button'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Search, Wrench, Smartphone, ShieldCheck, Zap, Headphones, ShoppingBag, Truck } from 'lucide-react'

const EASE = [0.22, 1, 0.36, 1] as const

const quickCategories = [
  { label: 'iPhone', href: '/categories/iphone' },
  { label: 'iPad', href: '/categories/ipad' },
  { label: 'Mac', href: '/categories/mac' },
  { label: 'Watch', href: '/categories/watch' },
  { label: 'AirPods', href: '/categories/airpods' },
  { label: 'Parts', href: '/categories/parts' },
  { label: 'Accessories', href: '/categories/accessories' },
]

/**
 * The Retail storefront home. Reaching it at all is decided by
 * CustomerRouteGuard (signed in, and resolved as retail by the database); a
 * Wholesale VIP is sent to /wholesale before this renders.
 */
export default function Home() {
  // Curated in Supabase (featured_products), resolved through the canonical
  // catalog so duplicate ids use the authoritative deviceData definitions.
  // Falls back to the bundled selection when Supabase is unavailable.
  const featuredProducts = useFeaturedProducts()

  const categories = [
    { title: 'iPhone', subtitle: 'Pro & Standard', image: '/images/categories/iphone.jpg', href: '/categories/iphone' },
    { title: 'Mac', subtitle: 'Laptops & Desktops', image: '/images/categories/mac.jpg', href: '/categories/mac' },
    { title: 'Replacement Parts', subtitle: 'Displays & Batteries', image: '/images/categories/replacement-parts.jpg', href: '/categories/parts' },
    { title: 'Accessories', subtitle: 'Cases & Chargers', image: '/images/categories/accessories.jpg', href: '/categories/accessories' }
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Hero — the strongest gradient treatment in the app */}
      <section className="relative px-4 pt-5 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative overflow-hidden rounded-[34px] bg-hero-stage shadow-float"
        >
          {/* Dark mode is untouched: this opaque overlay reproduces the original
              drifting single gradient, so the layered light-mode stage underneath
              is only ever visible in light mode. Both overlays are plain
              `absolute` with no z-index — DOM order keeps them behind the orbs
              and the `relative z-10` content below. */}
          <div className="hidden dark:block pointer-events-none absolute inset-0 bg-gradient-hero animate-drift" aria-hidden="true" />
          {/* Light mode: a slow specular band drifting across the atmosphere */}
          <div className="dark:hidden pointer-events-none absolute inset-0 bg-hero-sheen animate-drift" aria-hidden="true" />

          {/* Decorative depth orbs, static */}
          <div className="absolute -top-14 -right-12 w-60 h-60 bg-white/25 rounded-full blur-[70px] pointer-events-none" />
          <div className="absolute bottom-0 -left-10 w-52 h-52 bg-emerald-100/30 rounded-full blur-[60px] pointer-events-none" />

          <div className="relative z-10 px-6 sm:px-10 pt-9 sm:pt-12 text-center">
            <span className="inline-block text-[11px] sm:text-xs font-semibold tracking-[0.22em] text-white/85 uppercase mb-4 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/25">
              Apple Expert
            </span>
            <h1 className="text-[31px] sm:text-6xl font-bold tracking-tight text-white leading-[1.08] mb-3.5">
              Everything Apple.<br />All in one place.
            </h1>
            <p className="text-white/90 text-sm sm:text-xl mb-7 max-w-md mx-auto">
              Premium Apple devices, genuine parts and accessories.
            </p>
            <Link href="/categories" className="inline-block">
              <Button variant="secondary" size="lg" className="px-9 border-white/70 shadow-float">
                Shop Now <ArrowRight size={18} className="ml-1.5" />
              </Button>
            </Link>
          </div>

          <div className="relative z-10 mt-7 sm:mt-9 px-2 flex flex-col items-center">
            {/* One cohesive product scene. Every device is an alpha-cutout PNG, so
                they float directly on the hero gradient with no image box behind
                them. Perpetual float lives on the wrapper and the entrance on the
                image, because a CSS transform animation would otherwise override
                Framer Motion's inline transform on the same element. */}
            <div className="relative w-full max-w-[420px] h-60 sm:h-[320px]">
              {/* Shared atmospheric glow. Plain `absolute` painted first — DOM
                  order, not negative z-index, keeps it behind the devices. */}
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] h-[70%] rounded-full bg-white/25 blur-[52px]"
                aria-hidden="true"
              />

              {/* MacBook — behind / left */}
              <div className="absolute left-0 bottom-[15%] w-32 sm:w-44 z-10">
                <motion.img
                  initial={{ opacity: 0, x: 22, y: 10, rotate: 8 }}
                  animate={{ opacity: 1, x: 0, y: 0, rotate: 5 }}
                  transition={{ duration: 0.8, delay: 0.32, ease: EASE }}
                  src="/images/products/hero/macbook.png"
                  alt=""
                  aria-hidden="true"
                  className="w-full h-auto drop-shadow-[0_16px_20px_rgba(4,26,15,0.36)]"
                />
              </div>

              {/* iPad — behind / right */}
              <div className="absolute right-0 bottom-[19%] w-32 sm:w-40 z-10">
                <motion.img
                  initial={{ opacity: 0, x: -22, y: 10, rotate: -8 }}
                  animate={{ opacity: 1, x: 0, y: 0, rotate: -5 }}
                  transition={{ duration: 0.8, delay: 0.4, ease: EASE }}
                  src="/images/products/hero/ipad.png"
                  alt=""
                  aria-hidden="true"
                  className="w-full h-auto drop-shadow-[0_16px_20px_rgba(4,26,15,0.36)]"
                />
              </div>

              {/* AirPods — front / lower left */}
              <div className="absolute left-[3%] bottom-[2%] w-12 sm:w-16 z-20 animate-float" style={{ animationDelay: '-2s', animationDuration: '7s' }}>
                <motion.img
                  initial={{ opacity: 0, y: 14, scale: 0.86 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.7, delay: 0.52, ease: EASE }}
                  src="/images/products/hero/airpods.png"
                  alt=""
                  aria-hidden="true"
                  className="w-full h-auto drop-shadow-[0_10px_14px_rgba(4,26,15,0.34)]"
                />
              </div>

              {/* Apple Watch — front / lower right */}
              <div className="absolute right-[3%] bottom-[3%] w-14 sm:w-20 z-20 animate-float" style={{ animationDelay: '-3.5s', animationDuration: '6.5s' }}>
                <motion.img
                  initial={{ opacity: 0, y: 14, scale: 0.86 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.7, delay: 0.6, ease: EASE }}
                  src="/images/products/hero/watch.png"
                  alt=""
                  aria-hidden="true"
                  className="w-full h-auto drop-shadow-[0_10px_14px_rgba(4,26,15,0.34)]"
                />
              </div>

              {/* iPhone — the focal product, centred and in front */}
              <div className="absolute inset-x-0 bottom-0 flex justify-center z-30 animate-float">
                <motion.img
                  initial={{ opacity: 0, y: 22, scale: 0.94, rotate: -6 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: -3 }}
                  transition={{ duration: 0.85, delay: 0.15, ease: EASE }}
                  src="/images/products/hero/iphone.png"
                  alt="iPhone 17 Pro Max — premium Apple devices at Apple Expert"
                  className="h-52 sm:h-72 w-auto object-contain drop-shadow-[0_24px_30px_rgba(4,26,15,0.42)]"
                />
              </div>
            </div>
            {/* Curved glossy pedestal beneath the composition */}
            <div className="h-8 w-64 sm:w-[340px] -mt-2 rounded-[100%] bg-pedestal blur-[8px]" aria-hidden="true" />
          </div>
        </motion.div>
      </section>

      {/* Floating search entry — mirrors the search page's field */}
      <section className="px-4 pt-4">
        <Link
          href="/search"
          className="flex items-center gap-3 h-14 px-5 rounded-[22px] bg-surface border border-mint/80 dark:border-border shadow-card hover:shadow-float active:scale-[0.99] transition-all duration-300"
        >
          <Search size={19} className="text-primary shrink-0" strokeWidth={2.2} />
          <span className="text-sm text-muted-foreground font-medium">Search devices, parts, accessories…</span>
        </Link>
      </section>

      {/* Quick category chips — floating mini cards, horizontally scrollable */}
      <section className="pt-4">
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar">
          {quickCategories.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.03 * i, ease: EASE }}
            >
              <Link
                href={c.href}
                className="block whitespace-nowrap px-4 h-10 leading-10 rounded-full bg-surface border border-mint/80 dark:border-border text-[13px] font-semibold text-foreground shadow-card hover:bg-primary-soft hover:text-primary active:scale-95 transition-all duration-300"
              >
                {c.label}
              </Link>
            </motion.div>
          ))}
          <div className="w-1 shrink-0" />
        </div>
      </section>

      {/* Trust indicators */}
      <section className="px-4 pt-3">
        <div className="flex items-center justify-between gap-2 rounded-3xl bg-surface border border-mint/80 dark:border-border px-3 py-3 shadow-card">
          {[
            { icon: ShieldCheck, label: 'Genuine Parts' },
            { icon: Truck, label: 'Island-wide' },
            { icon: ShoppingBag, label: 'Secure Pay' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5 min-w-0">
              <span className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center text-primary shrink-0">
                <Icon size={17} strokeWidth={2.1} />
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground truncate max-w-full">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Shop by Purpose */}
      <section className="px-4 py-11">
        <div className="max-w-4xl mx-auto">
          <SectionHeading title="What are you looking for?" className="sm:text-left" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {[
              { href: '/categories', icon: Smartphone, title: 'Shop', copy: 'Buy the latest premium Apple devices and products.', cta: 'Start Shopping' },
              { href: '/categories/parts', icon: Wrench, title: 'Repair', copy: 'Find genuine-quality replacement parts for your Apple device.', cta: 'Find Parts' },
              { href: '/categories/accessories', icon: Headphones, title: 'Accessorize', copy: 'Find cases, chargers, cables, and premium accessories.', cta: 'View Accessories' },
            ].map(({ href, icon: Icon, title, copy, cta }, i) => (
              <Link key={title} href={href} className="group h-full">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.4, delay: 0.06 * i, ease: EASE }}
                  className="bg-surface border border-mint/80 dark:border-border rounded-[26px] p-5 h-full flex flex-col shadow-card hover:shadow-float transition-shadow duration-400"
                >
                  <div className="w-12 h-12 rounded-2xl bg-well-strong border border-mint-deep flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform duration-400">
                    <Icon size={23} strokeWidth={2} />
                  </div>
                  <h3 className="text-lg font-bold mb-1.5 tracking-tight">{title}</h3>
                  <p className="text-muted-foreground text-sm flex-1 mb-4 leading-snug">{copy}</p>
                  <div className="flex items-center text-sm font-semibold text-primary mt-auto">
                    {cta} <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Explore Categories */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <SectionHeading title="Explore Categories" seeAllHref="/categories" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {categories.map((category) => (
              <CategoryCard key={category.title} {...category} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="pt-12 pb-10">
        <div className="max-w-4xl mx-auto">
          <div className="px-4">
            <SectionHeading title="Featured Products" subtitle="Carefully selected highlights from our store." />
          </div>

          {/* One complete card plus a deliberate peek of the next on phones;
              a full grid of complete cards once there is room for two.
              `overflow-x: auto` forces overflow-y to auto as well, so the
              vertical padding here is what keeps card shadows from clipping. */}
          <div className="flex gap-4 px-4 pt-1 pb-6 overflow-x-auto snap-x snap-mandatory scroll-px-4 no-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible sm:snap-none sm:pb-2">
            {featuredProducts.map(product => (
              <ProductCard key={product.id} product={product} featured />
            ))}
            {/* trailing breathing room at the end of the scroll */}
            <div className="w-1 shrink-0 sm:hidden" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Repair Center */}
      <section className="px-4 py-12">
        <div className="max-w-4xl mx-auto rounded-[32px] overflow-hidden relative bg-gradient-to-br from-[#0f3423] via-[#0b2618] to-[#071a10] shadow-float">
          {/* Abstract background blobs — plain `absolute` with no z-index; DOM order (not
              negative z-index) keeps these behind the content below, since negative z-index
              nested inside an `overflow-hidden` ancestor fails to paint in some Chromium versions */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/25 blur-[80px] rounded-full" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-500/20 blur-[80px] rounded-full" />

          <div className="relative p-7 sm:p-10 md:p-12 flex flex-col md:flex-row items-center gap-7">
            <div className="flex-1 text-center md:text-left">
              <span className="text-emerald-300 font-semibold tracking-[0.18em] uppercase text-[11px] sm:text-xs mb-3 block">Repair Center</span>
              <h2 className="text-[26px] md:text-4xl font-bold tracking-tight text-white mb-3.5 leading-tight">
                Your Apple needs a little attention?
              </h2>
              <p className="text-emerald-50/70 text-sm md:text-lg mb-7 max-w-md mx-auto md:mx-0 leading-relaxed">
                Quality replacement parts for your Apple devices. Displays, batteries, and more to bring your device back to life.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Link href="/categories/replacement-parts/displays" className="w-full sm:w-auto">
                  <Button fullWidth className="sm:w-auto px-8 h-12">
                    Find a Display
                  </Button>
                </Link>
                <Link href="/categories/replacement-parts/batteries" className="w-full sm:w-auto">
                  <Button fullWidth variant="outline" className="sm:w-auto px-8 h-12 text-white border-white/30 hover:bg-white/10">
                    Find a Battery
                  </Button>
                </Link>
              </div>
            </div>

            <div className="w-full md:w-1/2 flex justify-center">
              <img
                src="/images/categories/replacement-parts.jpg"
                alt="Genuine Apple replacement parts and repair tools"
                className="w-44 md:w-64 aspect-square object-cover rounded-[28px] shadow-float"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why Apple Expert */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight mb-8">Why Apple Expert?</h2>

          <div className="grid grid-cols-2 gap-3.5">
            {[
              { icon: ShieldCheck, title: 'Genuine Quality', copy: 'Carefully selected Apple products and reliable parts.' },
              { icon: Zap, title: 'Easy Shopping', copy: 'Find the right product or repair part effortlessly.' },
              { icon: ShoppingBag, title: 'Secure Checkout', copy: 'A simple, safe purchasing experience every time.' },
              { icon: Headphones, title: 'Customer Support', copy: 'Dedicated assistance when you need it most.' },
            ].map(({ icon: Icon, title, copy }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: 0.05 * i, ease: EASE }}
                className="flex flex-col items-center bg-surface border border-mint/80 dark:border-border rounded-[24px] p-4 shadow-card"
              >
                <div className="w-11 h-11 bg-well-strong border border-mint-deep rounded-full flex items-center justify-center text-primary mb-3">
                  <Icon size={21} strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-sm mb-1 tracking-tight">{title}</h3>
                <p className="text-muted-foreground text-[11.5px] leading-snug">{copy}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-14">
        <div className="max-w-xl mx-auto text-center relative overflow-hidden rounded-[32px] bg-gradient-hero shadow-float px-6 py-11">
          <div className="absolute -bottom-16 -left-10 w-56 h-56 bg-white/20 rounded-full blur-[70px] pointer-events-none" />
          <div className="relative">
            <h2 className="text-[26px] md:text-4xl font-bold tracking-tight mb-3 text-white">Ready to find yours?</h2>
            <p className="text-white/85 text-sm md:text-lg mb-7">
              Explore Apple products, parts and accessories in one place.
            </p>
            <Link href="/categories">
              <Button variant="secondary" size="lg" className="px-10 border-white/70 shadow-float">
                Explore Store <ArrowRight size={18} className="ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
