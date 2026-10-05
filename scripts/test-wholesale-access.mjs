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
import { decideAccess, decideExperienceSwitch, routeZone, WHOLESALE_REQUEST_PATH } from '../src/lib/customer/access.ts'
import { displayPrice, displayPriceIsVip } from '../src/lib/catalog/price.ts'

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

// ── Switch shopping experience ───────────────────────────────────────────────
// decideExperienceSwitch() is what the /welcome chooser asks before acting on a
// card. Its only customer input is the database-derived access state; the
// stored experience preference is not a parameter, so it cannot influence it.

test('retail account: the Retail experience works', () => {
  assert.deepEqual(decideExperienceSwitch('retail', 'retail'), { kind: 'allow' })
  assert.deepEqual(decideAccess('retail', '/', SIGNED_UP), { kind: 'render' })
})

test('retail account: choosing Wholesale follows the existing application flow', () => {
  assert.deepEqual(decideExperienceSwitch('retail', 'wholesale'), { kind: 'allow' })
  // Still not the portal — the application/status page, exactly as before.
  assert.deepEqual(decideAccess('retail', '/wholesale', SIGNED_UP), { kind: 'redirect', to: WHOLESALE_REQUEST_PATH })
  assert.deepEqual(decideAccess('retail', WHOLESALE_REQUEST_PATH, SIGNED_UP), { kind: 'render' })
})

test('approved wholesale_vip account: the Wholesale experience works', () => {
  assert.deepEqual(decideExperienceSwitch('wholesale_vip', 'wholesale'), { kind: 'allow' })
  assert.deepEqual(decideAccess('wholesale_vip', '/wholesale', SIGNED_UP), { kind: 'render' })
})

test('approved wholesale_vip account: choosing Retail is blocked', () => {
  assert.deepEqual(decideExperienceSwitch('wholesale_vip', 'retail'), { kind: 'blocked', reason: 'wholesale-account' })
})

test('a blocked switch leaves the account wholesale_vip', () => {
  const access = 'wholesale_vip'
  const decision = decideExperienceSwitch(access, 'retail')
  // The decision carries no destination and no tier — nothing to apply.
  assert.deepEqual(Object.keys(decision).sort(), ['kind', 'reason'])
  assert.equal(access, 'wholesale_vip')
  assert.deepEqual(decideAccess(access, '/wholesale', SIGNED_UP), { kind: 'render' })
})

test('the chooser waits while the tier is loading, so no preference is written early', () => {
  assert.deepEqual(decideExperienceSwitch('loading', 'retail'), { kind: 'wait' })
  assert.deepEqual(decideExperienceSwitch('loading', 'wholesale'), { kind: 'wait' })
})

test('wholesale_vip: a refresh never lands in the Retail experience', () => {
  // While the session/profile reload, nothing store-side renders...
  assert.deepEqual(decideAccess('loading', '/', SIGNED_UP), { kind: 'wait' })
  // ...and once the database tier is back, Retail home sends them to the
  // portal whatever the local entry flags say.
  for (const entry of [SIGNED_UP, { onboarded: false, experienceChosen: false }]) {
    assert.deepEqual(decideAccess('wholesale_vip', '/', entry), { kind: 'redirect', to: '/wholesale' })
  }
})

test('wholesale_vip: deep-linking to a Retail route cannot bypass the guard', () => {
  for (const path of ['/', '/index', '/index.html', '/?experience=retail', '/#retail']) {
    assert.deepEqual(decideAccess('wholesale_vip', path, SIGNED_UP), { kind: 'redirect', to: '/wholesale' }, path)
  }
})

test('storefront price selection is unchanged for both tiers', () => {
  // Prices arrive already resolved per caller by my_effective_prices; the
  // client only picks which resolved number to show. Nothing above feeds it.
  const retail = { id: 'r', price: 999, variants: [
    { id: 'a', price: 1099, isVipPrice: false }, { id: 'b', price: 999, isVipPrice: false },
  ] }
  const vip = { id: 'v', price: 899, variants: [
    { id: 'a', price: 949, isVipPrice: true }, { id: 'b', price: 899, isVipPrice: true },
  ] }
  assert.equal(displayPrice(retail), 999)
  assert.equal(displayPriceIsVip(retail), false)
  assert.equal(displayPrice(vip), 899)
  assert.equal(displayPriceIsVip(vip), true)
})
