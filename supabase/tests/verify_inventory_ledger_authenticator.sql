-- ============================================================================
-- Apple Expert - P1 stock guard through the real API login (authenticator)
-- ----------------------------------------------------------------------------
-- PostgREST logs in as authenticator and switches to anon / authenticated per
-- request. This suite does exactly that, so SECURITY DEFINER functions run with
-- session_user = authenticator and are NOT operator sessions - which is what
-- proves the guard does not trust a function just because postgres owns it.
--
-- LOCAL ONLY. It commits fixtures (a second login cannot see an uncommitted
-- transaction) and removes them at the end and at the start of every run.
--
--   docker exec -i supabase_db_apple-expert psql -U postgres \
--     < supabase/tests/verify_inventory_ledger_authenticator.sql
--
-- The authenticator login uses the container's loopback, which the local
-- stack's pg_hba trusts. A clean run ends with
-- "ALL AUTHENTICATOR STOCK GUARD CHECKS PASSED".
-- ============================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Setup as postgres (committed)
-- ---------------------------------------------------------------------------
-- Cleanup (same as verify_inventory_ledger_authenticator_cleanup.sql)
begin;
delete from public.inventory_movements where product_id in ('p1-api', 'p1-conc', 'p1-conc-b');
update public.product_variants set stock = 0 where product_id in ('p1-api', 'p1-conc', 'p1-conc-b') and stock is not null;
update public.products set stock = 0 where id in ('p1-api', 'p1-conc', 'p1-conc-b');
delete from public.products where id in ('p1-api', 'p1-conc', 'p1-conc-b');
drop function if exists public.p1_test_unrecorded_write(integer);
drop function if exists public.p1_test_mismatched_write();
delete from auth.users where id in ('f5555555-5555-5555-5555-555555555555', 'f6666666-6666-6666-6666-666666666666');
commit;

begin;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin)
values ('f5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'inv-api-admin@test.local', '',
        now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false);
insert into public.user_roles (profile_id, role) values ('f5555555-5555-5555-5555-555555555555', 'admin');

insert into public.products (id, name, category_id, subcategory, stock, is_active)
values ('p1-api', 'P1 API fixture', (select id from public.categories where slug = 'accessories'),
        'Other Accessories', 10, false);

-- A postgres-owned SECURITY DEFINER function that changes stock WITHOUT a
-- ledger row. The guard must refuse it.
create function public.p1_test_unrecorded_write(p_qty integer) returns void
language sql security definer set search_path = ''
as $$ update public.products set stock = p_qty where id = 'p1-api' $$;

-- One that writes a ledger row which does NOT match the change it makes.
create function public.p1_test_mismatched_write() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.inventory_movements (product_id, delta, reason, note, quantity_before, quantity_after)
  values ('p1-api', 1, 'correction', 'mismatch', 10, 11);
  update public.products set stock = 13 where id = 'p1-api';
end $$;

grant execute on function public.p1_test_unrecorded_write(integer), public.p1_test_mismatched_write() to authenticated;
commit;

-- ---------------------------------------------------------------------------
-- As the API: login authenticator, role authenticated, admin claims
-- ---------------------------------------------------------------------------
\connect "host=127.0.0.1 dbname=postgres user=authenticator"

