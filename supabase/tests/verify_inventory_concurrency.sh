#!/usr/bin/env bash
# ============================================================================
# Apple Expert - P1 admin_set_stock concurrency checks (LOCAL ONLY)
# ----------------------------------------------------------------------------
# Runs real parallel sessions against the local stack's database container,
# logged in as authenticator with role authenticated - the PostgREST path.
#
#   bash supabase/tests/verify_inventory_concurrency.sh
#
# Session A calls admin_set_stock and then holds its transaction open with
# pg_sleep, so session B provably overlaps it. Fixtures are committed (two
# sessions cannot share an uncommitted transaction) and removed at the start
# and end by verify_inventory_ledger_authenticator_cleanup.sql.
#
#   C1  identical requests        -> one stock change, one ledger row, B replays
#   C2  different requests, same expected value -> B gets stale_quantity
#   C3  one request id on two different products -> B gets request_id_reused
#   C4  variant then product of the same item    -> serialised, no deadlock
# ============================================================================
set -euo pipefail

CONTAINER=supabase_db_apple-expert
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

ADMIN=f6666666-6666-6666-6666-666666666666
VARIANT=a1000000-0000-0000-0000-000000000001

as_postgres() { docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
as_api()      { docker exec -i "$CONTAINER" psql -h 127.0.0.1 -U authenticator -d postgres -qAt "$@"; }

fail() { echo "FAILED - $*" >&2; as_postgres < "$HERE/verify_inventory_ledger_authenticator_cleanup.sql" >/dev/null; exit 1; }

# One API session: claims, role, the call, then hold the transaction open.
session() { # $1 call  $2 seconds to hold
  cat <<SQL
begin;
select set_config('request.jwt.claims', '{"sub":"$ADMIN","role":"authenticated"}', true) \\g /dev/null
set local role authenticated;
select $1;
select pg_sleep($2) \\g /dev/null
commit;
SQL
}

as_postgres < "$HERE/verify_inventory_ledger_authenticator_cleanup.sql" >/dev/null
as_postgres <<SQL >/dev/null
begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
values ('$ADMIN', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'inv-conc-admin@test.local', '', now(), now(), now(), '{}', '{}', false);
insert into public.user_roles (profile_id, role) values ('$ADMIN', 'admin');
insert into public.products (id, name, category_id, subcategory, stock, is_active)
select p.id, p.id, (select id from public.categories where slug = 'accessories'), 'Other Accessories', 10, false
from (values ('p1-conc'), ('p1-conc-b')) as p(id);
insert into public.product_variants (id, product_id, legacy_key, name, stock)
values ('$VARIANT', 'p1-conc', 'v1', 'Own stock', 5);
commit;
SQL

count_rows() { as_postgres -c "select count(*) from public.inventory_movements where $1"; }
stock_of()   { as_postgres -c "select stock from public.products where id = '$1'"; }

# C1 -------------------------------------------------------------------------
RID=$(uuidgen | tr 'A-Z' 'a-z')
CALL="public.admin_set_stock('p1-conc', null, 10, 15, 'stock_count', 'C1 count', '$RID')"
session "$CALL" 2 | as_api > "$WORK/a1" 2>&1 &
sleep 0.5
session "$CALL" 0 | as_api > "$WORK/b1" 2>&1 &
wait
grep -q '"replayed": false' "$WORK/a1" || fail "C1 session A: $(cat "$WORK/a1")"
grep -q '"replayed": true'  "$WORK/b1" || fail "C1 session B: $(cat "$WORK/b1")"
[ "$(stock_of p1-conc)" = 15 ] || fail "C1 stock is $(stock_of p1-conc), expected 15"
[ "$(count_rows "request_id = '$RID'")" = 1 ] || fail "C1 ledger rows for the request: $(count_rows "request_id = '$RID'")"
[ "$(count_rows "product_id = 'p1-conc'")" = 1 ] || fail "C1 ledger rows for the product"
echo "C1 ok - two identical concurrent requests: one stock change (10 -> 15), one ledger row, second replayed"

# C2 -------------------------------------------------------------------------
session "public.admin_set_stock('p1-conc', null, 15, 18, 'restock', 'C2 first',  '$(uuidgen | tr 'A-Z' 'a-z')')" 2 | as_api > "$WORK/a2" 2>&1 &
sleep 0.5
session "public.admin_set_stock('p1-conc', null, 15, 20, 'restock', 'C2 second', '$(uuidgen | tr 'A-Z' 'a-z')')" 0 | as_api > "$WORK/b2" 2>&1 &
wait
grep -q '"quantity_after": 18' "$WORK/a2" || fail "C2 session A: $(cat "$WORK/a2")"
grep -q 'stale_quantity' "$WORK/b2"       || fail "C2 session B: $(cat "$WORK/b2")"
[ "$(stock_of p1-conc)" = 18 ] || fail "C2 stock is $(stock_of p1-conc), expected 18"
[ "$(count_rows "product_id = 'p1-conc'")" = 2 ] || fail "C2 ledger rows"
echo "C2 ok - competing requests on the same value: the first applies, the second gets stale_quantity and writes nothing"

# C3 -------------------------------------------------------------------------
RID=$(uuidgen | tr 'A-Z' 'a-z')
session "public.admin_set_stock('p1-conc',   null, 18, 19, 'restock', 'C3 shared id', '$RID')" 2 | as_api > "$WORK/a3" 2>&1 &
sleep 0.5
session "public.admin_set_stock('p1-conc-b', null, 10, 11, 'restock', 'C3 shared id', '$RID')" 0 | as_api > "$WORK/b3" 2>&1 &
wait
grep -q '"quantity_after": 19' "$WORK/a3" || fail "C3 session A: $(cat "$WORK/a3")"
grep -q 'request_id_reused' "$WORK/b3"    || fail "C3 session B: $(cat "$WORK/b3")"
[ "$(stock_of p1-conc-b)" = 10 ] || fail "C3 the second product changed"
[ "$(count_rows "request_id = '$RID'")" = 1 ] || fail "C3 ledger rows for the request"
echo "C3 ok - one request id on two products at once: the second waits on the unique index and is refused; nothing written for it"

# C4 -------------------------------------------------------------------------
session "public.admin_set_stock('p1-conc', '$VARIANT'::uuid, 5, 3, 'damage', 'C4 variant', '$(uuidgen | tr 'A-Z' 'a-z')')" 2 | as_api > "$WORK/a4" 2>&1 &
sleep 0.5
session "public.admin_set_stock('p1-conc', null, 19, 22, 'restock', 'C4 product', '$(uuidgen | tr 'A-Z' 'a-z')')" 0 | as_api > "$WORK/b4" 2>&1 &
wait
grep -q '"quantity_after": 3'  "$WORK/a4" || fail "C4 session A: $(cat "$WORK/a4")"
grep -q '"quantity_after": 22' "$WORK/b4" || fail "C4 session B: $(cat "$WORK/b4")"
echo "C4 ok - variant and product adjustments on one item serialise on the product lock without deadlock"

as_postgres < "$HERE/verify_inventory_ledger_authenticator_cleanup.sql" >/dev/null
echo "ALL INVENTORY CONCURRENCY CHECKS PASSED"
