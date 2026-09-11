-- ============================================================================
-- Apple Expert · 02 · profiles, user_roles, addresses
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key
                    references auth.users (id) on delete cascade,
  full_name         text,
  email             text,
  phone             text,
  avatar_url        text,

  -- Which pricing tier this customer buys at. Defaults to retail.
  -- Customers cannot write this column: migration 12 revokes the column-level
  -- UPDATE privilege and a trigger below blocks it as a second line of defence.
  customer_type     text not null default 'retail'
                    references public.price_tiers (code) on delete restrict,

  -- VIP designation metadata. vip_expires_at NULL = permanent until revoked,
  -- which matches "manually designated by an authorized owner/admin".
  vip_approved_at   timestamptz,
  vip_approved_by   uuid references public.profiles (id) on delete set null,
  vip_expires_at    timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

comment on table public.profiles is
  'Customer profile, one row per auth user. customer_type drives price resolution.';
comment on column public.profiles.customer_type is
  'retail | wholesale_vip. Never writable by the customer - admin/owner only.';
comment on column public.profiles.vip_expires_at is
  'NULL means VIP does not expire. A past value resolves the customer back to retail.';

-- ----------------------------------------------------------------------------
-- user_roles — deliberately NOT a column on profiles
-- ----------------------------------------------------------------------------
-- A role stored on a table the user can update is not a role. Keeping grants in
-- their own table lets RLS lock writes to owners without locking the whole
-- profile row.
-- ----------------------------------------------------------------------------
create table public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('owner', 'admin', 'staff')),
  granted_by  uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),
  unique (profile_id, role)
);

comment on table public.user_roles is
  'Staff/admin/owner grants. Read by private.has_role() inside RLS policies.';

-- ----------------------------------------------------------------------------
-- addresses
-- ----------------------------------------------------------------------------
create table public.addresses (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  label        text,
  line1        text not null,
  line2        text,
  city         text not null,
  district     text,
  postal_code  text,
  phone        text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- At most one default address per customer.
create unique index addresses_one_default_uq
  on public.addresses (profile_id)
  where is_default;

-- ----------------------------------------------------------------------------
-- Auto-create a profile when an auth user is created
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Second line of defence on customer_type / VIP metadata
-- ----------------------------------------------------------------------------
-- Migration 12 revokes column-level UPDATE from anon/authenticated, which is the
-- primary control. This trigger survives someone later re-granting UPDATE on the
-- whole table without thinking it through.
-- ----------------------------------------------------------------------------
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.customer_type   is distinct from old.customer_type)
  or (new.vip_approved_at is distinct from old.vip_approved_at)
  or (new.vip_approved_by is distinct from old.vip_approved_by)
  or (new.vip_expires_at  is distinct from old.vip_expires_at)
  then
    -- auth.uid() IS NULL means there is no end-user JWT on this session: a
    -- migration, a seed, the SQL editor, or a service_role call. Those are
    -- trusted. Any request carrying a user JWT must hold the admin role.
    if (select auth.uid()) is not null and not private.has_role('admin') then
      raise exception
        'customer_type and VIP metadata may only be changed by an admin or owner'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Attached in migration 03, once private.has_role() exists.
