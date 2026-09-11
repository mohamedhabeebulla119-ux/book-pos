-- ============================================================================
-- Apple Expert · 04 · catalog
--   categories, device_models, products, product_variants,
--   product_images, product_specs, product_compatibility
-- ----------------------------------------------------------------------------
-- products has NO price column. That is deliberate: prices live in
-- product_prices so RLS can make a wholesale row physically unreachable by a
-- retail caller. See migration 05.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- categories - the routable categories, preserving existing URL slugs
-- ----------------------------------------------------------------------------
-- 7 top-level slugs back /categories/[category]; displays and batteries are
-- children of parts and back the two replacement-part routes. Changing a slug
-- would break a static route, so slug is unique and treated as stable.
-- ----------------------------------------------------------------------------
create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  parent_id      uuid references public.categories (id) on delete restrict,
  slug           text not null unique
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name           text not null,
  subtitle       text,
  hero_eyebrow   text,
  hero_headline  text,
  hero_blurb     text,
  image_path     text,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- A category cannot be its own parent.
  constraint categories_no_self_parent check (parent_id is null or parent_id <> id)
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

comment on column public.categories.slug is
  'Stable URL segment. Must match the existing static routes.';

-- ----------------------------------------------------------------------------
-- device_models - the 27 iPhone models behind the replacement-part pages
-- ----------------------------------------------------------------------------
create table public.device_models (
  id          text primary key
              check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  series      text,
  image_path  text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger device_models_set_updated_at
  before update on public.device_models
  for each row execute function public.set_updated_at();

comment on table public.device_models is
  'Device models used for part compatibility and the parts model-picker routes.';

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
-- id stays the existing human slug ("iphone-17-pro-max"). It is already the URL
-- segment, the image filename, the cart line id and the wishlist entry, so a
-- UUID primary key would force a slug lookup on every one of those paths and
-- invalidate every cart already saved on a customer's phone.
--
-- SCHEMA NOTE (documented deviation): `subcategory` is a constrained text
-- column, not a FK to categories. The existing data uses 'Devices' as the
-- subcategory under five different parents (iPhone, iPad, Mac, Apple Watch,
-- AirPods); modelling that in the self-referencing categories tree would need
-- five duplicate 'Devices' rows and a parent-aware lookup in the seed. The CHECK
-- list below mirrors the ProductSubcategory union in src/types/index.ts exactly.
-- ----------------------------------------------------------------------------
create table public.products (
  id                  text primary key
                      check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                text not null,
  category_id         uuid not null references public.categories (id) on delete restrict,
  subcategory         text not null check (subcategory in (
                        'Displays', 'Batteries', 'Cameras', 'Charging Parts',
                        'Speakers & Microphones', 'Buttons & Flex Cables',
                        'Motherboard / IC', 'Cases', 'iPhone Cases', 'Chargers',
                        'Power Adapters', 'Cables', 'USB-C Cables',
                        'Screen Protection', 'MagSafe', 'Other Accessories',
                        'Devices'
                      )),
  model               text,
  description         text not null default '',

  -- Stock lives here and moves only through inventory_movements.
  -- Nothing in the pricing path ever writes it.
  stock               integer not null default 0 check (stock >= 0),

  rating              numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  reviews_count       integer not null default 0 check (reviews_count >= 0),

  warranty_text       text,
  warranty_status     text check (warranty_status in ('active', 'none')),
  warranty_duration   text,
  warranty_months     integer check (warranty_months is null or warranty_months >= 0),
  warranty_coverage   text,

  lifecycle_status    text check (lifecycle_status in ('NEW', 'CURRENT', 'OLDER')),
  is_new              boolean not null default false,

  -- is_active = visible to customers. Products awaiting a confirmed business
  -- price are seeded false so they can never render without a price.
  is_active           boolean not null default true,
  sort_order          integer not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

comment on table public.products is
  'One row per sellable thing - devices, replacement parts and accessories alike. No price column by design.';
comment on column public.products.id is
  'Existing human slug, kept as the primary key. Also the URL segment and image filename.';
comment on column public.products.is_active is
  'False hides the product from customers via RLS. Used for items awaiting a confirmed price.';

-- Deliberately absent: a `featured` boolean. featured_products (migration 09)
-- is the single source of truth for merchandising.

-- ----------------------------------------------------------------------------
-- product_variants
-- ----------------------------------------------------------------------------
-- legacy_key preserves the original in-file id ('v1', 'v2'), which is unique
-- only within a product. The cart composes `${product.id}-${variant.id}` today,
-- so keeping the key lets existing saved carts be matched after migration.
-- ----------------------------------------------------------------------------
create table public.product_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   text not null references public.products (id) on delete cascade,
  legacy_key   text,
  name         text not null,
  color        text,
  color_code   text check (color_code is null or color_code ~ '^#[0-9A-Fa-f]{6}$'),
  storage      text,
  stock        integer check (stock is null or stock >= 0),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product_id, legacy_key)
);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

comment on column public.product_variants.stock is
  'NULL means the variant inherits products.stock.';

-- ----------------------------------------------------------------------------
-- product_images
-- ----------------------------------------------------------------------------
-- `path` holds exactly what the frontend puts in <img src> today: a local path
-- such as /images/products/iphone/iphone-17-pro-max.jpg, or an absolute URL.
-- The 27MB local library is NOT migrated to Storage in this phase.
-- storage_bucket stays NULL until admin-managed uploads exist; at that point a
-- row gains a bucket and `path` becomes an object key.
-- ----------------------------------------------------------------------------
create table public.product_images (
  id              uuid primary key default gen_random_uuid(),
  product_id      text not null references public.products (id) on delete cascade,
  storage_bucket  text,
  path            text not null,
  alt             text,
  position        integer not null default 0,
  is_primary      boolean not null default false,
  created_at      timestamptz not null default now()
);

comment on column public.product_images.storage_bucket is
  'NULL = served from the app bundle at `path`. Set once images move to Supabase Storage.';

-- ----------------------------------------------------------------------------
-- product_specs - ordered rows, replacing Record<string,string>
-- ----------------------------------------------------------------------------
-- The UI renders specifications in insertion order, so order is data. `position`
-- preserves it explicitly rather than relying on JSON key ordering.
-- ----------------------------------------------------------------------------
create table public.product_specs (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references public.products (id) on delete cascade,
  label       text not null,
  value       text not null,
  position    integer not null default 0,
  unique (product_id, label)
);

-- ----------------------------------------------------------------------------
-- product_compatibility
-- ----------------------------------------------------------------------------
-- SCHEMA NOTE (documented ambiguity): today's compatibility[] is free text and
-- only some values correspond to a device_models row. Generated iPhone parts map
-- cleanly to a model id; entries like 'Mac', 'iPad' or 'MacBook Pro 14" (2021)'
-- do not. So device_model_id is nullable and `label` always carries the original
-- string, which means no data is lost and nothing is invented.
-- ----------------------------------------------------------------------------
create table public.product_compatibility (
  id               uuid primary key default gen_random_uuid(),
  product_id       text not null references public.products (id) on delete cascade,
  device_model_id  text references public.device_models (id) on delete restrict,
  label            text not null,
  part_kind        text check (part_kind in ('display', 'battery')),
  position         integer not null default 0,
  unique (product_id, label)
);

comment on column public.product_compatibility.device_model_id is
  'Set when the compatibility entry resolves to a known device model; NULL for free-text entries.';
