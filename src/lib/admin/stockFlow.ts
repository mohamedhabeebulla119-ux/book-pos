/**
 * Decision rules around stock writes, kept free of runtime imports so
 * `node --test scripts/test-inventory-flow.mjs` exercises them directly.
 *
 * Both rules exist for the same reason: a stock request can succeed in the
 * database while the app sees a failure (a lost response, a failed refresh).
 * The app must then never report a refusal, and never act as if nothing was
 * written.
 */

/** What is known about a stock request whose response did not arrive. */
export type RequestOutcome = 'recorded' | 'not_recorded' | 'uncertain'

/**
 * Asks the ledger whether one exact request id was recorded. A lookup that
 * itself fails is 'uncertain' — never 'not_recorded' — so a caller can never
 * treat an unknown outcome as permission to delete.
 */
export async function resolveRequestOutcome(lookup: () => Promise<boolean>): Promise<RequestOutcome> {
  try {
    return (await lookup()) ? 'recorded' : 'not_recorded'
  } catch {
    return 'uncertain'
  }
}

export interface AppliedAdjustment {
  current_quantity: number
  /** true when the same request id had already been applied and was replayed. */
  replayed: boolean
}

/**
 * The confirmation for an adjustment the database ACCEPTED, followed by the
 * screen refresh. A refresh failure is reported as a refresh problem; the
 * confirmation stands, because the stock change itself was saved.
 */
export async function confirmAdjustment(
  result: AppliedAdjustment,
  refresh: () => Promise<void>,
  describe: (err: unknown) => string,
): Promise<{ notice: string; refreshError: string | null }> {
  const notice = result.replayed
    ? `Stock is ${result.current_quantity}. This change had already been saved.`
    : `Stock updated to ${result.current_quantity}.`
  try {
    await refresh()
    return { notice, refreshError: null }
  } catch (err) {
    return { notice, refreshError: `The stock change was saved, but this screen could not refresh: ${describe(err)}` }
  }
}
