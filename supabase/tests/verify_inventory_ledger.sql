-- ============================================================================
-- Apple Expert - P1 inventory ledger and stock guard verification
-- ----------------------------------------------------------------------------
-- Run AFTER migration 20261023120000 and the seed, as postgres:
--
--   docker exec -i supabase_db_apple-expert psql -U postgres \
--     < supabase/tests/verify_inventory_ledger.sql
--
-- Same conventions as the other suites: every check RAISES on failure, all
-- fixtures live in one transaction that is rolled back, and role impersonation
-- sets the JWT claims PostgREST would set. A clean run ends with
-- "ALL INVENTORY LEDGER CHECKS PASSED".
--
-- This suite logs in as postgres, which the guard treats as an operator
-- session. Inside it, impersonated clients (role anon / authenticated /
-- service_role) are never operators, so every direct-write check below is real.
-- A SECURITY DEFINER function called from here, however, runs with an operator
-- login, so "an unrecorded write from inside a postgres-owned function is
-- refused" is proven by verify_inventory_ledger_authenticator.sql, which logs in
-- as authenticator exactly like PostgREST.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin)
select u.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '',
       now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false
from (values
  ('f1111111-1111-1111-1111-111111111111', 'inv-admin@test.local'),
  ('f2222222-2222-2222-2222-222222222222', 'inv-owner@test.local'),
  ('f3333333-3333-3333-3333-333333333333', 'inv-staff@test.local'),
  ('f4444444-4444-4444-4444-444444444444', 'inv-customer@test.local')
) as u(id, email)
on conflict (id) do nothing;

insert into public.user_roles (profile_id, role) values
  ('f1111111-1111-1111-1111-111111111111', 'admin'),
  ('f2222222-2222-2222-2222-222222222222', 'owner'),
  ('f3333333-3333-3333-3333-333333333333', 'staff')
on conflict (profile_id, role) do nothing;

-- Fixtures, written as the operator session (the seed path).
insert into public.products (id, name, category_id, subcategory, stock, is_active)
select p.id, p.name, (select id from public.categories where slug = 'accessories'), 'Other Accessories', p.stock, false
from (values
  ('p1-plain',  'P1 plain',  10),
  ('p1-shared', 'P1 shared', 20),
  ('p1-mixed',  'P1 mixed',  30),
  ('p1-new',    'P1 new',     0),
  ('p1-del',    'P1 delete',  0)
) as p(id, name, stock);

insert into public.product_variants (id, product_id, legacy_key, name, stock) values
  ('a0000000-0000-0000-0000-000000000001', 'p1-shared', 'v1', 'Shared A', null),
  ('a0000000-0000-0000-0000-000000000002', 'p1-shared', 'v2', 'Shared B', null),
  ('a0000000-0000-0000-0000-000000000003', 'p1-mixed',  'v1', 'Own 5',    5),
  ('a0000000-0000-0000-0000-000000000004', 'p1-mixed',  'v2', 'Inherits', null),
  ('a0000000-0000-0000-0000-000000000005', 'p1-del',    'v1', 'Own 0',    0),
  ('a0000000-0000-0000-0000-000000000006', 'p1-del',    'v2', 'Own 4',    4);

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end $$;

