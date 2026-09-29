-- ============================================================================
-- Admin Settings: global store configuration + banner image storage
-- ----------------------------------------------------------------------------
-- 1. public.store_settings - ONE global row holding store details and the
--    storefront switches. Readable by everyone (it is the public store face and
--    the maintenance / store-closed screens must work before sign-in); writable
--    only by owner/admin through the existing private.has_role('admin').
-- 2. storage bucket `banners` - promotional images live in Supabase Storage,
--    never in the APK and never in a table row. Public read (the storefront
--    shows them), owner/admin write.
-- 3. banners.cta_href safety - a banner link may only be an in-app path or an
--    https URL, so a stored `javascript:` link can never reach a customer.
--
-- featured_products and banners already had the columns, RLS ("public read" of
-- active rows, "admin all" for writes) and the unique (slot, product_id) that
-- the Settings screen needs, so neither table's shape or policies change.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. store_settings
-- ----------------------------------------------------------------------------
create table public.store_settings (
  -- Singleton: the primary key can only ever be `true`, so a second row is
  -- impossible rather than merely discouraged.
  id                      boolean primary key default true check (id),

  store_name              text not null default 'Apple Expert'
                          check (length(btrim(store_name)) between 1 and 80),
  description             text check (description is null or length(description) <= 500),
  contact_phone           text check (contact_phone is null or length(contact_phone) <= 30),
  whatsapp_number         text check (whatsapp_number is null or length(whatsapp_number) <= 30),
  email                   text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  address                 text check (address is null or length(address) <= 300),
  opening_hours           text check (opening_hours is null or length(opening_hours) <= 300),

  is_open                 boolean not null default true,
  maintenance_mode        boolean not null default false,
  -- Prices are Sri Lankan rupees throughout (formatPrice, bigint minor units).
  currency                text not null default 'LKR' check (currency = 'LKR'),

  show_featured_products  boolean not null default true,
  show_banners            boolean not null default true,
  show_new_arrivals       boolean not null default true,
  show_stock_status       boolean not null default true,
  retail_enabled          boolean not null default true,
  wholesale_enabled       boolean not null default true,

  updated_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.store_settings is
  'Single global store configuration row (id = true). Public read; owner/admin update only.';

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- Who last saved the settings, taken from the session rather than trusted from
-- the request body.
create or replace function public.stamp_store_settings_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger store_settings_stamp_actor
  before update on public.store_settings
  for each row execute function public.stamp_store_settings_actor();

-- The one row. Only values the business has actually stated are seeded; the
-- contact details stay empty until an administrator enters them.
insert into public.store_settings (id) values (true)
on conflict (id) do nothing;

alter table public.store_settings enable row level security;

create policy "store_settings public read" on public.store_settings
  for select to anon, authenticated using (true);

create policy "store_settings admin update" on public.store_settings
  for update to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

-- The row is created here and never by a client; nobody may add or remove it.
revoke insert, delete, truncate on public.store_settings from anon, authenticated;
revoke update on public.store_settings from anon;


-- ----------------------------------------------------------------------------
-- 2. Banner images in Supabase Storage
-- ----------------------------------------------------------------------------
-- 5 MB cap and image types only, enforced by Storage itself, not just the UI.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A public bucket serves files by URL without consulting these policies; they
-- govern the Storage API itself (upload, replace, delete, list).
create policy "banners images admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'banners' and private.has_role('admin'));

create policy "banners images admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'banners' and private.has_role('admin'))
  with check (bucket_id = 'banners' and private.has_role('admin'));

create policy "banners images admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'banners' and private.has_role('admin'));

create policy "banners images staff list" on storage.objects
  for select to authenticated
  using (bucket_id = 'banners' and private.has_role('staff'));


-- ----------------------------------------------------------------------------
-- 3. Banner link safety
-- ----------------------------------------------------------------------------
-- NOT VALID: enforced for every new or edited row without failing on any row
-- that predates this rule.
alter table public.banners
  add constraint banners_cta_href_safe
  check (cta_href is null or cta_href ~ '^/' or cta_href ~* '^https://')
  not valid;


-- ----------------------------------------------------------------------------
-- Rollback (manual, if ever needed):
--   alter table public.banners drop constraint if exists banners_cta_href_safe;
--   drop policy if exists "banners images admin insert" on storage.objects;
--   drop policy if exists "banners images admin update" on storage.objects;
--   drop policy if exists "banners images admin delete" on storage.objects;
--   drop policy if exists "banners images staff list"   on storage.objects;
--   -- empty the bucket in the dashboard first, then:
--   delete from storage.buckets where id = 'banners';
--   drop table if exists public.store_settings;
--   drop function if exists public.stamp_store_settings_actor();
-- ----------------------------------------------------------------------------
