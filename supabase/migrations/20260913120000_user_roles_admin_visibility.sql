-- ============================================================================
-- Apple Expert · 15 · user_roles visibility for the admin panel + owner safety
-- ----------------------------------------------------------------------------
-- WHY THIS MIGRATION EXISTS
--
-- Migration 12 gave user_roles exactly two policies:
--
--   "user_roles read own"   select where profile_id = auth.uid()
--   "user_roles owner all"  all      where private.has_role('owner')
--
-- That is correct for the storefront, but it means an ADMIN or STAFF member
-- signed into /admin/users can read only their OWN grant. The Users workspace
-- has to render a Role column and filter by Staff / Admin / Owner, and without
-- a read path it would show every colleague as a plain customer - i.e. it would
-- state something false rather than something incomplete.
--
-- WHAT THIS CHANGES, AND WHAT IT DOES NOT
--
--   * Adds ONE select-only policy, mirroring the "profiles staff read" policy
--     that already exists one table over. Staff/admin/owner may now SEE who
--     holds a role.
--   * Does NOT touch who may WRITE. "user_roles owner all" remains the only
--     insert/update/delete path, so granting and revoking administrator access
--     is still owner-only.
--   * Grants nothing to anon, and nothing to a customer: a signed-in shopper
--     still falls through to "user_roles read own" and sees only their own row.
-- ============================================================================

create policy "user_roles staff read" on public.user_roles
  for select to authenticated using (private.has_role('staff'));

-- ----------------------------------------------------------------------------
-- Last-owner guard
-- ----------------------------------------------------------------------------
-- The admin panel can now revoke roles, which makes a previously unreachable
-- failure reachable: remove the final owner grant and NOBODY can ever grant a
-- role again, because "user_roles owner all" is the only write path and there
-- is no server or service-role key in this deployment to repair it from.
--
-- This strengthens the existing model rather than relaxing it - the UI also
-- refuses the action, and this is the copy of that rule that a tampered client
-- cannot skip.
-- ----------------------------------------------------------------------------
create or replace function public.guard_last_owner_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other_owners integer;
begin
  -- NEW is unassigned on a DELETE, and SQL's OR is not guaranteed to
  -- short-circuit, so every branch that reads NEW sits behind a TG_OP test.
  if tg_op = 'UPDATE' then
    -- The row survives as an owner grant for the same person: nothing is lost.
    if new.role = 'owner' and new.profile_id = old.profile_id then
      return new;
    end if;
  end if;

  -- Only the disappearance of an owner grant can strand the store.
  if old.role <> 'owner' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select count(*) into v_other_owners
  from public.user_roles r
  where r.role = 'owner'
    and r.id <> old.id;

  if v_other_owners = 0 then
    raise exception
      'last_owner: the final owner grant cannot be removed - promote another owner first'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

comment on function public.guard_last_owner_role() is
  'Refuses any change that would leave public.user_roles with no owner grant.';

create trigger user_roles_guard_last_owner
  before update or delete on public.user_roles
  for each row execute function public.guard_last_owner_role();
