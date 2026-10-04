#!/usr/bin/env node
/**
 * Apple Expert — Wholesale Portal route-guard tests.
 *
 *   node --test scripts/test-wholesale-access.mjs
 *
 * Exercises decideAccess(), the single decision CustomerRouteGuard renders by.
 * Its only customer input is the account's tier as the database resolves it
 * (profiles.customer_type via resolveCustomerType), so every application state
 * short of "approved" is the `retail` tier here; the database side of the same
 * rule is covered by supabase/tests/verify_wholesale_applications.sql.
 *
 * Node runs the TypeScript module directly (built-in type stripping, Node 23.6+);
 * access.ts has only type imports, so nothing else needs compiling.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideAccess, routeZone, WHOLESALE_REQUEST_PATH } from '../src/lib/customer/access.ts'

const SIGNED_UP = { onboarded: true, experienceChosen: true }

test('a non-approved (retail) account never renders the Wholesale Portal', () => {
  for (const path of ['/wholesale', '/wholesale/', '/wholesale.html', '/wholesale/anything']) {
    assert.deepEqual(decideAccess('retail', path, SIGNED_UP), { kind: 'redirect', to: WHOLESALE_REQUEST_PATH }, path)
  }
})

test('an approved (wholesale_vip) account renders the Wholesale Portal', () => {
  assert.deepEqual(decideAccess('wholesale_vip', '/wholesale', SIGNED_UP), { kind: 'render' })
})

test('signed-out, loading and errored sessions never render the portal', () => {
  assert.equal(decideAccess('unauthenticated', '/wholesale', SIGNED_UP).kind, 'redirect')
  assert.equal(decideAccess('loading', '/wholesale', SIGNED_UP).kind, 'wait')
  assert.equal(decideAccess('error', '/wholesale', SIGNED_UP).kind, 'error')
})

test('local onboarding/experience flags cannot open the portal', () => {
  // The "Wholesale" onboarding card is a UX choice only.
  for (const entry of [SIGNED_UP, { onboarded: false, experienceChosen: false }]) {
    assert.notEqual(decideAccess('retail', '/wholesale', entry).kind, 'render')
  }
})

test('the application status page is open to both tiers', () => {
  assert.equal(routeZone(WHOLESALE_REQUEST_PATH), 'shared')
  assert.deepEqual(decideAccess('retail', WHOLESALE_REQUEST_PATH, SIGNED_UP), { kind: 'render' })
  assert.deepEqual(decideAccess('wholesale_vip', WHOLESALE_REQUEST_PATH, SIGNED_UP), { kind: 'render' })
})

test('a closed wholesale store still closes the portal for approved accounts', () => {
  const closed = { loaded: true, maintenance: false, retailEnabled: true, wholesaleEnabled: false }
  assert.deepEqual(decideAccess('wholesale_vip', '/wholesale', SIGNED_UP, closed), { kind: 'unavailable', reason: 'wholesale-closed' })
})

test('existing separation rules are unchanged', () => {
  assert.deepEqual(decideAccess('wholesale_vip', '/', SIGNED_UP), { kind: 'redirect', to: '/wholesale' })
  assert.deepEqual(decideAccess('retail', '/', SIGNED_UP), { kind: 'render' })
  assert.deepEqual(decideAccess('retail', '/cart', SIGNED_UP), { kind: 'render' })
})
