"use client"

import Link from 'next/link'
import { LoaderCircle, ShieldAlert, AlertCircle, ArrowLeft, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAdminAuth } from '@/context/AdminAuthContext'

/** Centred single-purpose panel used by every pre-authorized admin state. */
function AdminStatusFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  )
}

export function AdminLoading({ label = 'Verifying your access…' }: { label?: string }) {
  return (
    <AdminStatusFrame>
      <div
        className="w-14 h-14 mx-auto rounded-full bg-primary-soft border border-mint-deep flex items-center justify-center text-primary mb-5"
        aria-hidden="true"
      >
        <LoaderCircle size={24} strokeWidth={2} className="animate-spin motion-reduce:animate-none" />
      </div>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{label}</p>
    </AdminStatusFrame>
  )
}

/**
 * Shown to a signed-in user who holds no owner/admin/staff row.
 *
 * Says only that access is not granted — no table names, no role names, no
 * account details, nothing that would help someone probe the schema.
 */
export function AccessDenied() {
  const { email, signOut } = useAdminAuth()

  return (
    <AdminStatusFrame>
      <div
        className="w-16 h-16 mx-auto rounded-full bg-red-500/8 border border-red-500/20 flex items-center justify-center text-red-500 mb-6"
        aria-hidden="true"
      >
        <ShieldAlert size={28} strokeWidth={1.9} />
      </div>

      <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-2">
        Access denied
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
        This account is not authorised to use the Apple Expert admin panel.
      </p>
      {email && (
        <p className="text-xs text-muted-foreground/80 mb-7 truncate">
          Signed in as <span className="font-medium text-foreground">{email}</span>
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <Button variant="secondary" fullWidth onClick={() => void signOut()}>
          <LogOut size={16} className="mr-1.5" />
          Sign out
        </Button>
        <Link href="/">
          <Button variant="ghost" fullWidth>
            <ArrowLeft size={16} className="mr-1.5" />
            Back to the store
          </Button>
        </Link>
      </div>
    </AdminStatusFrame>
  )
}

/** A failed role lookup — never conflated with a permission decision. */
export function AdminError({ message }: { message: string | null }) {
  const { refresh } = useAdminAuth()

  return (
    <AdminStatusFrame>
      <div
        className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6"
        aria-hidden="true"
      >
        <AlertCircle size={28} strokeWidth={1.9} />
      </div>

      <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-2">
        Could not verify access
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-7">
        {message ?? 'Something went wrong while checking your permissions.'}
      </p>

      <Button fullWidth onClick={() => void refresh()}>Try again</Button>
    </AdminStatusFrame>
  )
}
