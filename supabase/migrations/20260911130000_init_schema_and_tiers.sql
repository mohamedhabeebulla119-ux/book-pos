-- ============================================================================
-- Apple Expert · 01 · private schema, shared helpers, pricing tiers
-- ----------------------------------------------------------------------------
-- The customer app is a static export running in a Capacitor WebView and ships
-- the publishable key inside the APK. There is no server between the device and
-- this database, so RLS is the entire security model. Every table created by
-- these migrations enables it (see migration 12).
-- ============================================================================

-- Private schema holds SECURITY DEFINER helpers that RLS policies call. Keeping
-- them out of `public` means they are never exposed through PostgREST.
create schema if not exists private;

-- anon/authenticated need USAGE only so policies can EXECUTE the helpers.
-- No tables ever live here, so this grants no data access.
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Shared updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger that stamps updated_at.';

-- ----------------------------------------------------------------------------
-- price_tiers
-- ----------------------------------------------------------------------------
-- EXACTLY two tiers. There is deliberately no generic "wholesale" tier: VIP
-- status is granted manually by an owner/admin and is never earned by order
-- quantity. Adding a tier later is an INSERT, not a migration.
-- ----------------------------------------------------------------------------
create table public.price_tiers (
  code        text primary key
              check (code ~ '^[a-z][a-z0-9_]*$'),
  name        text        not null,
  -- is_public = the tier an anonymous shopper may resolve without an account.
  is_public   boolean     not null default false,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger price_tiers_set_updated_at
  before update on public.price_tiers
  for each row execute function public.set_updated_at();

insert into public.price_tiers (code, name, is_public, sort_order) values
  ('retail',        'Retail',        true,  1),
  ('wholesale_vip', 'Wholesale VIP', false, 2);

comment on table public.price_tiers is
  'Pricing tiers. Exactly two at launch: retail (public) and wholesale_vip (private, admin-granted).';
comment on column public.price_tiers.is_public is
  'True when a signed-out visitor may resolve prices in this tier. Only retail is public.';
