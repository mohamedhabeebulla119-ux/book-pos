-- ============================================================================
-- Apple Expert · 03 · SECURITY DEFINER helpers used by RLS policies
-- ----------------------------------------------------------------------------
-- Both functions are SECURITY DEFINER with `set search_path = ''` and live in
-- the private schema.
--
--   * SECURITY DEFINER  - lets a policy on user_roles read user_roles without
--                         recursing into its own policy (the classic Supabase
--                         infinite-recursion bug).
--   * search_path = ''  - closes the search-path hijack; every object below is
--                         schema-qualified as a result.
--   * (select auth.uid()) - the scalar subquery is evaluated ONCE per statement
--                         instead of once per row. On a catalog-wide price join
--                         this is the difference between fast and unusable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- private.has_role(required) - role check with implied seniority
-- ----------------------------------------------------------------------------
--   has_role('staff') is true for staff, admin and owner
--   has_role('admin') is true for admin and owner
--   has_role('owner') is true for owner only
-- ----------------------------------------------------------------------------
create or replace function private.has_role(required text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    where r.profile_id = (select auth.uid())
      and r.role = any (
        case required
          when 'staff' then array['staff', 'admin', 'owner']
          when 'admin' then array['admin', 'owner']
          when 'owner' then array['owner']
          else array[]::text[]
        end
      )
  );
$$;

comment on function private.has_role(text) is
  'True when the caller holds the required role or a more senior one. SECURITY DEFINER to avoid RLS recursion on user_roles.';

-- ----------------------------------------------------------------------------
-- private.current_customer_type() - the caller's pricing tier
-- ----------------------------------------------------------------------------
-- Resolves to 'retail' for:
--   * signed-out (anonymous) callers - auth.uid() is NULL, subquery returns no row
--   * customers whose vip_expires_at has passed - row is filtered out
--
-- The coalesce is load-bearing: without it an anonymous caller would resolve to
-- NULL, every `tier_code = NULL` comparison would be NULL, and the storefront
-- would show no prices at all to signed-out visitors.
--
-- Expiry is evaluated with database now(), never a device clock.
-- ----------------------------------------------------------------------------
create or replace function private.current_customer_type()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.customer_type
      from public.profiles p
      where p.id = (select auth.uid())
        and (p.vip_expires_at is null or p.vip_expires_at > now())
    ),
    'retail'
  );
$$;

comment on function private.current_customer_type() is
  'Caller pricing tier. Anonymous and expired-VIP callers resolve to retail.';

-- Policies are evaluated as the querying role, so that role needs EXECUTE.
revoke all on function private.has_role(text) from public;
revoke all on function private.current_customer_type() from public;

grant execute on function private.has_role(text)
  to authenticated, service_role;
grant execute on function private.current_customer_type()
  to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Now that has_role() exists, arm the profiles guard from migration 02.
-- ----------------------------------------------------------------------------
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();
