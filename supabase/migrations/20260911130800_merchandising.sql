-- ============================================================================
-- Apple Expert · 09 · banners, featured_products
-- ----------------------------------------------------------------------------
-- featured_products is the single source of truth for merchandising. products
-- deliberately has no `featured` boolean, which is what ended the conflict
-- between deviceData (8 featured) and mockData (5 featured) where only the
-- mockData flags actually reached the homepage carousel.
-- ============================================================================

create table public.featured_products (
  id          uuid primary key default gen_random_uuid(),
  slot        text not null default 'home'
              check (slot ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  product_id  text not null references public.products (id) on delete cascade,
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (slot, product_id)
);

create trigger featured_products_set_updated_at
  before update on public.featured_products
  for each row execute function public.set_updated_at();

create index featured_products_slot_idx
  on public.featured_products (slot, position)
  where is_active;

comment on table public.featured_products is
  'Canonical curated merchandising. Replaces the conflicting featured booleans.';

-- ----------------------------------------------------------------------------
-- banners - the promotional blocks that are inline JSX today
-- ----------------------------------------------------------------------------
create table public.banners (
  id          uuid primary key default gen_random_uuid(),
  slot        text not null,
  title       text,
  subtitle    text,
  cta_label   text,
  cta_href    text,
  image_path  text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint banners_window_valid
    check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create trigger banners_set_updated_at
  before update on public.banners
  for each row execute function public.set_updated_at();

create index banners_slot_idx
  on public.banners (slot, sort_order)
  where is_active;
