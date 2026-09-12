"use client"

import { useId, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared chrome for the customer sign-in and sign-up screens.
 *
 * Visually the storefront's own language — the same surface, mint borders and
 * rounded-[26px] card the rest of (shop) uses — rather than the admin sign-in,
 * which deliberately looks like a different building.
 */
export function AuthShell({
  title, subtitle, children, footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-mint/60 bg-white shadow-card">
            {/* The catalog ships its images in the APK; next/image is off for
                static export, so a plain img is the correct element here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Apple Expert" className="h-9 w-auto object-contain" />
          </span>
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-foreground">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {children}

        <div className="mt-5 space-y-3 text-center">
          {footer}
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={15} />
            Back to the store
          </Link>
        </div>
      </div>
    </div>
  )
}

const FIELD =
  'focus-ring w-full h-12 rounded-2xl border border-mint-deep dark:border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45 transition-colors disabled:opacity-60'

export function AuthField({
  label, type = 'text', value, onChange, placeholder, autoComplete, required = true,
  disabled = false, inputMode, hint,
}: {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
  disabled?: boolean
  inputMode?: 'text' | 'tel' | 'email'
  hint?: string
}) {
  const id = useId()
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
        disabled={disabled}
        className={FIELD}
      />
      {hint && <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function PasswordField({
  label, value, onChange, autoComplete, disabled = false, hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  disabled?: boolean
  hint?: string
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          placeholder="••••••••"
          className={cn(FIELD, 'pr-12')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="focus-ring absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
