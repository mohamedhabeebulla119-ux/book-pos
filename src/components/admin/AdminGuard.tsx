"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/context/AdminAuthContext'
import { AdminLoading, AccessDenied, AdminError } from './AdminStatus'

/**
 * Gates every /admin route except /admin/login.
 *
 * This component is a USABILITY boundary, not the security boundary. The real
 * enforcement is in PostgreSQL: RLS restricts every table read to what the
 * caller is entitled to, and price/VIP mutations run only through SECURITY
 * DEFINER functions that re-check private.has_role() server-side. A user who
 * strips this guard out of the bundle still reaches an admin panel that returns
 * nothing and refuses every write — verified against the live database, where
 * an anonymous caller receives 42501 on both RPCs and zero wholesale rows.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { status, errorMessage } = useAdminAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === 'signed-out') {
      router.replace('/admin/login')
    }
  }, [status, router])

  if (status === 'loading') return <AdminLoading />
  if (status === 'signed-out') return <AdminLoading label="Redirecting to sign in…" />
  if (status === 'error') return <AdminError message={errorMessage} />
  if (status === 'unauthorized') return <AccessDenied />

  return <>{children}</>
}
