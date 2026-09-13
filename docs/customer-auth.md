# Customer authentication

Apple Expert is one app, one database and one catalog. Retail customers,
wholesale customers and administrators all live in the same Supabase project;
what differs is what PostgreSQL will hand each of them.

```
                          APPLE EXPERT
                               │
                   ┌───────────┴───────────┐
            CUSTOMER EXPERIENCE          ADMIN
                   │                       │
        phone + SMS one-time code    email + password
                   │                    (/admin/login)
             Supabase Auth                  │
                   │                    user_roles
        profiles.customer_type           owner/admin/staff
           ┌───────┴────────┐
        retail          wholesale_vip
```

The rule everything else follows: **choosing an experience is not
authorisation.** Tapping "Wholesale Customer" on the entry screen says which
screens to show. Whether wholesale prices exist for you is decided by
`public.profiles.customer_type`, which the app cannot write — the column's
UPDATE privilege is revoked from `authenticated`, and only
`admin_set_customer_type()` can change it.

## The customer flow

| Step | Where |
|---|---|
| Entry screen — Retail or Wholesale | `/welcome` |
| Phone number → code → verify | `/account/sign-in` |
| First-time name (and optional email) | same screen, third step |
| Wholesale gateway: VIP, pending, rejected, or apply | `/wholesale` |

`/account/sign-up` is kept only as a redirect to `/account/sign-in`. With a
one-time code there is nothing to register: verifying a number that Apple Expert
has not seen before creates the account, and `public.handle_new_user()` creates
the matching `profiles` row with `customer_type` taking its `retail` default.

Nobody can sign up as a wholesale customer. There is no form field for it, no
request parameter for it, and the database would refuse it if there were.

## SMS provider

Sending and verifying live in exactly one file: `src/lib/auth/otp.ts`. The UI
never calls Supabase Auth for OTP directly.

The screen asks the project what it can do rather than assuming, by reading
GoTrue's public `/auth/v1/settings` document:

- `external.phone === true` → the phone form works normally.
- otherwise → "SMS verification will be available soon", and the Send button is
  disabled.

**There is no fake mode.** No hardcoded code, no simulated delivery, no branch
that can report a verified number without GoTrue having verified it.

### When the SMS provider is purchased

1. In the Supabase dashboard: **Authentication → Providers → Phone** → enable,
   then enter the gateway's credentials (Twilio is the project's current
   default; Vonage, MessageBird and a generic HTTP hook are also supported).
2. Leave **Enable phone confirmations** on, and **phone autoconfirm off**.
3. Optionally set the SMS template and the OTP expiry.
4. Nothing to rebuild or redeploy — the installed APK reads the capability at
   runtime and the form goes live.
5. Turn Guest Test Mode off and cut a production build (below).

Two optional follow-ups, neither required for the flow to work:

- `public.handle_new_user()` copies `email` and `full_name` from the new auth
  user but not `phone`. The app fills `profiles.phone` itself straight after
  verification, so this is cosmetic; a one-line trigger change would do it
  inside PostgreSQL instead.
- Supabase's default SMS rate limits (per number and per hour) are worth
  reviewing against real traffic before launch.

## Guest Test Mode

A development feature for reviewing the retail and wholesale screens before the
SMS provider exists.

A guest is a flag in `sessionStorage` saying which screens to show. It is **not**
authentication and cannot become it:

- no Supabase session, no token, no JWT — real or fake;
- no account, no profile row, no VIP record;
- no `customer_type`. Prices are resolved by PostgreSQL from
  `private.current_customer_type()`, which reads `auth.uid()`. A guest has none,
  so every query returns public retail prices and row-level security physically
  withholds every `wholesale_vip` row;
- `sessionStorage`, not `localStorage`, so a test identity dies with the app
  session and never sits beside real preferences.

A TEST MODE banner is pinned to every screen while a guest is active, and the
wholesale portal renders as a clearly marked demo that shows the layout and
withholds the data.

### Enabling it (local testing)

```bash
# .env.local
NEXT_PUBLIC_ENABLE_GUEST_MODE=true
```

Then `npm run dev`, or `npm run build && npx cap sync android` for a test APK.
The entry screen gains a dashed **TESTING MODE** panel with "Continue as Retail
Guest" and "Continue as Wholesale Guest".

### Disabling it (production)

```bash
# .env.local — or simply omit the variable
NEXT_PUBLIC_ENABLE_GUEST_MODE=false
```

Rebuild. Two things then hold:

- **The entry is gone, not hidden.** The TESTING MODE panel on `/welcome` is
  gated on the literal `process.env.NEXT_PUBLIC_ENABLE_GUEST_MODE === 'true'`,
  which Next.js substitutes at build time, so the minifier deletes the block. A
  production bundle has no guest buttons in it to find.
- **Nothing can start or restore a guest session.** `startGuestSession()`
  returns immediately and `hydrate()` returns `null` without reading storage, so
  a stale flag left in a tester's browser — or a hand-edited `sessionStorage`
  entry — is ignored. The banner, the profile card and the wholesale demo panel
  all render from `useGuestMode()`, which can then only ever return `null`.

Verify a production build with:

```bash
grep -rl "Continue as Retail Guest" out/_next/static/chunks | wc -l   # expect 0
```

(The `apple-expert-guest-test-mode` storage key itself still appears in the
bundle — it lives in the guarded module, which is what does the ignoring.)

## What did not change

Administration is untouched: `/admin/login` and every `/admin/*` screen still
use email + password plus `user_roles` (`owner`/`admin`/`staff`). Customer tiers
(`retail`, `wholesale_vip`) and admin roles remain separate systems — a customer
tier grants no admin access and an admin role grants no pricing.

No database migration was needed for any of this. Nothing in the schema, the RLS
policies, `product_prices`, `price_tiers`, `orders` or `user_roles` was altered.
