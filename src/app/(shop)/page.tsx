"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/ui/Header'
import { CategoryCard } from '@/components/ui/CategoryCard'
import { ProductCard } from '@/components/ui/ProductCard'
import { SectionHeading } from '@/components/ui/Heading'
import { products } from '@/data/mockData'
import { Button } from '@/components/ui/Button'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Wrench, Smartphone, ShieldCheck, Zap, Headphones, ShoppingBag, Truck } from 'lucide-react'
import { hasCompletedOnboarding } from '@/utils/onboarding'

const EASE = [0.22, 1, 0.36, 1] as const

export default function Home() {
  const router = useRouter()
  const [readyToRender, setReadyToRender] = useState(false)

  useEffect(() => {
    if (hasCompletedOnboarding()) {
      setReadyToRender(true)
    } else {
      router.replace('/onboarding')
    }
  }, [router])

  const featuredProducts = products.filter(p => p.featured)

  const categories = [
    { title: 'iPhone', subtitle: 'Pro & Standard', image: '/images/categories/iphone.jpg', href: '/categories/iphone', color: 'bg-zinc-800' },
    { title: 'Mac', subtitle: 'Laptops & Desktops', image: '/images/categories/mac.jpg', href: '/categories/mac', color: 'bg-neutral-800' },
    { title: 'Replacement Parts', subtitle: 'Displays & Batteries', image: '/images/categories/replacement-parts.jpg', href: '/categories/parts', color: 'bg-blue-900' },
    { title: 'Accessories', subtitle: 'Cases & Chargers', image: '/images/categories/accessories.jpg', href: '/categories/accessories', color: 'bg-indigo-900' }
  ]

  if (!readyToRender) {
    return <div className="min-h-screen bg-background" />
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Premium Hero Section */}
      <section className="relative px-4 pt-6 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-400 dark:from-violet-700 dark:via-indigo-800 dark:to-sky-700 shadow-[0_24px_60px_-16px_rgba(99,60,255,0.45)]"
        >
          {/* Decorative depth orbs, static */}
          <div className="absolute -top-12 -right-10 w-56 h-56 bg-white/20 rounded-full blur-[70px] pointer-events-none" />
          <div className="absolute bottom-0 -left-8 w-48 h-48 bg-cyan-200/30 rounded-full blur-[60px] pointer-events-none" />

          <div className="relative z-10 px-6 sm:px-10 pt-10 sm:pt-14 text-center">
            <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] text-white/80 uppercase mb-4 block">Apple Expert</span>
            <h1 className="text-[32px] sm:text-6xl font-bold tracking-tight text-white leading-[1.08] mb-4">
              Everything Apple.<br />All in one place.
            </h1>
            <p className="text-white/85 text-sm sm:text-xl mb-7 max-w-md mx-auto">
              Premium Apple devices, genuine parts and accessories.
            </p>
            <Link href="/categories" className="inline-block">
              <Button size="lg" className="bg-white text-violet-700 hover:bg-white/90 px-9 rounded-full h-12 text-base font-semibold">
                Shop Now <ArrowRight size={18} className="ml-1.5" />
              </Button>
            </Link>
          </div>

          <div className="relative z-10 mt-6 sm:mt-8 px-6 flex justify-center">
            <img
              src="/images/products/iphone/iphone-17-pro-max.jpg"
              alt="iPhone 17 Pro Max — premium Apple devices at Apple Expert"
              className="w-52 sm:w-72 h-auto object-contain drop-shadow-2xl"
            />
          </div>
        </motion.div>

        {/* Trust indicators */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium">
            <ShieldCheck size={15} className="text-primary" /> Genuine Parts
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium">
            <Truck size={15} className="text-primary" /> Island-wide Service
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium">
            <ShoppingBag size={15} className="text-primary" /> Secure Checkout
          </span>
        </div>
      </section>

      {/* Shop by Purpose */}
      <section className="px-4 py-12 bg-muted/10">
        <div className="max-w-4xl mx-auto">
          <SectionHeading title="What are you looking for?" className="sm:text-left" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/categories" className="group h-full">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="bg-gradient-to-br from-violet-50 to-transparent dark:from-violet-500/10 border border-border/50 rounded-2xl p-6 h-full flex flex-col shadow-card hover:shadow-lg transition-shadow hover:border-primary/30"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <Smartphone size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Shop</h3>
                <p className="text-muted-foreground text-sm flex-1 mb-4">
                  Buy the latest premium Apple devices and products.
                </p>
                <div className="flex items-center text-sm font-semibold text-primary mt-auto">
                  Start Shopping <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            </Link>

            <Link href="/categories/parts" className="group h-full">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.4, delay: 0.06, ease: EASE }}
                className="bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-500/10 border border-border/50 rounded-2xl p-6 h-full flex flex-col shadow-card hover:shadow-lg transition-shadow hover:border-blue-500/30"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                  <Wrench size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Repair</h3>
                <p className="text-muted-foreground text-sm flex-1 mb-4">
                  Find genuine-quality replacement parts for your Apple device.
                </p>
                <div className="flex items-center text-sm font-semibold text-blue-500 mt-auto">
                  Find Parts <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            </Link>

            <Link href="/categories/accessories" className="group h-full">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.4, delay: 0.12, ease: EASE }}
                className="bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-500/10 border border-border/50 rounded-2xl p-6 h-full flex flex-col shadow-card hover:shadow-lg transition-shadow hover:border-indigo-500/30"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-4 group-hover:scale-110 transition-transform">
                  <Headphones size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Accessorize</h3>
                <p className="text-muted-foreground text-sm flex-1 mb-4">
                  Find cases, chargers, cables, and premium accessories.
                </p>
                <div className="flex items-center text-sm font-semibold text-indigo-500 mt-auto">
                  View Accessories <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            </Link>
          </div>
        </div>
      </section>

      {/* Explore Categories */}
      <section className="px-4 py-16">
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
      <section className="py-16 bg-muted/20">
        <div className="max-w-4xl mx-auto">
          <div className="px-4">
            <SectionHeading title="Featured Products" subtitle="Carefully selected highlights from our store." />
          </div>

          <div className="flex overflow-x-auto gap-4 px-4 pb-6 snap-x snap-mandatory no-scrollbar">
            {featuredProducts.map(product => (
              <ProductCard key={product.id} product={product} featured />
            ))}
            {/* spacer for scrolling padding */}
            <div className="w-2 shrink-0 snap-center"></div>
          </div>
        </div>
      </section>

      {/* Repair Center */}
      <section className="px-4 py-16 md:py-24 border-t border-border/50">
        <div className="max-w-4xl mx-auto bg-zinc-950 dark:bg-zinc-900 rounded-3xl overflow-hidden relative">
          {/* Abstract background blobs — plain `absolute` with no z-index; DOM order (not
              negative z-index) keeps these behind the content below, since negative z-index
              nested inside an `overflow-hidden` ancestor fails to paint in some Chromium versions */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[80px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/20 blur-[80px] rounded-full mix-blend-screen" />

          <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <span className="text-blue-400 font-semibold tracking-wide uppercase text-xs sm:text-sm mb-3 block">Repair Center</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
                Your Apple needs a little attention?
              </h2>
              <p className="text-zinc-400 text-lg mb-8 max-w-md mx-auto md:mx-0">
                Quality replacement parts for your Apple devices. Displays, batteries, and more to bring your device back to life.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Link href="/categories/replacement-parts/displays" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto px-8 rounded-full h-12 text-black bg-white hover:bg-zinc-200">
                    Find a Display
                  </Button>
                </Link>
                <Link href="/categories/replacement-parts/batteries" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto px-8 rounded-full h-12 text-white border-zinc-700 hover:bg-zinc-800">
                    Find a Battery
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="w-full md:w-1/2 flex justify-center">
              <img
                src="/images/categories/replacement-parts.jpg"
                alt="Genuine Apple replacement parts and repair tools"
                className="w-48 md:w-64 aspect-square object-cover rounded-3xl drop-shadow-2xl opacity-90"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why Apple Expert */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight mb-12">Why Apple Expert?</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-12">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-violet-100 dark:bg-violet-500/15 rounded-full flex items-center justify-center text-violet-600 dark:text-violet-300 mb-4">
                <ShieldCheck size={24} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Genuine Quality</h3>
              <p className="text-muted-foreground text-sm max-w-[250px]">
                Carefully selected Apple products and reliable replacement parts.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/15 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-300 mb-4">
                <Zap size={24} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Easy Shopping</h3>
              <p className="text-muted-foreground text-sm max-w-[250px]">
                Find the exactly right product or repair part quickly and effortlessly.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/15 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-300 mb-4">
                <ShoppingBag size={24} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Secure Checkout</h3>
              <p className="text-muted-foreground text-sm max-w-[250px]">
                A simple, safe, and secure purchasing experience every time.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-500/15 rounded-full flex items-center justify-center text-sky-600 dark:text-sky-300 mb-4">
                <Headphones size={24} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Customer Support</h3>
              <p className="text-muted-foreground text-sm max-w-[250px]">
                Dedicated assistance to help when you need it most.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-20 bg-gradient-to-b from-violet-50/60 to-transparent dark:from-violet-500/10 text-center border-t border-border/50">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Ready to find yours?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Explore Apple products, parts and accessories in one place.
          </p>
          <Link href="/categories">
            <Button size="lg" className="bg-gradient-cta text-white border-0 px-10 rounded-full h-14 text-base font-medium">Explore Store</Button>
          </Link>
        </div>
      </section>

    </div>
  )
}
