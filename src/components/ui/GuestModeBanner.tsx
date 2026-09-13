"use client"

import { useRouter } from 'next/navigation'
import { FlaskConical, X } from 'lucide-react'
import { useGuestMode, endGuestSession } from '@/lib/auth/guestMode'

/**
 * The permanent "this is not a real account" bar.
 *
 * Guest Test Mode exists so the team can walk the retail and wholesale screens
 * before the SMS provider is bought. The one thing that must never happen is
 * someone mistaking a guest for a verified customer — so the banner is loud,
 * unstyled like the rest of the storefront, present on every screen, and says
 * plainly that no account is signed in.
 *
 * It renders nothing at all when the build has guest mode switched off, because
 * `useGuestMode()` can only ever return null in that build.
 */
export function GuestModeBanner() {
  const router = useRouter()
  const guest = useGuestMode()

  if (!guest) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center gap-2.5 border-b border-amber-500/40 bg-amber-400/95 px-4 py-2 text-amber-950 shadow-card dark:bg-amber-500/90 dark:text-amber-950"
    >
      <FlaskConical size={15} strokeWidth={2.2} className="shrink-0" />
      <p className="min-w-0 flex-1 text-[11.5px] font-bold uppercase leading-tight tracking-[0.08em]">
        Test mode — guest account
        <span className="block text-[10.5px] font-semibold normal-case tracking-normal opacity-80">
          {guest === 'wholesale' ? 'Wholesale demo' : 'Retail demo'} · not signed in · no wholesale pricing
        </span>
      </p>
      <button
        type="button"
        onClick={() => { endGuestSession(); router.push('/welcome') }}
        className="focus-ring flex shrink-0 items-center gap-1 rounded-full border border-amber-900/25 bg-amber-950/10 px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-amber-950/20"
      >
        <X size={12} strokeWidth={2.6} />
        Exit
      </button>
    </div>
  )
}
