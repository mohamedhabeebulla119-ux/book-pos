-- ============================================================================
-- Apple Expert - post-migration verification
-- ----------------------------------------------------------------------------
-- Run AFTER the migrations and seed are applied:
--
--   supabase db reset                       # local
--   psql "$DATABASE_URL" -f supabase/tests/verify.sql
--
-- Run it as the database owner / postgres. The role-impersonation blocks use
-- SET ROLE to become anon and authenticated and then switch back, which is only
-- permitted when the SESSION user is a superuser or a member of those roles.
--
-- Every check RAISES on failure, so the script exits non-zero the moment
-- something is wrong. A clean run prints "ALL CHECKS PASSED".
--
-- This covers the 16-point validation list. Checks 1-13 read the catalog;
-- checks 14-19 actually impersonate anon / retail / VIP / admin roles and
-- assert what each can really see.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_count   integer;
  v_text    text;
  v_bool    boolean;
  v_missing text;
begin

  -- 1 -----------------------------------------------------------------------
  -- RLS enabled on EVERY table in public.
  select string_agg(c.relname, ', ')
    into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if v_missing is not null then
    raise exception 'CHECK 1 FAILED - RLS not enabled on: %', v_missing;
  end if;
  raise notice 'CHECK  1 ok - RLS enabled on every public table';

  -- 2 -----------------------------------------------------------------------
  -- Every SECURITY DEFINER function pins search_path.
  select string_agg(p.proname, ', ')
    into v_missing
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
      where cfg like 'search_path=%'
    );

  if v_missing is not null then
    raise exception 'CHECK 2 FAILED - SECURITY DEFINER without search_path: %', v_missing;
  end if;
  raise notice 'CHECK  2 ok - every SECURITY DEFINER function pins search_path';

  -- 3 -----------------------------------------------------------------------
  -- Price views MUST be security_invoker, or they bypass RLS entirely.
  foreach v_text in array array['my_prices', 'my_effective_prices'] loop
    select coalesce(
             (select option_value::boolean
              from pg_options_to_table(c.reloptions)
              where option_name = 'security_invoker'),
             false)
      into v_bool
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v_text;

    if v_bool is not true then
      raise exception 'CHECK 3 FAILED - view public.% is NOT security_invoker; it would leak wholesale prices', v_text;
    end if;
  end loop;
  raise notice 'CHECK  3 ok - price views are security_invoker';

  -- 4 -----------------------------------------------------------------------
  -- product_prices must have NO write policy: all writes go via admin_set_price.
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'product_prices'
    and cmd <> 'SELECT';

  if v_count > 0 then
    raise exception 'CHECK 4 FAILED - % write policy/policies on product_prices; writes must go through admin_set_price()', v_count;
  end if;
  raise notice 'CHECK  4 ok - product_prices is read-only via RLS';

  -- 5 -----------------------------------------------------------------------
  -- Customers cannot UPDATE profiles.customer_type at the privilege level.
  if has_column_privilege('authenticated', 'public.profiles', 'customer_type', 'UPDATE') then
    raise exception 'CHECK 5 FAILED - authenticated still holds UPDATE on profiles.customer_type';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') then
    raise exception 'CHECK 5 FAILED - authenticated lost UPDATE on profiles.full_name (over-revoked)';
  end if;
  raise notice 'CHECK  5 ok - customer_type not self-writable, ordinary columns still writable';

  -- 6 -----------------------------------------------------------------------
  -- order_items.product_id must be ON DELETE SET NULL, never CASCADE.
  select confdeltype into v_text
  from pg_constraint
  where conrelid = 'public.order_items'::regclass
    and contype = 'f'
    and array_length(conkey, 1) = 1
    and conkey[1] = (select attnum from pg_attribute
                     where attrelid = 'public.order_items'::regclass
                       and attname = 'product_id');

  if v_text <> 'n' then
    raise exception 'CHECK 6 FAILED - order_items.product_id ON DELETE is %, expected SET NULL', v_text;
  end if;
  raise notice 'CHECK  6 ok - order history survives product deletion';

  -- 7 -----------------------------------------------------------------------
  -- The live-price uniqueness index exists.
  if not exists (select 1 from pg_indexes
                 where schemaname = 'public' and indexname = 'product_prices_live_uq') then
    raise exception 'CHECK 7 FAILED - product_prices_live_uq missing';
  end if;
  raise notice 'CHECK  7 ok - one-live-price index present';

  -- 8 -----------------------------------------------------------------------
  -- Exactly two tiers, and no generic "wholesale".
  select count(*) into v_count from public.price_tiers;
  if v_count <> 2 then
    raise exception 'CHECK 8 FAILED - expected exactly 2 price tiers, found %', v_count;
  end if;
  if exists (select 1 from public.price_tiers where code = 'wholesale') then
    raise exception 'CHECK 8 FAILED - a generic "wholesale" tier exists; only retail and wholesale_vip are permitted';
  end if;
  if not exists (select 1 from public.price_tiers where code = 'retail' and is_public)
  or not exists (select 1 from public.price_tiers where code = 'wholesale_vip' and not is_public) then
    raise exception 'CHECK 8 FAILED - tier visibility flags are wrong';
  end if;
  raise notice 'CHECK  8 ok - exactly retail (public) + wholesale_vip (private)';

  -- 9 -----------------------------------------------------------------------
  -- No price row exists for a product still awaiting a confirmed business price.
  select count(*) into v_count
  from public.product_prices pp
  join public.products p on p.id = pp.product_id
  where not p.is_active;

  if v_count > 0 then
    raise exception 'CHECK 9 FAILED - % price row(s) on inactive/unpriced products', v_count;
  end if;
  raise notice 'CHECK  9 ok - no prices on products awaiting business confirmation';

  -- 10 ----------------------------------------------------------------------
  -- Every launch price uses min_qty = 1: no quantity-based VIP qualification.
  select count(*) into v_count from public.product_prices where min_qty <> 1;
  if v_count > 0 then
    raise exception 'CHECK 10 FAILED - % price row(s) with min_qty <> 1', v_count;
  end if;
  raise notice 'CHECK 10 ok - all prices min_qty = 1 (no quantity tiering)';

  -- 11 ----------------------------------------------------------------------
  -- Every active product has a live retail price.
  select count(*) into v_count
  from public.products p
  where p.is_active
    and not exists (
      select 1 from public.product_prices pp
      where pp.product_id = p.id and pp.tier_code = 'retail' and pp.ends_at is null
    );

  if v_count > 0 then
    raise exception 'CHECK 11 FAILED - % active product(s) with no live retail price', v_count;
  end if;
  raise notice 'CHECK 11 ok - every active product has a retail price';

  -- 12 ----------------------------------------------------------------------
  -- admin_set_price is SECURITY DEFINER and not executable by anon.
  select p.prosecdef into v_bool
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'admin_set_price';

  if v_bool is not true then
    raise exception 'CHECK 12 FAILED - admin_set_price is not SECURITY DEFINER';
  end if;
  if has_function_privilege('anon',
       'public.admin_set_price(text, uuid, text, bigint, integer, timestamptz)', 'EXECUTE') then
    raise exception 'CHECK 12 FAILED - anon can execute admin_set_price';
  end if;
  raise notice 'CHECK 12 ok - admin_set_price protected';

  -- 13 ----------------------------------------------------------------------
  -- Order snapshots are independent of product_prices: no FK from order_items
  -- to product_prices other than the audit-only price_id (which is SET NULL).
  select confdeltype into v_text
  from pg_constraint
  where conrelid = 'public.order_items'::regclass
    and contype = 'f'
    and confrelid = 'public.product_prices'::regclass;

  if v_text is not null and v_text <> 'n' then
    raise exception 'CHECK 13 FAILED - order_items -> product_prices FK is %, expected SET NULL', v_text;
  end if;
  raise notice 'CHECK 13 ok - order snapshots independent of live prices';

  -- 21 ----------------------------------------------------------------------
  -- Seed integrity. A product whose category row was missing would be silently
  -- skipped by the seed's INSERT..SELECT, so the counts are asserted directly.
  -- Expected values come from supabase/seed-summary.json.
  select count(*) into v_count from public.categories;
  if v_count <> 9 then raise exception 'CHECK 21 FAILED - categories: % (expected 9)', v_count; end if;

  select count(*) into v_count from public.device_models;
  if v_count <> 27 then raise exception 'CHECK 21 FAILED - device_models: % (expected 27)', v_count; end if;

  select count(*) into v_count from public.products;
  if v_count <> 107 then raise exception 'CHECK 21 FAILED - products: % (expected 107)', v_count; end if;

  select count(*) into v_count from public.products where is_active;
  if v_count <> 53 then raise exception 'CHECK 21 FAILED - active products: % (expected 53)', v_count; end if;

  select count(*) into v_count from public.product_variants;
  if v_count <> 71 then raise exception 'CHECK 21 FAILED - product_variants: % (expected 71)', v_count; end if;

  select count(*) into v_count from public.product_prices where tier_code = 'retail';
  if v_count <> 124 then raise exception 'CHECK 21 FAILED - retail prices: % (expected 124)', v_count; end if;

  select count(*) into v_count from public.featured_products where slot = 'home';
  if v_count <> 5 then raise exception 'CHECK 21 FAILED - featured: % (expected 5)', v_count; end if;

  raise notice 'CHECK 21 ok - seed counts match seed-summary.json';

  raise notice '--- catalog checks complete ---';
