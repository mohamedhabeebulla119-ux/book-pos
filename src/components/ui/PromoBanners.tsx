"use client"

import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'
import { useBanners, useStoreSettings, type BannerSlot, type StorefrontBanner } from '@/lib/store/settings'

/**
 * Promotional banners managed in /admin/settings.
 *
 * Images come from the Supabase Storage `banners` bucket, never the APK. Renders
 * nothing when banners are switched off, none are active, or none are in their
 * scheduled window — RLS decides the last two before rows reach the device.
 */
export function PromoBanners({ slot }: { slot: BannerSlot }) {
  const { settings } = useStoreSettings()
  const banners = useBanners(slot, settings.show_banners)
  if (banners.length === 0) return null

  return (
    <section className="pt-4" aria-label="Promotions">
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scroll-px-4 no-scrollbar">
        {banners.map((banner) => (
          <BannerCard key={banner.id} banner={banner} single={banners.length === 1} />
        ))}
        <div className="w-1 shrink-0" aria-hidden="true" />
      </div>
    </section>
  )
}

/**
 * What a banner looks like — shared by the storefront and the admin preview,
 * so the preview can never drift from what customers see.
 */
export function BannerVisual({
  title, subtitle, ctaLabel, imageUrl,
}: {
  title: string | null
  subtitle: string | null
  ctaLabel: string | null
  imageUrl: string | null
}) {
  return (
    <div className="relative h-40 sm:h-48 overflow-hidden rounded-[26px] bg-gradient-cta shadow-card">
      {imageUrl && (
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {/* Legibility scrim, only needed over a photograph. */}
      {imageUrl && (title || subtitle) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" aria-hidden="true" />
      )}
      <div className="relative flex h-full flex-col justify-end p-5 text-white">
        {title && <h3 className="text-[19px] font-bold leading-tight tracking-tight">{title}</h3>}
        {subtitle && <p className="mt-1 text-[13px] leading-snug text-white/90 line-clamp-2">{subtitle}</p>}
        {ctaLabel && (
          <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-[12.5px] font-semibold text-primary-strong">
            {ctaLabel} <ArrowRight size={13} />
          </span>
        )}
      </div>
    </div>
  )
}

function BannerCard({ banner, single }: { banner: StorefrontBanner; single: boolean }) {
  const body = (
    <BannerVisual
      title={banner.title}
      subtitle={banner.subtitle}
      ctaLabel={banner.cta_href ? banner.cta_label : null}
      imageUrl={banner.imageUrl}
    />
  )

  const width = single ? 'w-full' : 'w-[calc(100%-2.5rem)] max-w-[420px]'
  const className = `block shrink-0 snap-start ${width}`

  if (!banner.cta_href) return <div className={className}>{body}</div>
  // In-app paths route inside the app; the database only accepts '/…' or https.
  return banner.cta_href.startsWith('/')
    ? <Link href={banner.cta_href} className={className}>{body}</Link>
    : <a href={banner.cta_href} target="_blank" rel="noopener noreferrer" className={className}>{body}</a>
}

/** Shown on the storefront homes while the store is marked Closed. */
export function StoreClosedNotice() {
  const { settings } = useStoreSettings()
  if (settings.is_open) return null
  return (
    <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <Clock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-[13px] leading-snug text-foreground">
        <strong className="font-semibold">{settings.store_name} is currently closed.</strong>{' '}
        {settings.opening_hours
          ? <span className="whitespace-pre-line">Opening hours: {settings.opening_hours}</span>
          : 'You can still browse — orders are handled when we reopen.'}
      </p>
    </div>
  )
}
