"use client"

import { use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartContext'
import { iphoneModels } from '@/data/iphoneModels'

export default function BatteryDetailPage({ params }: { params: Promise<{ model: string }> }) {
  const resolvedParams = use(params)
  const productId = resolvedParams.model
  
  const product = iphoneModels.find(p => p.id === productId)
  const { addToCart } = useCart()
  
  if (!product) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <p className="text-muted-foreground mb-6">The battery kit you are looking for does not exist.</p>
          <Link href="/categories/replacement-parts/batteries">
            <Button>Back to Catalogue</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Convert to global Cart Product type
  const cartProduct = {
    id: `${product.id}-battery`,
    name: `${product.model} Battery Kit`,
    price: product.battery.price,
    category: 'Replacement Parts',
    images: [product.image], // Ideally a battery image, but we fallback to device image
    compatibility: product.compatibility
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="w-full">
        <div className="px-5 sm:px-6 py-4 sm:py-6">
          <Link href="/categories/replacement-parts/batteries" className="text-sm text-primary mb-6 inline-block font-medium">
            ← Back to Batteries
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
            
            {/* Image Section */}
            <div className="w-full md:w-1/2">
              <div className="relative w-full aspect-[0.9/1] bg-[#f8f8f8] dark:bg-[#1a1a1a] rounded-3xl p-6 sm:p-10 flex items-center justify-center">
                <Image 
                  src={product.image}
                  alt={`${product.model} Battery Replacement`}
                  fill
                  className="object-contain p-8 mix-blend-multiply dark:mix-blend-normal"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </div>
            </div>
            
            {/* Details Section */}
            <div className="w-full md:w-1/2 flex flex-col">
              <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight leading-tight mb-2">
                {product.model} Battery Replacement
              </h1>
              <p className="text-xl sm:text-2xl font-semibold mb-8">
                ${product.battery.price}
              </p>
              
              <div className="space-y-6 mb-10">
                <div className="grid grid-cols-2 gap-y-4 gap-x-4 border-t border-border pt-6">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Capacity</p>
                    <p className="text-sm font-semibold">{product.battery.capacity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Type</p>
                    <p className="text-sm font-semibold">{product.battery.type}</p>
                  </div>
                </div>
                
                <div className="border-t border-border pt-6">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Compatibility</p>
                  <div className="flex flex-wrap gap-2">
                    {product.compatibility.map(device => (
                      <span key={device} className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-semibold rounded-full">
                        {device}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="border-t border-border pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">What's Included</p>
                      <ul className="text-sm font-semibold list-disc list-inside">
                        <li>Genuine Battery</li>
                        <li>Adhesive Strips</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Quality</p>
                      <p className="text-sm font-semibold">Genuine Apple Part</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-auto border-t border-border pt-8 pb-4">
                <Button 
                  size="lg" 
                  fullWidth 
                  onClick={() => addToCart(cartProduct)}
                  className="h-14 text-base font-bold rounded-xl"
                >
                  Add to Cart — ${product.battery.price}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-4">
                  Free shipping on all battery replacements.
                </p>
              </div>
              
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