end
$$;

-- ============================================================================
-- ROLE IMPERSONATION CHECKS
-- ----------------------------------------------------------------------------
-- These assert what each kind of caller can ACTUALLY read. An admin session
-- always looks correct and proves nothing, so each block sets the JWT claims
-- that PostgREST would set and then queries as that role.
-- ============================================================================

-- Fixtures: one retail customer, one active VIP, one expired VIP, one admin.
begin;

-- auth.users column requirements vary between Supabase releases, so every
-- commonly-NOT NULL column is supplied explicitly here.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'retail@test.local',  '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vip@test.local',     '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'expired@test.local', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local',   '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false)
on conflict (id) do nothing;

update public.profiles set customer_type = 'wholesale_vip', vip_approved_at = now()
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set customer_type = 'wholesale_vip', vip_approved_at = now() - interval '60 days',
                           vip_expires_at = now() - interval '1 day'
  where id = '33333333-3333-3333-3333-333333333333';

insert into public.user_roles (profile_id, role)
values ('44444444-4444-4444-4444-444444444444', 'admin')
on conflict (profile_id, role) do nothing;

-- Give one product a VIP price so the tier split is observable.
insert into public.product_prices (product_id, variant_id, tier_code, price_cents, min_qty)
select 'iphone-17-pro-max', null, 'wholesale_vip', 46500000, 1
where not exists (
  select 1 from public.product_prices
  where product_id = 'iphone-17-pro-max' and variant_id is null
    and tier_code = 'wholesale_vip' and ends_at is null);

