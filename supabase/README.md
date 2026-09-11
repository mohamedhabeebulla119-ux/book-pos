# Apple Expert — Supabase database

Migrations, seed and verification for the Apple Expert catalog, pricing, orders
and admin model.

**Nothing in this directory has been applied to a database yet.** The migrations
were authored and statically reviewed, but this machine has no Supabase CLI, no
running Docker daemon, no `psql` and no access token, so there was no way to run
them. Everything below is the exact runbook to finish that.

## Apply

```bash
# One-time: the CLI is not currently installed on this machine.
brew install supabase/tap/supabase        # or: npm i -D supabase

supabase init                             # creates config.toml; leaves migrations/ alone
```

### Local (recommended first — Docker must be running)

```bash
supabase start
supabase db reset                         # runs every migration, then seed.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
  -f supabase/tests/verify.sql            # must print ALL CHECKS PASSED
```

### Remote

```bash
supabase link --project-ref zltabamnknnufsuyfgmw
supabase db push                          # applies migrations only
psql "$REMOTE_DB_URL" -f supabase/seed.sql
psql "$REMOTE_DB_URL" -f supabase/tests/verify.sql
```

Run `verify.sql` against the local database first. It creates test users and a
test price change inside a transaction and rolls back, but it does write to
`auth.users` while running.

## Generate TypeScript types

Only possible once the schema exists somewhere:

```bash
# local
supabase gen types typescript --local > src/lib/supabase/database.types.ts
# or remote
supabase gen types typescript --project-id zltabamnknnufsuyfgmw > src/lib/supabase/database.types.ts
```

Then type the browser client:

```ts
// src/lib/supabase/client.ts
import type { Database } from './database.types'
client = createClient<Database>(supabaseUrl, supabasePublishableKey)
```

That file was deliberately **not** hand-written. A hand-authored substitute
would drift from the migrations and fail at runtime while still compiling.

## Layout

| Path | What |
|---|---|
| `migrations/` | 13 migrations, applied in filename order |
| `seed.sql` | Generated catalog seed — **do not edit by hand** |
| `seed-summary.json` | Row counts from the last generation |
| `tests/verify.sql` | 20 assertions covering the validation checklist |

## Regenerating the seed

`seed.sql` is generated from the TypeScript the app already ships, so the seeded
rows are provably identical to the live catalog. It is never retyped by hand.

```bash
node scripts/generate-seed.mjs
```

Re-running is safe: catalog rows upsert, and a price row is inserted only when
no live price already exists — so a price an admin has changed through
`admin_set_price()` is never clobbered by a re-seed.

## Two things deliberately left undone

**54 replacement parts have no price and are `is_active = false`.** Their source
values in `src/data/iphoneModels.ts` (`379`, `119`, `69`, …) render as
"Rs. 379" and are almost certainly USD. Nothing was converted or guessed. There
are only **13 distinct numbers** to confirm, not 54. Once they are known:

```sql
select public.admin_set_price('part-display-iphone-17-pro-max', null, 'retail', <cents>, 1, null);
update public.products set is_active = true where id = 'part-display-iphone-17-pro-max';
```

**No `wholesale_vip` price rows are seeded.** The owner sets them in the admin
panel. Until a product has one, VIP customers fall back to the retail price, so
nothing is ever unbuyable.
