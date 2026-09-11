-- ============================================================================
-- Apple Expert · 11b · admin_set_customer_type() RPC
-- ----------------------------------------------------------------------------
-- SCOPE NOTE: this RPC was not named in the brief, but it is required by it.
-- Migration 12 revokes the column-level UPDATE privilege on
-- profiles.customer_type from the `authenticated` role - and an admin is also
-- `authenticated`, so the revoke blocks admins too. That is intentional: it
-- means there is exactly ONE code path that can grant or revoke VIP status, and
-- it is this role-checked, audited function.
--
-- Without it, "only authorized administration can grant or revoke Wholesale VIP
-- status" would have no mechanism at all.
-- ============================================================================

create or replace function public.admin_set_customer_type(
  p_profile_id    uuid,
  p_customer_type text,
  p_expires_at    timestamptz default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row   public.profiles;
begin
  v_actor := (select auth.uid());

  -- 1. Authorisation.
  if not private.has_role('admin') then
    raise exception 'insufficient_privilege: admin or owner role required'
      using errcode = '42501';
  end if;

  -- 2. Tier must exist. Quantity purchased is never a factor here: VIP is
  --    granted by this call and by nothing else.
  if not exists (select 1 from public.price_tiers t where t.code = p_customer_type) then
    raise exception 'unknown_tier: %', p_customer_type using errcode = '23503';
  end if;

  -- 3. Target must exist.
  if not exists (select 1 from public.profiles pr where pr.id = p_profile_id) then
    raise exception 'unknown_profile: %', p_profile_id using errcode = '23503';
  end if;

  update public.profiles p
     set customer_type   = p_customer_type,
         vip_approved_at = case
                             when p_customer_type = 'retail' then null
                             else coalesce(p.vip_approved_at, now())
                           end,
         vip_approved_by = case
                             when p_customer_type = 'retail' then null
                             else v_actor
                           end,
         vip_expires_at  = case
                             when p_customer_type = 'retail' then null
                             else p_expires_at
                           end,
         updated_at      = now()
   where p.id = p_profile_id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.admin_set_customer_type(uuid, text, timestamptz) is
  'Admin-only grant/revoke of Wholesale VIP status. The only path that can write profiles.customer_type.';

revoke all on function public.admin_set_customer_type(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_set_customer_type(uuid, text, timestamptz)
  to authenticated, service_role;