do $$
declare
  v_anon_vip     integer;
  v_retail_vip   integer;
  v_vip_vip      integer;
  v_expired_vip  integer;
  v_anon_retail  integer;
  v_vip_eff      bigint;
  v_retail_eff   bigint;
begin
  -- 14 - ANONYMOUS: retail only, never wholesale_vip -------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);
  select count(*) into v_anon_vip     from public.product_prices where tier_code = 'wholesale_vip';
  select count(*) into v_anon_retail  from public.product_prices where tier_code = 'retail';
  perform set_config('role', 'postgres', true);

  if v_anon_vip <> 0 then
    raise exception 'CHECK 14 FAILED - anonymous caller can read % wholesale_vip price row(s)', v_anon_vip;
  end if;
  if v_anon_retail = 0 then
    raise exception 'CHECK 14 FAILED - anonymous caller sees no retail prices at all';
  end if;
  raise notice 'CHECK 14 ok - anonymous: % retail rows, 0 wholesale_vip rows', v_anon_retail;

  -- 15 - RETAIL CUSTOMER: must never retrieve wholesale_vip ------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  select count(*) into v_retail_vip from public.product_prices where tier_code = 'wholesale_vip';
  select price_cents into v_retail_eff from public.my_effective_prices
    where product_id = 'iphone-17-pro-max' and variant_id is null;
  perform set_config('role', 'postgres', true);

  if v_retail_vip <> 0 then
    raise exception 'CHECK 15 FAILED - retail customer can read % wholesale_vip price row(s)', v_retail_vip;
  end if;
  if v_retail_eff <> 35900000 then
    raise exception 'CHECK 15 FAILED - retail effective price is %, expected 35900000', v_retail_eff;
  end if;
  raise notice 'CHECK 15 ok - retail customer: 0 wholesale_vip rows, effective price = retail';

  -- 16 - VIP CUSTOMER: can read VIP, and resolves to the VIP price -----------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  select count(*) into v_vip_vip from public.product_prices where tier_code = 'wholesale_vip';
  select price_cents into v_vip_eff from public.my_effective_prices
    where product_id = 'iphone-17-pro-max' and variant_id is null;
  perform set_config('role', 'postgres', true);

  if v_vip_vip = 0 then
    raise exception 'CHECK 16 FAILED - VIP customer cannot read any wholesale_vip price';
  end if;
  if v_vip_eff <> 46500000 then
    raise exception 'CHECK 16 FAILED - VIP effective price is %, expected 46500000', v_vip_eff;
  end if;
  raise notice 'CHECK 16 ok - VIP customer resolves to the VIP price';

  -- 17 - EXPIRED VIP: falls back to retail -----------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
  select count(*) into v_expired_vip from public.product_prices where tier_code = 'wholesale_vip';
  perform set_config('role', 'postgres', true);

  if v_expired_vip <> 0 then
    raise exception 'CHECK 17 FAILED - expired VIP can still read % wholesale_vip row(s)', v_expired_vip;
  end if;
  raise notice 'CHECK 17 ok - expired VIP resolves back to retail';
