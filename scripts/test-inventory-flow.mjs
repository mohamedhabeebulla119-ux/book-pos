#!/usr/bin/env node
/**
 * Apple Expert — stock write outcome rules (P1 review fixes M2 / M3).
 *
 *   node --test scripts/test-inventory-flow.mjs
 *
 * Exercises src/lib/admin/stockFlow.ts, which decides:
 *   - what a stock request whose response was lost means (M2): recorded,
 *     not recorded, or uncertain — and that a failed lookup is never
 *     "not recorded";
 *   - what the admin is told after the database ACCEPTED an adjustment (M3):
 *     a confirmation, and a refresh failure reported as a refresh problem,
 *     never as a refusal.
 *
 * Node runs the TypeScript module directly (built-in type stripping, Node
 * 23.6+); stockFlow.ts has no runtime imports. The database side (lost
 * responses against real rows, replays, refusals) is covered by the local
 * end-to-end run and supabase/tests/verify_inventory_*.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRequestOutcome, confirmAdjustment } from '../src/lib/admin/stockFlow.ts'

test('M2: a request found in the ledger is "recorded" (applied, only the answer was lost)', async () => {
  assert.equal(await resolveRequestOutcome(async () => true), 'recorded')
})

test('M2: a request absent from the ledger is "not_recorded" (failed before being applied)', async () => {
  assert.equal(await resolveRequestOutcome(async () => false), 'not_recorded')
})

test('M2: a lookup that fails is "uncertain", never "not_recorded"', async () => {
  assert.equal(await resolveRequestOutcome(async () => { throw new Error('Failed to fetch') }), 'uncertain')
  assert.equal(await resolveRequestOutcome(() => Promise.reject({ code: '42501', message: 'permission denied' })), 'uncertain')
})

const noDescribe = (err) => (err instanceof Error ? err.message : String(err))

test('M3: accepted adjustment + successful refresh -> confirmation, no error', async () => {
  let refreshed = 0
  const out = await confirmAdjustment({ current_quantity: 8, replayed: false }, async () => { refreshed++ }, noDescribe)
  assert.deepEqual(out, { notice: 'Stock updated to 8.', refreshError: null })
  assert.equal(refreshed, 1)
})

test('M3: accepted adjustment + failed refresh -> confirmation stands, refresh problem reported, never a refusal', async () => {
  const out = await confirmAdjustment({ current_quantity: 8, replayed: false }, async () => { throw new Error('network down') }, noDescribe)
  assert.equal(out.notice, 'Stock updated to 8.')
  assert.match(out.refreshError, /^The stock change was saved, but this screen could not refresh: network down$/)
  assert.doesNotMatch(out.refreshError, /refused|rejected|failed to save/i)
})

test('M3: a replayed request (double submission, same request id) is confirmed as already saved', async () => {
  const out = await confirmAdjustment({ current_quantity: 9, replayed: true }, async () => {}, noDescribe)
  assert.equal(out.notice, 'Stock is 9. This change had already been saved.')
  assert.equal(out.refreshError, null)
})