-- Runs p_sql and requires it to FAIL with a message matching p_like. The inner
-- block is a subtransaction, so whatever the statement did is rolled back.
create function pg_temp.expect_fail(p_label text, p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like p_like then
      return;
    end if;
    raise exception '% FAILED - wrong error: % (sqlstate %)', p_label, sqlerrm, sqlstate;
  end;
  raise exception '% FAILED - statement succeeded: %', p_label, p_sql;
end $$;

create function pg_temp.adj(p_product text, p_variant uuid, p_expected integer, p_new integer,
                            p_reason text, p_note text, p_request uuid)
returns jsonb language sql as $$
  select public.admin_set_stock(p_product, p_variant, p_expected, p_new, p_reason, p_note, p_request)
$$;

create function pg_temp.adj_sql(p_product text, p_variant text, p_expected integer, p_new integer,
                                p_reason text, p_note text, p_request text)
returns text language sql as $$
  select format('select public.admin_set_stock(%L, %s, %s, %s, %L, %L, %s)',
                p_product, coalesce(quote_literal(p_variant) || '::uuid', 'null'),
                coalesce(p_expected::text, 'null'), coalesce(p_new::text, 'null'), p_reason, p_note,
                coalesce(quote_literal(p_request) || '::uuid', 'null'))
$$;

create function pg_temp.stock_of(p_product text) returns integer language sql as $$
  select stock from public.products where id = p_product
$$;
create function pg_temp.vstock_of(p_variant uuid) returns integer language sql as $$
  select stock from public.product_variants where id = p_variant
$$;
create function pg_temp.moves() returns bigint language sql as $$
  select count(*) from public.inventory_movements
$$;

do $$
declare
  c_admin    constant uuid := 'f1111111-1111-1111-1111-111111111111';
  c_owner    constant uuid := 'f2222222-2222-2222-2222-222222222222';
  c_staff    constant uuid := 'f3333333-3333-3333-3333-333333333333';
  c_customer constant uuid := 'f4444444-4444-4444-4444-444444444444';
  c_vs1      constant uuid := 'a0000000-0000-0000-0000-000000000001';
  c_vm1      constant uuid := 'a0000000-0000-0000-0000-000000000003';
  c_vm2      constant uuid := 'a0000000-0000-0000-0000-000000000004';
  c_vd0      constant uuid := 'a0000000-0000-0000-0000-000000000005';
  c_vd4      constant uuid := 'a0000000-0000-0000-0000-000000000006';
  c_rid1     constant uuid := 'b0000000-0000-0000-0000-000000000001';
  v_r        jsonb;
  v_m        public.inventory_movements;
  v_moves    bigint;
  v_count    integer;
begin

  -- L1 - the approved function: admin ---------------------------------------
  perform pg_temp.as_user(c_admin);
  v_r := pg_temp.adj('p1-plain', null, 10, 12, 'stock_count', 'L1 shelf count', c_rid1);
  perform pg_temp.as_postgres();
  if (v_r ->> 'replayed')::boolean or (v_r ->> 'quantity_before')::int <> 10
     or (v_r ->> 'quantity_after')::int <> 12 or (v_r ->> 'delta')::int <> 2 then
    raise exception 'L1 FAILED - result %', v_r;
  end if;
  select * into v_m from public.inventory_movements where request_id = c_rid1;
  if pg_temp.stock_of('p1-plain') <> 12 or v_m.actor_id <> c_admin or v_m.product_id <> 'p1-plain'
     or v_m.variant_id is not null or v_m.quantity_before <> 10 or v_m.quantity_after <> 12
     or v_m.delta <> 2 or v_m.reason <> 'stock_count' or v_m.note <> 'L1 shelf count'
     or v_m.txid <> pg_current_xact_id() then
    raise exception 'L1 FAILED - ledger row or stock wrong: % / stock %', row_to_json(v_m), pg_temp.stock_of('p1-plain');
  end if;
  raise notice 'L1 ok - admin_set_stock changed stock 10 -> 12 and wrote one matching ledger row (actor, before/after, delta, reason, note, request, txid)';

  -- L2 - owner may adjust too ------------------------------------------------
  perform pg_temp.as_user(c_owner);
  v_r := pg_temp.adj('p1-plain', null, 12, 14, 'restock', 'L2 delivery', gen_random_uuid());
  perform pg_temp.as_postgres();
  if pg_temp.stock_of('p1-plain') <> 14 then raise exception 'L2 FAILED - stock %', pg_temp.stock_of('p1-plain'); end if;
  raise notice 'L2 ok - owner can adjust';

  -- L3 - unauthorised callers change nothing --------------------------------
  v_moves := pg_temp.moves();
  perform pg_temp.as_user(c_staff);
  perform pg_temp.expect_fail('L3 staff',
    pg_temp.adj_sql('p1-plain', null, 14, 15, 'restock', 'staff try', gen_random_uuid()::text), 'insufficient_privilege:%');
  perform pg_temp.as_user(c_customer);
  perform pg_temp.expect_fail('L3 customer',
    pg_temp.adj_sql('p1-plain', null, 14, 15, 'restock', 'customer try', gen_random_uuid()::text), 'insufficient_privilege:%');
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  perform pg_temp.expect_fail('L3 no-sub',
    pg_temp.adj_sql('p1-plain', null, 14, 15, 'restock', 'no user', gen_random_uuid()::text), 'not_authenticated:%');
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform pg_temp.expect_fail('L3 anon',
    pg_temp.adj_sql('p1-plain', null, 14, 15, 'restock', 'anon try', gen_random_uuid()::text), 'permission denied for function admin_set_stock%');
  perform pg_temp.as_postgres();
  if pg_temp.stock_of('p1-plain') <> 14 or pg_temp.moves() <> v_moves then
    raise exception 'L3 FAILED - an unauthorised call changed state';
  end if;
  raise notice 'L3 ok - staff, customer, signed-out and anon callers are refused; no stock or ledger change';

  -- L4 - validation, failed calls leave nothing behind ------------------------
  v_moves := pg_temp.moves();
  perform pg_temp.as_user(c_admin);
  perform pg_temp.expect_fail('L4 negative',  pg_temp.adj_sql('p1-plain', null, 14, -1,     'correction', 'neg', gen_random_uuid()::text), 'invalid_quantity:%');
  perform pg_temp.expect_fail('L4 too large', pg_temp.adj_sql('p1-plain', null, 14, 100001, 'correction', 'big', gen_random_uuid()::text), 'invalid_quantity:%');
  perform pg_temp.expect_fail('L4 null qty',  pg_temp.adj_sql('p1-plain', null, 14, null,   'correction', 'nul', gen_random_uuid()::text), 'invalid_quantity:%');
  perform pg_temp.expect_fail('L4 reason',    pg_temp.adj_sql('p1-plain', null, 14, 15,     'sale',       'sold', gen_random_uuid()::text), 'invalid_reason:%');
  perform pg_temp.expect_fail('L4 short note',pg_temp.adj_sql('p1-plain', null, 14, 15,     'correction', '  ab ', gen_random_uuid()::text), 'invalid_note:%');
  perform pg_temp.expect_fail('L4 no note',   pg_temp.adj_sql('p1-plain', null, 14, 15,     'correction', null, gen_random_uuid()::text), 'invalid_note:%');
  perform pg_temp.expect_fail('L4 long note', pg_temp.adj_sql('p1-plain', null, 14, 15,     'correction', repeat('x', 501), gen_random_uuid()::text), 'invalid_note:%');
  perform pg_temp.expect_fail('L4 no request',pg_temp.adj_sql('p1-plain', null, 14, 15,     'correction', 'no rid', null), 'invalid_request:%');
  perform pg_temp.expect_fail('L4 product',   pg_temp.adj_sql('p1-nope',  null, 0, 1,       'correction', 'none', gen_random_uuid()::text), 'unknown_product:%');
  perform pg_temp.expect_fail('L4 mismatch',  pg_temp.adj_sql('p1-plain', c_vm1::text, 5, 6, 'correction', 'wrong product', gen_random_uuid()::text), 'variant_product_mismatch:%');
  perform pg_temp.expect_fail('L4 restock-',  pg_temp.adj_sql('p1-plain', null, 14, 13,     'restock',    'down', gen_random_uuid()::text), 'invalid_reason:%');
  perform pg_temp.expect_fail('L4 return-',   pg_temp.adj_sql('p1-plain', null, 14, 13,     'return',     'down', gen_random_uuid()::text), 'invalid_reason:%');
  perform pg_temp.expect_fail('L4 damage+',   pg_temp.adj_sql('p1-plain', null, 14, 15,     'damage',     'goes up', gen_random_uuid()::text), 'invalid_reason:%');
  perform pg_temp.expect_fail('L4 stale',     pg_temp.adj_sql('p1-plain', null, 10, 15,     'correction', 'stale', gen_random_uuid()::text), 'stale_quantity:%');
  perform pg_temp.expect_fail('L4 no change', pg_temp.adj_sql('p1-plain', null, 14, 14,     'correction', 'same', gen_random_uuid()::text), 'no_change:%');
  perform pg_temp.expect_fail('L4 opening',   pg_temp.adj_sql('p1-plain', null, 14, 20,     'opening_balance', 'has history', gen_random_uuid()::text), 'invalid_reason:%');
  perform pg_temp.as_postgres();
  if pg_temp.stock_of('p1-plain') <> 14 or pg_temp.moves() <> v_moves then
    raise exception 'L4 FAILED - a refused call changed state';
  end if;
  -- Boundary: 100,000 is allowed.
  perform pg_temp.as_user(c_admin);
  perform pg_temp.adj('p1-plain', null, 14, 100000, 'correction', 'L4 upper bound', gen_random_uuid());
  perform pg_temp.adj('p1-plain', null, 100000, 14, 'correction', 'L4 back down', gen_random_uuid());
  perform pg_temp.as_postgres();
  raise notice 'L4 ok - negative/over-limit/null quantities, bad reasons and notes, missing request, unknown or foreign items, stale and no-op values refused with nothing written; 100000 accepted';

  -- L5 - idempotent replay comes BEFORE the stale check ----------------------
  v_moves := pg_temp.moves();
  perform pg_temp.as_user(c_admin);
  -- Same request as L1 (expected 10 -> 12) while stock is now 14.
  v_r := pg_temp.adj('p1-plain', null, 10, 12, 'stock_count', 'L1 shelf count', c_rid1);
  perform pg_temp.as_postgres();
  if not (v_r ->> 'replayed')::boolean or (v_r ->> 'quantity_after')::int <> 12
     or (v_r ->> 'current_quantity')::int <> 14 or pg_temp.moves() <> v_moves or pg_temp.stock_of('p1-plain') <> 14 then
    raise exception 'L5 FAILED - replay result % (moves % -> %)', v_r, v_moves, pg_temp.moves();
  end if;
  raise notice 'L5 ok - a completed request replays its original result (not stale_quantity) and applies nothing';

  -- L6 - a reused request id with any different field is refused -------------
  perform pg_temp.as_user(c_admin);
  perform pg_temp.expect_fail('L6 qty',    pg_temp.adj_sql('p1-plain', null, 10, 13, 'stock_count', 'L1 shelf count', c_rid1::text), 'request_id_reused:%');
  perform pg_temp.expect_fail('L6 note',   pg_temp.adj_sql('p1-plain', null, 10, 12, 'stock_count', 'other note',     c_rid1::text), 'request_id_reused:%');
  perform pg_temp.expect_fail('L6 reason', pg_temp.adj_sql('p1-plain', null, 10, 12, 'correction',  'L1 shelf count', c_rid1::text), 'request_id_reused:%');
  perform pg_temp.expect_fail('L6 item',   pg_temp.adj_sql('p1-shared', null, 20, 21, 'stock_count', 'L1 shelf count', c_rid1::text), 'request_id_reused:%');
  perform pg_temp.as_user(c_owner);
  perform pg_temp.expect_fail('L6 actor',  pg_temp.adj_sql('p1-plain', null, 10, 12, 'stock_count', 'L1 shelf count', c_rid1::text), 'request_id_reused:%');
  perform pg_temp.as_postgres();
  if pg_temp.moves() <> v_moves then raise exception 'L6 FAILED - a reused id wrote a row'; end if;
  raise notice 'L6 ok - a request id reused with a different quantity, note, reason, item or actor is refused';

  -- L7 - shared (inherited) stock -------------------------------------------
  perform pg_temp.as_user(c_admin);
  perform pg_temp.adj('p1-shared', null, 20, 25, 'restock', 'L7 shared pool', gen_random_uuid());
  perform pg_temp.expect_fail('L7 variant', pg_temp.adj_sql('p1-shared', c_vs1::text, 25, 26, 'restock', 'per variant', gen_random_uuid()::text), 'variant_inherits_product_stock:%');
  perform pg_temp.as_postgres();
  select count(*) into v_count from public.inventory_movements where product_id = 'p1-shared';
  if pg_temp.stock_of('p1-shared') <> 25 or v_count <> 1
     or (select variant_id from public.inventory_movements where product_id = 'p1-shared') is not null
     or pg_temp.vstock_of(c_vs1) is not null then
    raise exception 'L7 FAILED - shared pool handled wrongly';
  end if;
  raise notice 'L7 ok - a shared pool is adjusted once at product level; per-variant adjustment of an inheriting variant is refused';

  -- L8 - mixed product ------------------------------------------------------
  perform pg_temp.as_user(c_admin);
  perform pg_temp.adj('p1-mixed', c_vm1, 5, 3, 'damage', 'L8 two cracked', gen_random_uuid());
  perform pg_temp.expect_fail('L8 inheriting', pg_temp.adj_sql('p1-mixed', c_vm2::text, 30, 31, 'restock', 'inherits', gen_random_uuid()::text), 'variant_inherits_product_stock:%');
  perform pg_temp.as_postgres();
  if pg_temp.vstock_of(c_vm1) <> 3 or pg_temp.stock_of('p1-mixed') <> 30 or pg_temp.vstock_of(c_vm2) is not null
     or (select variant_id from public.inventory_movements where product_id = 'p1-mixed') <> c_vm1 then
    raise exception 'L8 FAILED - mixed product handled wrongly';
  end if;
  raise notice 'L8 ok - an independent variant is adjusted on its own row; the product and inheriting variants are untouched';

  -- L9 - opening balance ----------------------------------------------------
  perform pg_temp.as_user(c_admin);
  perform pg_temp.adj('p1-new', null, 0, 7, 'opening_balance', 'L9 opening stock', gen_random_uuid());
  perform pg_temp.expect_fail('L9 second opening', pg_temp.adj_sql('p1-new', null, 7, 9, 'opening_balance', 'again', gen_random_uuid()::text), 'invalid_reason:%');
  perform pg_temp.as_postgres();
  if pg_temp.stock_of('p1-new') <> 7 then raise exception 'L9 FAILED'; end if;
  raise notice 'L9 ok - opening_balance allowed once, at zero with no history';

  -- G1 - an ordinary authenticated client cannot change stock directly -------
  v_moves := pg_temp.moves();
  perform pg_temp.as_user(c_admin);
  perform pg_temp.expect_fail('G1 product', $q$update public.products set stock = 99 where id = 'p1-plain'$q$, 'stock_locked:%');
  perform pg_temp.expect_fail('G1 variant', format('update public.product_variants set stock = 9 where id = %L', c_vm1), 'stock_locked:%');
  -- Reversing the last recorded change is not "the same" change: refused.
  perform pg_temp.expect_fail('G1 reverse', format('update public.product_variants set stock = 5 where id = %L', c_vm1), 'stock_locked:%');
  perform pg_temp.expect_fail('G1 mode on',  format('update public.product_variants set stock = 9 where id = %L', c_vs1), 'stock_mode_locked:%');
  perform pg_temp.expect_fail('G1 mode off', format('update public.product_variants set stock = null where id = %L', c_vm1), 'stock_mode_locked:%');
  -- Moving a variant that holds its own stock / history to another product.
  perform pg_temp.expect_fail('G1 move variant', format('update public.product_variants set product_id = %L where id = %L', 'p1-plain', c_vm1), 'stock_locked:%');
  perform pg_temp.as_postgres();
  if pg_temp.stock_of('p1-plain') <> 14 or pg_temp.vstock_of(c_vm1) <> 3 or pg_temp.vstock_of(c_vs1) is not null
     or pg_temp.moves() <> v_moves then
    raise exception 'G1 FAILED - a direct write changed state';
  end if;
  raise notice 'G1 ok - direct product/variant stock updates, reversals, inherit<->own switches and moving a stocked variant are refused for an authenticated admin';

  -- G2 - installed admin builds resend the unchanged value: still works ------
  perform pg_temp.as_user(c_admin);
  update public.products set stock = stock, description = description || '' where id = 'p1-plain';
  update public.product_variants set stock = stock, name = name where id in (c_vm1, c_vs1);
  insert into public.products (id, name, category_id, subcategory, stock)
  values ('p1-legacy-create', 'Legacy create', (select id from public.categories where slug = 'accessories'), 'Other Accessories', 0);
  insert into public.product_variants (product_id, legacy_key, name, stock) values ('p1-legacy-create', 'v1', 'Legacy variant', null);
  perform pg_temp.expect_fail('G2 product stock>0', $q$insert into public.products (id, name, category_id, subcategory, stock)
    values ('p1-legacy-5', 'x', (select id from public.categories where slug = 'accessories'), 'Other Accessories', 5)$q$, 'stock_locked:%');
  perform pg_temp.expect_fail('G2 variant stock', $q$insert into public.product_variants (product_id, legacy_key, name, stock)
    values ('p1-legacy-create', 'v2', 'x', 3)$q$, 'stock_locked:%');
  -- The installed creator's rollback path: a fresh zero-stock draft can still be deleted.
  delete from public.products where id = 'p1-legacy-create';
  perform pg_temp.as_postgres();
  if exists (select 1 from public.products where id = 'p1-legacy-create') then
    raise exception 'G2 FAILED - zero-stock draft was not deleted';
  end if;
  raise notice 'G2 ok - unchanged-stock edits, zero-stock product inserts and inheriting variant inserts work; non-zero stock on insert is refused';

  -- G3 - client-controlled settings cannot open the guard -------------------
  perform pg_temp.as_user(c_admin);
  perform set_config('apple_expert.stock_write', 'on', true);
  perform set_config('request.jwt.claims', json_build_object('sub', c_admin, 'role', 'service_role')::text, true);
  perform pg_temp.expect_fail('G3 forged claims', $q$update public.products set stock = 99 where id = 'p1-plain'$q$, 'stock_locked:%');
  perform set_config('role', 'service_role', true);
  perform pg_temp.expect_fail('G3 service_role', $q$update public.products set stock = 99 where id = 'p1-plain'$q$, 'stock_locked:%');
  perform set_config('role', 'anon', true);
  perform pg_temp.expect_fail('G3 anon',
    $q$update public.products set stock = 99 where id = 'p1-plain'$q$, 'permission denied for table products%');
  -- SET ROLE is checked against the LOGIN role, so "a client cannot become
  -- postgres" is asserted in verify_inventory_ledger_authenticator.sql.
  perform pg_temp.as_postgres();
  perform set_config('apple_expert.stock_write', '', true);
  if pg_temp.stock_of('p1-plain') <> 14 then raise exception 'G3 FAILED - stock changed'; end if;
  raise notice 'G3 ok - a custom GUC, forged service_role claims and the service_role role do not bypass the guard';

  -- G4 - the ledger cannot be forged -----------------------------------------
  perform pg_temp.as_user(c_admin);
  perform pg_temp.expect_fail('G4 insert', $q$insert into public.inventory_movements (product_id, delta, reason, actor_id)
    values ('p1-plain', 5, 'restock', 'f2222222-2222-2222-2222-222222222222')$q$, 'permission denied for table inventory_movements%');
  perform pg_temp.expect_fail('G4 update', $q$update public.inventory_movements set delta = 50 where product_id = 'p1-plain'$q$, 'permission denied for table inventory_movements%');
  perform pg_temp.expect_fail('G4 delete', $q$delete from public.inventory_movements where product_id = 'p1-plain'$q$, 'permission denied for table inventory_movements%');
  perform pg_temp.as_postgres();
  raise notice 'G4 ok - insert (including a forged actor), update and delete on the ledger are refused';

  -- D1 - deletion and history -------------------------------------------------
  v_moves := pg_temp.moves();
  perform pg_temp.as_user(c_admin);
  perform pg_temp.expect_fail('D1 variant own>0', format('delete from public.product_variants where id = %L', c_vd4), 'stock_on_hand:%');
  delete from public.product_variants where id = c_vd0;   -- own 0, no history: allowed
  perform pg_temp.expect_fail('D1 product>0', $q$delete from public.products where id = 'p1-plain'$q$, 'stock_on_hand:%');
  -- p1-del has stock 0 but its remaining variant holds 4: the cascade is refused.
  perform pg_temp.expect_fail('D1 cascade', $q$delete from public.products where id = 'p1-del'$q$, 'stock_on_hand:%');
  -- Adjust to zero, then history blocks deletion.
  perform pg_temp.adj('p1-mixed', c_vm1, 3, 0, 'correction', 'D1 obsolete colour', gen_random_uuid());
  perform pg_temp.expect_fail('D1 variant history', format('delete from public.product_variants where id = %L', c_vm1), 'inventory_history_exists:%');
  perform pg_temp.adj('p1-new', null, 7, 0, 'correction', 'D1 discontinued', gen_random_uuid());
  perform pg_temp.expect_fail('D1 product history', $q$delete from public.products where id = 'p1-new'$q$, 'inventory_history_exists:%');
  perform pg_temp.as_postgres();
  -- The rule applies to the operator session too.
  perform pg_temp.expect_fail('D1 operator', format('delete from public.product_variants where id = %L', c_vd4), 'stock_on_hand:%');
  perform pg_temp.expect_fail('D1 operator history', $q$delete from public.products where id = 'p1-new'$q$, 'inventory_history_exists:%');
  if exists (select 1 from public.product_variants where id = c_vd0)
     or pg_temp.moves() <> v_moves + 2
     or not exists (select 1 from public.products where id = 'p1-new') then
    raise exception 'D1 FAILED - deletion rules or history wrong';
  end if;
  raise notice 'D1 ok - positive stock or history blocks deletion for everyone (cascades included); a zero-stock variant without history can be deleted; no ledger row is lost';

  -- O1 - the documented operator exemption ------------------------------------
  -- An operator login (migrations, seed, SQL Editor) may set stock without a
  -- ledger row. Asserted so the exemption cannot widen unnoticed.
  update public.products set stock = 21 where id = 'p1-shared';
  if pg_temp.stock_of('p1-shared') <> 21 then raise exception 'O1 FAILED'; end if;
  update public.products set stock = 25 where id = 'p1-shared';
  raise notice 'O1 ok - operator session (login role is a member of postgres) may write stock directly, as documented';

  -- S1 - schema facts the guard depends on -----------------------------------
  if pg_has_role('authenticator', 'postgres', 'MEMBER') then
    raise exception 'S1 FAILED - authenticator is a member of postgres';
  end if;
  if has_function_privilege('anon', 'public.admin_set_stock(text, uuid, integer, integer, text, text, uuid)', 'EXECUTE') then
    raise exception 'S1 FAILED - anon can execute admin_set_stock';
  end if;
  if has_table_privilege('anon', 'public.products', 'UPDATE') or has_table_privilege('anon', 'public.product_variants', 'INSERT') then
    raise exception 'S1 FAILED - anon can write the stock tables';
  end if;
  raise notice 'S1 ok - authenticator is not a postgres member; anon cannot execute or write';

  -- S2 - the service-role API key cannot forge, rewrite, delete or truncate history
  if has_table_privilege('service_role', 'public.inventory_movements', 'INSERT')
     or has_table_privilege('service_role', 'public.inventory_movements', 'UPDATE')
     or has_table_privilege('service_role', 'public.inventory_movements', 'DELETE')
     or has_table_privilege('service_role', 'public.inventory_movements', 'TRUNCATE')
     or not has_table_privilege('service_role', 'public.inventory_movements', 'SELECT') then
    raise exception 'S2 FAILED - service_role ledger privileges are wrong';
  end if;
  if (select rolcanlogin from pg_roles where rolname = 'service_role')
     or pg_has_role('service_role', 'postgres', 'MEMBER') then
    raise exception 'S2 FAILED - service_role can log in or is a postgres member; revoking grants would not close its paths';
  end if;
  v_moves := pg_temp.moves();
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform pg_temp.expect_fail('S2 insert', $q$insert into public.inventory_movements (product_id, delta, reason, note)
    values ('p1-plain', 1, 'correction', 'forged')$q$, 'permission denied for table inventory_movements%');
  perform pg_temp.expect_fail('S2 update', $q$update public.inventory_movements set note = 'rewritten'$q$, 'permission denied for table inventory_movements%');
  perform pg_temp.expect_fail('S2 delete', $q$delete from public.inventory_movements$q$, 'permission denied for table inventory_movements%');
  perform pg_temp.expect_fail('S2 truncate', $q$truncate public.inventory_movements$q$, 'permission denied for table inventory_movements%');
  perform pg_temp.expect_fail('S2 function', pg_temp.adj_sql('p1-plain', null, 14, 15, 'restock', 'service key', gen_random_uuid()::text),
    'permission denied for function admin_set_stock%');
  perform pg_temp.as_postgres();
  if pg_temp.moves() <> v_moves or exists (select 1 from public.inventory_movements where note = 'rewritten') then
    raise exception 'S2 FAILED - service_role changed the ledger';
  end if;
  raise notice 'S2 ok - service_role (the secret API key) cannot insert, update, delete or truncate the ledger, or call admin_set_stock';

  raise notice 'ALL INVENTORY LEDGER CHECKS PASSED';
end;
$$;

rollback;
