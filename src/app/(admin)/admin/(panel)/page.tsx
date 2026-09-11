"use client"

import { Package, ShoppingCart, TrendingUp, Crown, ShieldCheck } from 'lucide-react'
import { AdminPageHeading, StatCard } from '@/components/admin/AdminPage'
import { useAdminAuth } from '@/context/AdminAuthContext'
import { ROLE_LABEL } from '@/lib/admin/roles'

export default function AdminDashboardPage() {
  const { email, role } = useAdminAuth()

  return (
    <>
      <AdminPageHeading
        title="Dashboard"
        subtitle={
          email
            ? `Signed in as ${email}${role ? ` · ${ROLE_LABEL[role]}` : ''}.`
            : 'Apple Expert administration.'
        }
      />

      {/* Placeholders only. These are not wired to the database yet, and no
          figure here is invented — each tile shows an em-dash until the real
          query lands in a later step. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 mb-6">
        <StatCard label="Products"      value="—" note="Not connected yet" icon={Package} />
        <StatCard label="Orders"        value="—" note="Not connected yet" icon={ShoppingCart} />
        <StatCard label="Revenue"       value="—" note="Not connected yet" icon={TrendingUp} />
        <StatCard label="VIP Customers" value="—" note="Not connected yet" icon={Crown} />
      </div>

      <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card p-6">
        <div className="flex items-start gap-3.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft border border-mint-deep text-primary"
            aria-hidden="true"
          >
            <ShieldCheck size={19} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-foreground mb-1.5">
              How access is enforced
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Your role was read from the database, not from this browser. Every
              table is protected by row-level security, and price and VIP changes
              run through functions that re-check your role inside PostgreSQL.
              Reaching this page without an authorised account grants nothing.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
