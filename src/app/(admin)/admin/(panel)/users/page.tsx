"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Search, X, LoaderCircle, AlertCircle, Check, UsersRound, User, Crown,
  ShieldCheck, Sparkles, Mail, Phone, ShieldQuestion,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/utils/formatPrice'
import { centsToRupees } from '@/lib/admin/pricing'
import { AdminPageHeading, StatCard } from '@/components/admin/AdminPage'
import { UserDetail } from '@/components/admin/users/UserDetail'
import { CustomerTypeBadge, RoleBadge } from '@/components/admin/users/badges'
import { useAdminAuth } from '@/context/AdminAuthContext'
import { listCustomers, matchesCustomerQuery, vipStatus } from '@/lib/admin/customers'
import {
  composeUsers, displayRole, listRoleGrants, loadOrderStats, matchesUserFilter,
  summarise, NEW_USER_WINDOW_DAYS, ORDER_SCAN_LIMIT, USER_FILTERS,
  type AdminUser, type UserFilter,
} from '@/lib/admin/users'

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }

interface Snapshot {
  users: AdminUser[]
  ownerCount: number
  /** False when RLS returned only the caller's own grant — see rolesVisible below. */
  rolesVisible: boolean
  ordersTruncated: boolean
}

const EMPTY: Snapshot = { users: [], ownerCount: 0, rolesVisible: false, ordersTruncated: false }

