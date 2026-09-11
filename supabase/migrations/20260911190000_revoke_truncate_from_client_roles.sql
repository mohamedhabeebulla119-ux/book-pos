-- ============================================================================
-- Apple Expert · 13 · security hardening: revoke TRUNCATE from client roles
-- ----------------------------------------------------------------------------
-- FINDING (from the Admin Pricing security audit)
--
-- Supabase's default privileges grant ALL on new tables in `public` to `anon`
-- and `authenticated`. ALL includes TRUNCATE, and the earlier migrations only
-- revoked INSERT/UPDATE/DELETE where those needed locking down.
--
-- TRUNCATE is NOT subject to row level security. A role holding it can empty a
-- table outright regardless of every policy protecting it. It is not reachable
-- through PostgREST today — that API only issues SELECT/INSERT/UPDATE/DELETE
-- and RPC — so this is defence in depth rather than an open door, but the grant
-- should not exist: the publishable key ships inside the Android APK, and the
-- only thing standing between that key and the data is the privilege system
-- plus RLS.
--
-- THIS MIGRATION IS NON-DESTRUCTIVE. It changes privileges only. It creates,
-- alters and drops nothing, touches no row of data, and leaves every RLS policy
-- exactly as it was.
--
-- service_role, postgres and the Supabase internal roles are deliberately NOT
-- touched — backups, restores and administrative tooling rely on them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The 22 tables created by this schema.
-- ----------------------------------------------------------------------------
-- Enumerated from the CREATE TABLE statements in migrations 01-12, not guessed.
-- REVOKE on a privilege a role does not hold is a no-op, so this is idempotent
-- and safe to re-run.
-- ----------------------------------------------------------------------------
revoke truncate on table
  public.addresses,
  public.banners,
  public.cart_items,
  public.carts,
  public.categories,
  public.device_models,
  public.featured_products,
  public.inventory_movements,
  public.order_events,
  public.order_items,
  public.orders,
  public.payments,
  public.price_tiers,
  public.product_compatibility,
  public.product_images,
  public.product_prices,
  public.product_specs,
  public.product_variants,
  public.products,
  public.profiles,
  public.user_roles,
  public.wishlist_items
from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. The two price views.
-- ----------------------------------------------------------------------------
-- A view cannot be truncated at all, so this carries no security weight; it is
-- here only so that "no client role holds TRUNCATE anywhere in public" is true
-- without exceptions, which keeps the check in step 4 simple.
-- ----------------------------------------------------------------------------
revoke truncate on table
  public.my_prices,
  public.my_effective_prices
from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Stop future tables from reintroducing the grant.
-- ----------------------------------------------------------------------------
-- Default privileges are recorded per creating role, and this project has two:
-- `postgres` and `supabase_admin`. Without this, the very next migration that
-- creates a table would hand TRUNCATE straight back to anon and authenticated.
--
-- ALTER DEFAULT PRIVILEGES FOR ROLE requires membership in that role, which the
-- migration runner may not have on a hosted project. Each statement is therefore
-- attempted independently and a privilege failure is downgraded to a notice —
-- hardening the existing tables (steps 1-2) must never be blocked by not being
-- able to harden future ones.
-- ----------------------------------------------------------------------------
do $$
declare
  r text;
begin
  foreach r in array array['postgres', 'supabase_admin'] loop
    begin
      execute format(
        'alter default privileges for role %I in schema public revoke truncate on tables from anon, authenticated',
        r
      );
      raise notice 'default privileges hardened for role %', r;
    exception
      when insufficient_privilege or undefined_object then
        raise notice 'skipped default privileges for role % (not permitted here) - new tables must revoke TRUNCATE explicitly', r;
    end;
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 4. Self-verification.
-- ----------------------------------------------------------------------------
-- Fails the migration loudly if any client-role TRUNCATE grant survives, so a
-- table added to the schema without being added to the list above cannot slip
-- through unnoticed.
-- ----------------------------------------------------------------------------
do $$
declare
  leftovers text;
  preserved integer;
begin
  select string_agg(distinct g.table_name, ', ')
    into leftovers
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.privilege_type = 'TRUNCATE'
    and g.grantee in ('anon', 'authenticated');

  if leftovers is not null then
    raise exception 'TRUNCATE still granted to a client role on: %', leftovers;
  end if;

  -- service_role must keep TRUNCATE; losing it would break admin tooling.
  select count(*) into preserved
  from information_schema.role_table_grants
  where table_schema = 'public'
    and privilege_type = 'TRUNCATE'
    and grantee = 'service_role';

  if preserved = 0 then
    raise exception 'service_role lost TRUNCATE - this migration over-revoked';
  end if;

  raise notice 'verified: 0 client-role TRUNCATE grants, % service_role grants preserved', preserved;
end
$$;