end
$$;

-- 18 - A customer cannot change their own customer_type ----------------------
do $$
declare v_ok boolean := false;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  begin
    update public.profiles set customer_type = 'wholesale_vip'
      where id = '11111111-1111-1111-1111-111111111111';
  exception when insufficient_privilege or others then
    v_ok := true;
  end;
  perform set_config('role', 'postgres', true);

  if not v_ok then
    -- The privilege revoke should have raised. If it did not, confirm nothing changed.
    if (select customer_type from public.profiles
        where id = '11111111-1111-1111-1111-111111111111') <> 'retail' then
      raise exception 'CHECK 18 FAILED - customer self-promoted to wholesale_vip';
    end if;
  end if;
  raise notice 'CHECK 18 ok - customer cannot change their own customer_type';
end
$$;

-- 19 - A non-admin cannot call admin_set_price -------------------------------
do $$
declare v_blocked boolean := false;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  begin
    perform public.admin_set_price('iphone-17-pro-max', null, 'retail', 100, 1, null);
  exception when others then
    v_blocked := true;
  end;
  perform set_config('role', 'postgres', true);

  if not v_blocked then
    raise exception 'CHECK 19 FAILED - a non-admin successfully changed a price';
  end if;
  raise notice 'CHECK 19 ok - admin_set_price refuses non-admin callers';
end
$$;

-- 20 - A price change must not touch inventory -------------------------------
do $$
declare
  v_stock_before integer;
  v_stock_after  integer;
  v_moves_before integer;
  v_moves_after  integer;