function joinedOn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminUsersPage() {
  const { role, userId } = useAdminAuth()

  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<UserFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Keeps typing responsive without a timer, and without a request per
  // keystroke: filtering runs over the three queries already in memory, so the
  // search box issues no database traffic at all.
  const deferredQuery = useDeferredValue(query)

  /**
   * Three requests for the whole page, regardless of how many users exist:
   * profiles, role grants, and one bounded scan of orders that is aggregated in
   * memory. Nothing here fans out per row.
   */
  const fetchAll = useCallback(async (): Promise<Snapshot> => {
    const [customers, grants, stats] = await Promise.all([
      listCustomers(),
      listRoleGrants(),
      loadOrderStats(),
    ])

    // An owner reads every grant through "user_roles owner all". Anyone else
    // depends on the "user_roles staff read" policy; if it is absent they see
    // only their own row, and the table must say "not visible" rather than
    // report a colleague as a plain customer. Seeing any grant that is not the
    // caller's own proves the read reached the whole table.
    const rolesVisible =
      role === 'owner' || grants.some((grant) => grant.profile_id !== userId)

    return {
      users: composeUsers(customers, grants, stats.byProfile),
      ownerCount: grants.filter((grant) => grant.role === 'owner').length,
      rolesVisible,
      ordersTruncated: stats.truncated,
    }
  }, [role, userId])

  const applyError = useCallback((err: unknown) => {
    setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Could not load users.' })
  }, [])

  const refresh = useCallback(() => {
    fetchAll()
      .then((next) => { setSnapshot(next); setLoad({ kind: 'ready' }) })
      .catch(applyError)
  }, [fetchAll, applyError])

  // State is written only from the promise callbacks, never synchronously here.
  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then((next) => { if (!cancelled) { setSnapshot(next); setLoad({ kind: 'ready' }) } })
      .catch((err) => { if (!cancelled) applyError(err) })
    return () => { cancelled = true }
  }, [fetchAll, applyError])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(id)
  }, [toast])

  const { users, ownerCount, rolesVisible, ordersTruncated } = snapshot

  const filtered = useMemo(
    () => users.filter((user) => matchesUserFilter(user, filter) && matchesCustomerQuery(user, deferredQuery)),
    [users, filter, deferredQuery],
  )

  const summary = useMemo(() => summarise(users), [users])
  const openUser = openId ? users.find((user) => user.id === openId) ?? null : null

  const selectClass =
    'focus-ring h-11 rounded-xl border border-mint-deep dark:border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:border-primary/45'

  return (
    <>
      <AdminPageHeading
        title="Users"
        subtitle={
          load.kind === 'ready'
            ? `${users.length} account${users.length === 1 ? '' : 's'} · customer records, pricing tiers and administrator roles.`
            : 'Customer accounts and administrator roles.'
        }
      />

      {/* Every figure below is counted from the rows just loaded — none is hardcoded. */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 mb-6">
        <StatCard
          label="Total users" icon={UsersRound}
          value={load.kind === 'ready' ? String(summary.total) : '—'}
          note={load.kind === 'ready' ? 'Profiles in the database' : 'Loading…'}
        />
        <StatCard
          label="Retail" icon={User}
          value={load.kind === 'ready' ? String(summary.retail) : '—'}
          note="Customers on Retail pricing"
        />
        <StatCard
          label="Wholesale VIP" icon={Crown}
          value={load.kind === 'ready' ? String(summary.vip) : '—'}
          note="Active VIP grants only"
        />
        <StatCard
          label="Administrators" icon={ShieldCheck}
          value={load.kind === 'ready' && rolesVisible ? String(summary.administrators) : '—'}
          note={rolesVisible ? 'Owner, admin and staff' : 'Visible to an owner'}
        />
        <StatCard
          label="New users" icon={Sparkles}
          value={load.kind === 'ready' ? String(summary.newUsers) : '—'}
          note={`Joined in the last ${NEW_USER_WINDOW_DAYS} days`}
        />
      </div>

      {load.kind === 'ready' && !rolesVisible && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-mint/70 dark:border-border bg-muted px-4 py-3">
          <ShieldQuestion size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Row-level security returned no role grants other than your own, so the Role column is
            left blank rather than showing colleagues as customers. Only an owner can grant or
            revoke administrator access.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted-foreground">
            <Search size={16} />
          </span>
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or phone…" aria-label="Search users"
            className="focus-ring h-11 w-full rounded-xl border border-mint-deep dark:border-border bg-card pl-11 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45 transition-colors"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
              className="focus-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          )}
        </div>

        <select aria-label="Filter users" value={filter}
          onChange={(e) => setFilter(e.target.value as UserFilter)} className={selectClass}>
          {USER_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {load.kind === 'loading' && (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted-foreground">
          <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" /> Loading users…
        </div>
      )}

      {load.kind === 'error' && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/8 border border-red-500/20 text-red-500">
            <AlertCircle size={24} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">Could not load users</h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">{load.message}</p>
          <Button onClick={() => { setLoad({ kind: 'loading' }); refresh() }}>Try again</Button>
        </div>
      )}

      {load.kind === 'ready' && filtered.length === 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card px-6 py-14 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-well-strong border border-mint-deep text-primary">
            <UsersRound size={24} strokeWidth={1.8} />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">
            {users.length === 0 ? 'No accounts yet' : 'No users match'}
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {users.length === 0
              ? 'Accounts appear here as soon as people sign up in the store. Nothing is seeded — this list is exactly what the database holds.'
              : 'Try a different search term or change the filter.'}
          </p>
        </div>
      )}

      {load.kind === 'ready' && filtered.length > 0 && (
        <div className="bg-surface border border-mint/80 dark:border-border rounded-[26px] shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mint/70 dark:border-border bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-left">User</th>
                  <th scope="col" className="px-4 py-3 text-left hidden md:table-cell">Email</th>
                  <th scope="col" className="px-4 py-3 text-left hidden xl:table-cell">Phone</th>
                  <th scope="col" className="px-4 py-3 text-left whitespace-nowrap">Customer type</th>
                  <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">Orders</th>
                  <th scope="col" className="px-4 py-3 text-left whitespace-nowrap hidden lg:table-cell">Joined</th>
                  <th scope="col" className="px-4 py-3 text-left whitespace-nowrap">Role</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}
                    className="border-b border-mint/50 dark:border-border/70 last:border-0 hover:bg-primary-soft/40 transition-colors">
                    <td className="px-4 py-3 min-w-[190px]">
                      <button type="button" onClick={() => setOpenId(user.id)}
                        className="focus-ring rounded-lg text-left max-w-full">
                        <span className="block font-semibold text-foreground leading-tight truncate">
                          {user.full_name || <span className="font-normal text-muted-foreground">No name</span>}
                        </span>
                        {/* Email and phone have their own columns on wide screens; below
                            that they collapse under the name so nothing is lost. */}
                        <span className="md:hidden mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {user.email
                            ? <><Mail size={11} className="shrink-0" /><span className="truncate">{user.email}</span></>
                            : user.phone
                              ? <><Phone size={11} className="shrink-0" />{user.phone}</>
                              : <span>No contact details</span>}
                        </span>
                        <span className="lg:hidden mt-0.5 block text-[11px] text-muted-foreground">
                          Joined {joinedOn(user.created_at)}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 min-w-[200px] hidden md:table-cell">
                      {user.email
                        ? <span className="block truncate text-[13px] text-foreground">{user.email}</span>
                        : <span className="text-[12px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden xl:table-cell">
                      {user.phone
                        ? <span className="text-[13px] text-foreground">{user.phone}</span>
                        : <span className="text-[12px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <CustomerTypeBadge status={vipStatus(user)} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="block tabular-nums text-foreground">{user.stats.orderCount}</span>
                      {user.stats.orderCount > 0 && (
                        <span className="block text-[11px] tabular-nums text-muted-foreground">
                          {formatPrice(centsToRupees(user.stats.spentCents))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell text-[13px] text-muted-foreground">
                      {joinedOn(user.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RoleBadge role={displayRole(user)} known={rolesVisible || user.id === userId} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="secondary" onClick={() => setOpenId(user.id)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openUser && (
        <UserDetail
          key={openUser.id}
          user={openUser}
          viewerRole={role}
          viewerId={userId}
          ownerCount={ownerCount}
          rolesVisible={rolesVisible}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
          onToast={setToast}
        />
      )}

      {toast && (
        <div role="status" aria-live="polite"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 flex max-w-[92vw] items-center gap-2 rounded-full border border-mint-deep bg-surface px-4 py-2.5 shadow-float">
          <Check size={15} className="shrink-0 text-primary" />
          <span className="truncate text-[13px] font-medium text-foreground">{toast}</span>
        </div>
      )}

      {load.kind === 'ready' && (
        <p className="mt-4 flex items-start gap-2 text-[12px] text-muted-foreground">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          <span>
            Pricing tiers are changed only through the audited database function, and role grants
            only by an owner — both re-checked inside PostgreSQL.
            {ordersTruncated && ` Order counts cover the ${ORDER_SCAN_LIMIT.toLocaleString('en-US')} most recent orders.`}
          </span>
        </p>
      )}
    </>
  )
}
