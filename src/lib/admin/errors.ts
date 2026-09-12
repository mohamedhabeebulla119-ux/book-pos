/**
 * Error reporting for admin screens.
 *
 * This exists because of a real failure. The wholesale review queue was refused
 * by PostgREST with PGRST201 (an ambiguous embed), and the admin UI rendered
 * only `error.message` — so the screen said the query had failed but dropped
 * `code` and, worse, `hint`, which is where PostgREST had written the literal
 * fix. The result looked like "no requests" or a vague failure, and the actual
 * cause was invisible.
 *
 * Admin-only by construction: this module is imported exclusively by pages
 * behind AdminGuard, so the extra detail never reaches a customer. The
 * storefront keeps its short, non-technical messages.
 */

/** The shape PostgREST and supabase-js errors share. Not every field is always set. */
interface SupabaseErrorish {
  message?: unknown
  code?: unknown
  hint?: unknown
  details?: unknown
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * A message an administrator can act on.
 *
 * Ordered the way the library itself recommends reading these: the summary
 * first, then the stable code to search for, then the hint — which for a
 * permission error is usually the exact GRANT to run, and for a bad embed names
 * the relationship to use.
 */
export function describeAdminError(err: unknown, fallback: string): string {
  const source = (err ?? {}) as SupabaseErrorish

  const message = text(source.message) ?? (err instanceof Error ? err.message : null) ?? fallback
  const code = text(source.code)
  const hint = text(source.hint)
  const details = text(source.details)

  const parts = [code ? `${message} (${code})` : message]
  if (hint) parts.push(`Hint: ${hint}`)
  // `details` is frequently a JSON blob on embed errors; the hint already
  // carries the fix, so include details only when there is no hint.
  else if (details) parts.push(`Details: ${details}`)

  return parts.join(' — ')
}

/**
 * Logs the complete error object during development.
 *
 * `console.error(error)` rather than `error.message`: the fields that matter
 * are the ones string interpolation throws away. Stripped from production
 * builds by the `NODE_ENV` check, so nothing is written to a customer's device
 * console in the shipped APK.
 */
export function logAdminError(scope: string, err: unknown): void {
  if (process.env.NODE_ENV === 'production') return
  console.error(`[admin:${scope}]`, err)
}
