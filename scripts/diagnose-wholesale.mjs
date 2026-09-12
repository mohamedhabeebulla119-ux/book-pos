#!/usr/bin/env node
/**
 * Apple Expert — wholesale request flow diagnostic. READ ONLY.
 *
 *   DIAG_EMAIL=admin@example.com DIAG_PASSWORD='…' node scripts/diagnose-wholesale.mjs
 *
 * Answers the questions the app itself cannot answer from outside a session:
 * does the customer's row exist, what profile_id and status does it carry, and
 * does the admin's exact query return it?
 *
 * WHY A SCRIPT AND NOT A SERVICE-ROLE KEY
 * It signs in with the publishable (anon) key and a real password — the same
 * pair the app uses — so every query runs under that person's own row-level
 * security, exactly as it does in the browser. A service-role key would bypass
 * RLS and therefore prove nothing about what the admin page can actually see.
 *
 * It NEVER writes: no insert, no update, no RPC call. Approving a request is
 * deliberately left to the Approve button in the admin UI, so the real code
 * path is what gets tested.
 *
 * Run it twice — once as the admin, once as the customer — and compare.
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const REQUEST_COLUMNS =
  'id, profile_id, status, business_name, business_registration, contact_phone, ' +
  'business_type, monthly_volume, message, reviewed_by, reviewed_at, review_note, ' +
  'created_at, updated_at'

/** The embed the admin queue uses, naming its foreign key to stay unambiguous. */
const CUSTOMER_EMBED =
  'profiles!wholesale_access_requests_profile_id_fkey(full_name, email, phone, customer_type)'

function loadEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
  return out
}

/** Prints a PostgREST failure in full — code and hint are where the fix lives. */
function fail(label, error) {
  console.log(`  ✗ ${label}`)
  console.log(`      message: ${error.message}`)
  if (error.code) console.log(`      code:    ${error.code}`)
  if (error.hint) console.log(`      hint:    ${error.hint}`)
  if (error.details) console.log(`      details: ${JSON.stringify(error.details).slice(0, 300)}`)
}

const env = loadEnv(new URL('../.env.local', import.meta.url))
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const email = process.env.DIAG_EMAIL
const password = process.env.DIAG_PASSWORD

if (!url || !anonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')
  process.exit(1)
}
if (!email || !password) {
  console.error('Set DIAG_EMAIL and DIAG_PASSWORD to the account you want to inspect.')
  console.error("Example: DIAG_EMAIL=you@appleexpert.lk DIAG_PASSWORD='…' node scripts/diagnose-wholesale.mjs")
  process.exit(1)
}

const supabase = createClient(url, anonKey)

console.log('\nApple Expert — wholesale flow diagnostic (read only)')
console.log('='.repeat(64))
console.log(`Project : ${url.replace(/https:\/\/(\w{4})\w+/, 'https://$1…')}`)
console.log(`Account : ${email}\n`)

// --- 1. Sign in ------------------------------------------------------------
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password })
if (authError) {
  fail('Sign-in failed', authError)
  process.exit(1)
}
const uid = auth.user.id
console.log('1. SESSION')
console.log(`  ✓ signed in — auth.uid() = ${uid}\n`)

// --- 2. Profile ------------------------------------------------------------
console.log('2. PROFILE (profiles read own)')
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('id, full_name, email, customer_type, vip_approved_at, vip_expires_at')
  .eq('id', uid)
  .maybeSingle()

if (profileError) fail('Could not read own profile', profileError)
else if (!profile) console.log('  ! NO PROFILE ROW — handle_new_user() did not fire for this account.')
else {
  console.log(`  ✓ profile exists, id = ${profile.id}`)
  console.log(`      customer_type = ${profile.customer_type}`)
  console.log(`      id === auth.uid() ? ${profile.id === uid ? 'yes' : 'NO — MISMATCH'}`)
}
console.log()

// --- 3. Roles --------------------------------------------------------------
console.log('3. ROLES (user_roles)')
const { data: roles, error: rolesError } = await supabase
  .from('user_roles')
  .select('role, profile_id')

if (rolesError) fail('Could not read user_roles', rolesError)
else {
  const mine = roles.filter((r) => r.profile_id === uid).map((r) => r.role)
  console.log(`  rows visible : ${roles.length}`)
  console.log(`  this account : ${mine.length ? mine.join(', ') : 'none — this is a plain customer'}`)
  console.log(`  ${mine.length ? '→ admin queue queries should return rows' : '→ admin queue will correctly return nothing'}`)
}
console.log()

// --- 4. The row itself -----------------------------------------------------
console.log('4. WHOLESALE REQUESTS — plain select (what the customer page runs)')
const { data: own, error: ownError } = await supabase
  .from('wholesale_access_requests')
  .select(REQUEST_COLUMNS)
  .order('created_at', { ascending: false })

if (ownError) fail('Plain select failed', ownError)
else {
  console.log(`  rows returned: ${own.length}`)
  for (const row of own) {
    console.log(`   • ${row.business_name}`)
    console.log(`       id         = ${row.id}`)
    console.log(`       profile_id = ${row.profile_id}${row.profile_id === uid ? '  (=== this account)' : '  (another account)'}`)
    console.log(`       status     = ${row.status}`)
    console.log(`       created_at = ${row.created_at}`)
  }
  if (own.length === 0) {
    console.log('  → Either no request was ever inserted, or RLS is withholding every row.')
  }
}
console.log()

// --- 5. The exact admin query ---------------------------------------------
console.log('5. ADMIN QUEUE QUERY — FK-qualified embed (what the admin page runs)')
const { data: adminRows, error: adminError } = await supabase
  .from('wholesale_access_requests')
  .select(`*, ${CUSTOMER_EMBED}`)
  .order('created_at', { ascending: false })

if (adminError) fail('Admin query failed', adminError)
else {
  console.log(`  rows returned: ${adminRows.length}`)
  for (const row of adminRows) {
    const p = row.profiles
    console.log(`   • ${row.business_name} — ${row.status}`)
    console.log(`       applicant: ${p ? `${p.full_name ?? 'no name'} <${p.email ?? 'no email'}> (${p.customer_type})` : 'EMBED RETURNED NULL'}`)
  }
  const pending = adminRows.filter((r) => r.status === 'pending').length
  console.log(`  pending (the queue's default filter): ${pending}`)
}
console.log()

// --- 6. Contrast: the old ambiguous embed ---------------------------------
console.log('6. REGRESSION CHECK — the old ambiguous embed should still fail')
const { error: ambiguousError } = await supabase
  .from('wholesale_access_requests')
  .select('*, profiles(full_name, email, phone, customer_type)')
  .limit(1)

if (ambiguousError) console.log(`  ✓ refused as expected: ${ambiguousError.code} — ${ambiguousError.message.slice(0, 80)}…`)
else console.log('  ! it succeeded — the schema changed; the FK-qualified embed may no longer be needed.')

await supabase.auth.signOut()
console.log('\n' + '='.repeat(64))
console.log('Done. Nothing was written.\n')
