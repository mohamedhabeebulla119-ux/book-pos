-- ============================================================================
-- RLS audit fixes: M-1 (profile INSERT), L-1 (anon writes), L-2 (order
-- deletion), L-3 (append-only order_events / inventory_movements)
-- ----------------------------------------------------------------------------
-- Same architectural note as 20260917130000: `staff`, `admin` and `owner` are
-- rows in public.user_roles, not Postgres roles. Every signed-in session is the
-- single Postgres role `authenticated`, so a GRANT/REVOKE below applies to
-- customers, staff and admins alike. Each revoke was checked against what the
-- application actually writes (src/lib/**) before being added.
--
-- SECURITY DEFINER functions (handle_new_user, admin_set_customer_type,
-- admin_set_price, admin_review_wholesale_request) run as their owner and are
-- not affected by any revoke here. Foreign-key ON DELETE actions (CASCADE /
-- SET NULL) likewise run as the table owner, so they keep working on the
-- tables made append-only below.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- M-1 · profiles INSERT
-- ----------------------------------------------------------------------------
-- A profile row is created exactly once, by public.handle_new_user() (SECURITY
-- DEFINER, trigger on auth.users) with customer_type taking its 'retail'
-- default. No client code inserts into public.profiles.
--
-- Before this migration, "profiles insert own" plus the never-revoked
-- table-level INSERT grant let a signed-in account whose profile row was
-- missing insert its own row with customer_type = 'wholesale_vip', and the
-- existing guard (profiles_guard_privileged_columns) fires on UPDATE only.
-- The row can be missing for an auth user created before migration 02 (there
-- was no backfill) or after an admin deletes a profile row.
--
-- Revoking INSERT from `authenticated` also removes raw-API profile inserts for
-- admins; nothing in the admin panel performs one. The trigger below still
-- exempts admins so any future SECURITY DEFINER admin path keeps working.
-- ----------------------------------------------------------------------------

drop policy if exists "profiles insert own" on public.profiles;

revoke insert on public.profiles from anon, authenticated;

-- Second line of defence, mirroring guard_profile_privileged_columns() for
-- UPDATE: survives someone later re-granting INSERT without thinking it
-- through. auth.uid() IS NULL means no end-user JWT (migration, seed, SQL
-- editor, service_role, or GoTrue creating the user during signup) - trusted.
create or replace function public.guard_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.customer_type   is distinct from 'retail')
  or (new.vip_approved_at is not null)
  or (new.vip_approved_by is not null)
  or (new.vip_expires_at  is not null)
  then
    if (select auth.uid()) is not null and not private.has_role('admin') then
      raise exception
        'customer_type and VIP metadata may only be set by an admin or owner'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.guard_profile_insert() is
  'Refuses a non-admin INSERT into profiles that sets a non-retail tier or VIP metadata.';

drop trigger if exists profiles_guard_insert on public.profiles;
create trigger profiles_guard_insert
  before insert on public.profiles
  for each row execute function public.guard_profile_insert();

-- ORPHANED ACCOUNTS - deliberately NOT run by this migration.
--
-- 1. Check first (SQL editor):
--
--      select count(*) as users_without_profile
--      from auth.users u
--      left join public.profiles p on p.id = u.id
--      where p.id is null;
--
-- 2. Only if that count is > 0, give those accounts their retail profile:
--
--      insert into public.profiles (id, email, full_name)
--      select u.id, u.email, nullif(u.raw_user_meta_data ->> 'full_name', '')
--      from auth.users u
--      left join public.profiles p on p.id = u.id
--      where p.id is null;


-- ----------------------------------------------------------------------------
-- L-1 · anon keeps no write privileges on customer/business tables
-- ----------------------------------------------------------------------------
-- RLS already refuses every one of these (no policy targets anon), so this
-- changes no behaviour; it removes the grants a future `to public` policy
-- would otherwise silently re-open. anon's SELECT is untouched - the catalog,
-- price views and banners depend on it. orders, order_items and payments were
-- already revoked for anon in 20260911131100; wholesale_access_requests in
-- 20260913140000 (repeated here harmlessly).
-- ----------------------------------------------------------------------------

revoke insert, update, delete on
  public.user_roles,
  public.addresses,
  public.carts,
  public.cart_items,
  public.wishlist_items,
  public.order_events,
  public.inventory_movements,
  public.wholesale_access_requests
from anon;

-- INSERT and UPDATE on profiles are already revoked from anon above/earlier.
revoke delete on public.profiles from anon;


-- ----------------------------------------------------------------------------
-- L-2 · order history cannot be deleted from the client
-- ----------------------------------------------------------------------------
-- The admin orders workflow (src/lib/admin/orders.ts) reads orders, updates
-- `status` (column grant from 20260917130000) and inserts an order_events row.
-- It never deletes an order, so this removes no capability in use.
-- ----------------------------------------------------------------------------

revoke delete on public.orders from authenticated;


-- ----------------------------------------------------------------------------
-- L-3 · append-only audit trail and stock ledger
-- ----------------------------------------------------------------------------
-- INSERT is kept on both: the admin panel inserts an order_events row on every
-- status change, and staff record stock movements. Existing rows can no longer
-- be edited or removed through the API.
-- ----------------------------------------------------------------------------

revoke update, delete on public.order_events        from authenticated;
revoke update, delete on public.inventory_movements from authenticated;
