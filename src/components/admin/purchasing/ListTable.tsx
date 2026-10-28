"use client"

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, LoaderCircle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The list-page frame used by every Purchase & Returns screen: title with a
 * breadcrumb, a search box and the primary "New …" action on the right, then
 * a table with rows-per-page paging underneath.
 */
export function ListHeader({ title, crumb, search, onSearch, searchPlaceholder, action }: {
  title: string
  crumb: string
  search: string
  onSearch: (v: string) => void
  searchPlaceholder: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight leading-tight text-foreground">{title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          <span className="text-primary font-medium">{title}</span> <span aria-hidden="true">/</span> {crumb}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5 lg:w-auto">
        <div className="relative sm:w-72">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground">
            <Search size={15} />
          </span>
          <input type="search" value={search} onChange={(e) => onSearch(e.target.value)} aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            className="focus-ring h-11 w-full rounded-xl border border-mint-deep dark:border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/45" />
        </div>
        {action}
      </div>
    </div>
  )
}

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  className?: string
  render: (row: T) => React.ReactNode
}

const PAGE_SIZES = [10, 25, 50, 100]

export function ListTable<T>({ columns, rows, rowKey, loading, error, empty, onRowClick }: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  error?: string | null
  empty: string
  onRowClick?: (row: T) => void
}) {
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(0)

  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages - 1)
  const visible = useMemo(() => rows.slice(current * pageSize, current * pageSize + pageSize), [rows, current, pageSize])
  const from = rows.length === 0 ? 0 : current * pageSize + 1
  const to = Math.min(rows.length, (current + 1) * pageSize)

  return (
    <div className="bg-surface border border-mint/80 dark:border-border rounded-[22px] shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mint/70 dark:border-border bg-muted/60">
              {columns.map((c) => (
                <th key={c.key} scope="col"
                  className={cn('px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap',
                    c.align === 'right' ? 'text-right' : 'text-left')}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={columns.length} className="px-4 py-14 text-center text-muted-foreground">
                <span className="inline-flex items-center gap-2"><LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" /> Loading…</span>
              </td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-red-600 dark:text-red-400">{error}</td></tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-14 text-center text-muted-foreground">{empty}</td></tr>
            )}
            {!loading && !error && visible.map((row) => (
              <tr key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('border-b border-mint/50 dark:border-border/70 last:border-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-primary-soft/40')}>
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3.5 align-middle', c.align === 'right' && 'text-right', c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 border-t border-mint/70 dark:border-border px-4 py-3 text-[12.5px] text-muted-foreground">
        <label className="flex items-center gap-2">
          Rows per page
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
            className="focus-ring h-8 rounded-lg border border-mint-deep dark:border-border bg-card px-2 text-[12.5px] text-foreground">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="tabular-nums">{from}–{to} of {rows.length}</span>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full hover:bg-primary-soft disabled:opacity-35 disabled:hover:bg-transparent">
            <ChevronLeft size={16} />
          </button>
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-[12.5px] font-semibold text-white tabular-nums">
            {current + 1}
          </span>
          <button type="button" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full hover:bg-primary-soft disabled:opacity-35 disabled:hover:bg-transparent">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Small round icon buttons in the Actions column (view, edit, …). */
export function RowAction({ label, onClick, children, tone = 'default' }: {
  label: string
  onClick: () => void
  children: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <button type="button" aria-label={label} title={label}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cn('focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors',
        tone === 'danger' ? 'hover:bg-red-500/10 hover:text-red-500' : 'hover:bg-primary-soft hover:text-primary')}>
      {children}
    </button>
  )
}

export function StatusPill({ label, tone }: { label: string; tone: 'green' | 'amber' | 'grey' | 'red' | 'blue' }) {
  const cls = {
    green: 'bg-primary-soft text-primary border-mint-deep',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    grey: 'bg-muted text-muted-foreground border-border',
    red: 'bg-red-500/8 text-red-600 dark:text-red-400 border-red-500/25',
    blue: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  }[tone]
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap', cls)}>{label}</span>
}