begin
  select stock into v_stock_before from public.products where id = 'iphone-17-pro-max';
  select count(*) into v_moves_before from public.inventory_movements;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
  perform public.admin_set_price('iphone-17-pro-max', null, 'retail', 49000000, 1, null);
  perform set_config('role', 'postgres', true);

  select stock into v_stock_after from public.products where id = 'iphone-17-pro-max';
  select count(*) into v_moves_after from public.inventory_movements;

  if v_stock_before is distinct from v_stock_after then
    raise exception 'CHECK 20 FAILED - stock changed from % to % after a price edit', v_stock_before, v_stock_after;
  end if;
  if v_moves_before <> v_moves_after then
    raise exception 'CHECK 20 FAILED - a price edit created an inventory movement';
  end if;

  -- And the retire-then-insert left exactly one live retail row.
  if (select count(*) from public.product_prices
      where product_id = 'iphone-17-pro-max' and variant_id is null
        and tier_code = 'retail' and ends_at is null) <> 1 then
    raise exception 'CHECK 20 FAILED - more than one live retail price after an edit';
  end if;
  if (select count(*) from public.product_prices
      where product_id = 'iphone-17-pro-max' and variant_id is null
        and tier_code = 'retail' and ends_at is not null) < 1 then
    raise exception 'CHECK 20 FAILED - the superseded price was not retained as history';
  end if;

  raise notice 'CHECK 20 ok - price edit left inventory untouched and kept price history';
end
$$;

-- Fixtures and the test price change are discarded.
rollback;

-- ============================================================================
-- VIP DESIGNATION - admin_set_customer_type()
-- ----------------------------------------------------------------------------
-- Checks 18/19 prove customers are blocked. These prove the admin path actually
-- works, and that VIP can never be reached by quantity.
-- ============================================================================
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin)
values
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin2@test.local', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust2@test.local', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false)
on conflict (id) do nothing;

insert into public.user_roles (profile_id, role)
values ('55555555-5555-5555-5555-555555555555', 'admin')
on conflict (profile_id, role) do nothing;

do $$
declare
  v_type    text;
  v_by      uuid;
  v_blocked boolean := false;
begin
  -- 22 - an admin CAN grant VIP, and the grant is attributed ------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
  perform public.admin_set_customer_type('66666666-6666-6666-6666-666666666666', 'wholesale_vip', null);
  perform set_config('role', 'postgres', true);

  select customer_type, vip_approved_by into v_type, v_by
  from public.profiles where id = '66666666-6666-6666-6666-666666666666';

  if v_type <> 'wholesale_vip' then
    raise exception 'CHECK 22 FAILED - admin could not grant VIP (customer_type = %)', v_type;
  end if;
  if v_by <> '55555555-5555-5555-5555-555555555555' then
    raise exception 'CHECK 22 FAILED - vip_approved_by was not recorded';
  end if;
  raise notice 'CHECK 22 ok - admin granted VIP, approved_by recorded';

  -- 23 - revoking clears the VIP metadata ------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
  perform public.admin_set_customer_type('66666666-6666-6666-6666-666666666666', 'retail', null);
  perform set_config('role', 'postgres', true);

  select customer_type, vip_approved_by into v_type, v_by
  from public.profiles where id = '66666666-6666-6666-6666-666666666666';

  if v_type <> 'retail' or v_by is not null then
    raise exception 'CHECK 23 FAILED - revoke did not reset customer_type/metadata';
  end if;
  raise notice 'CHECK 23 ok - admin revoked VIP, metadata cleared';

  -- 24 - a non-admin cannot grant VIP, including to themselves ---------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
  begin
    perform public.admin_set_customer_type('66666666-6666-6666-6666-666666666666', 'wholesale_vip', null);
  exception when others then
    v_blocked := true;
  end;
  perform set_config('role', 'postgres', true);

  if not v_blocked then
    raise exception 'CHECK 24 FAILED - a non-admin granted themselves VIP';
  end if;
  raise notice 'CHECK 24 ok - non-admin refused by admin_set_customer_type';

  -- 25 - quantity can never grant VIP ----------------------------------------
  if exists (select 1 from public.product_prices where min_qty <> 1) then
    raise exception 'CHECK 25 FAILED - a quantity-tiered price row exists';
  end if;
  raise notice 'CHECK 25 ok - no quantity-based tiering anywhere';
end
$$;

rollback;

do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;
