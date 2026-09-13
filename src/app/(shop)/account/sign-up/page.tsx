"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'

/**
 * There is no separate registration screen any more.
 *
 * With phone + SMS OTP, "sign in" and "sign up" are the same act: a number is
 * either known to Apple Expert or it is not, and verifying the code either
 * signs the customer in or creates their account. Asking people to pick the
 * right door first only creates a way to pick the wrong one.
 *
 * The route is kept so that links, bookmarks and any installed APK pointing at
 * /account/sign-up still land somewhere useful instead of on a 404.
 */
export default function CustomerSignUpRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/account/sign-in')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center gap-2.5 px-5 text-sm text-muted-foreground">
      <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
      Taking you to sign in…
    </div>
  )
}