begin;
select set_config('request.jwt.claims', '{"sub":"f5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_ok boolean;
begin
  if session_user <> 'authenticator' or current_user <> 'authenticated'
     or pg_has_role(session_user, 'postgres', 'MEMBER') then
    raise exception 'A1 FAILED - not running as the API would (session %, current %)', session_user, current_user;
  end if;
  raise notice 'A1 ok - session_user authenticator, current_user authenticated, not a postgres member';

  -- A2 direct update
  v_ok := false;
  begin
    update public.products set stock = 11 where id = 'p1-api';
  exception when insufficient_privilege then
    v_ok := sqlerrm like 'stock_locked:%';
  end;
  if not v_ok then raise exception 'A2 FAILED - direct stock update was not refused with stock_locked'; end if;
  raise notice 'A2 ok - direct stock update refused';

  -- A3 postgres-owned SECURITY DEFINER, no ledger row
  v_ok := false;
  begin
    perform public.p1_test_unrecorded_write(55);
  exception when insufficient_privilege then
    v_ok := sqlerrm like 'stock_locked:%';
  end;
  if not v_ok then raise exception 'A3 FAILED - an unrecorded write from a postgres-owned definer function was not refused'; end if;
  raise notice 'A3 ok - postgres-owned SECURITY DEFINER function without a ledger row refused';

  -- A4 postgres-owned SECURITY DEFINER, ledger row that does not match
  v_ok := false;
  begin
    perform public.p1_test_mismatched_write();
  exception when insufficient_privilege then
    v_ok := sqlerrm like 'stock_locked:%';
  end;
  if not v_ok then raise exception 'A4 FAILED - a write with a non-matching ledger row was not refused'; end if;
  raise notice 'A4 ok - a ledger row that does not match the change does not authorise it';

  -- A5 a client cannot become postgres
  v_ok := false;
  begin
    execute 'set role postgres';
  exception when insufficient_privilege then
    v_ok := true;
  end;
  if not v_ok then raise exception 'A5 FAILED - authenticated could SET ROLE postgres'; end if;
  raise notice 'A5 ok - SET ROLE postgres refused';
end $$;
commit;

-- A6 the approved function succeeds through the same login (committed)
begin;
select set_config('request.jwt.claims', '{"sub":"f5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
set local role authenticated;
select 'A6 result: ' || public.admin_set_stock('p1-api', null, 10, 12, 'stock_count', 'A6 via authenticator',
                                               'c0000000-0000-0000-0000-000000000006')::text;
commit;

-- A7 a successful call in a transaction that is then rolled back leaves nothing
begin;
select set_config('request.jwt.claims', '{"sub":"f5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
set local role authenticated;
select 'A7 inside: ' || (public.admin_set_stock('p1-api', null, 12, 15, 'restock', 'A7 rolled back',
                                                'c0000000-0000-0000-0000-000000000007') ->> 'quantity_after');
rollback;

-- ---------------------------------------------------------------------------
-- Verify as postgres, then clean up
-- ---------------------------------------------------------------------------
\connect "dbname=postgres user=postgres"

do $$
declare
  v_stock integer;
  v_rows  integer;
  v_m     public.inventory_movements;
begin
  select stock into v_stock from public.products where id = 'p1-api';
  select count(*) into v_rows from public.inventory_movements where product_id = 'p1-api';
  select * into v_m from public.inventory_movements where request_id = 'c0000000-0000-0000-0000-000000000006';

  if v_stock <> 12 or v_rows <> 1 then
    raise exception 'A6/A7 FAILED - expected stock 12 and 1 ledger row, got % and %', v_stock, v_rows;
  end if;
  if v_m.actor_id <> 'f5555555-5555-5555-5555-555555555555' or v_m.quantity_before <> 10 or v_m.quantity_after <> 12 then
    raise exception 'A6 FAILED - ledger row %', row_to_json(v_m);
  end if;
  if exists (select 1 from public.inventory_movements where request_id = 'c0000000-0000-0000-0000-000000000007') then
    raise exception 'A7 FAILED - a rolled-back adjustment left a ledger row';
  end if;
  raise notice 'A6 ok - admin_set_stock through the API login changed stock 10 -> 12 with one ledger row (real actor)';
  raise notice 'A7 ok - a rolled-back transaction left neither the stock change nor its ledger row; A2-A4 left stock untouched';
  raise notice 'ALL AUTHENTICATOR STOCK GUARD CHECKS PASSED';
end $$;

-- Cleanup (same as verify_inventory_ledger_authenticator_cleanup.sql)
begin;
delete from public.inventory_movements where product_id in ('p1-api', 'p1-conc', 'p1-conc-b');
update public.product_variants set stock = 0 where product_id in ('p1-api', 'p1-conc', 'p1-conc-b') and stock is not null;
update public.products set stock = 0 where id in ('p1-api', 'p1-conc', 'p1-conc-b');
delete from public.products where id in ('p1-api', 'p1-conc', 'p1-conc-b');
drop function if exists public.p1_test_unrecorded_write(integer);
drop function if exists public.p1_test_mismatched_write();
delete from auth.users where id in ('f5555555-5555-5555-5555-555555555555', 'f6666666-6666-6666-6666-666666666666');
commit;
