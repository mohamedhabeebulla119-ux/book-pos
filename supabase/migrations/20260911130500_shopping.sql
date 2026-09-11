-- ============================================================================
-- Apple Expert · 06 · carts, cart_items, wishlist_items
-- ----------------------------------------------------------------------------
-- The cart deliberately stores REFERENCES, not prices. An active cart resolves
-- its price live at render, so a customer never checks out against a stale
-- number. Only an order snapshots a price (migration 07).
-- ============================================================================

create table public.carts (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null unique references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references public.carts (id) on delete cascade,
  product_id  text not null references public.products (id) on delete cascade,
  variant_id  uuid references public.product_variants (id) on delete cascade,
  quantity    integer not null default 1 check (quantity > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- One line per product/variant. The coalesce sentinel makes this hold for
-- variant-less lines, where variant_id is NULL and would not collide.
create unique index cart_items_line_uq
  on public.cart_items (
    cart_id,
    product_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index cart_items_cart_idx on public.cart_items (cart_id);

comment on table public.cart_items is
  'Cart lines hold references only - no price. Price is resolved live at render and again at order time.';

-- ----------------------------------------------------------------------------
-- wishlist_items - replaces the localStorage string[] of product ids
-- ----------------------------------------------------------------------------
-- The real FK is the point: today a wishlisted replacement part stores an id
-- that the wishlist page cannot resolve, so the item silently disappears. A
-- foreign key makes that dangling reference impossible.
-- ----------------------------------------------------------------------------
create table public.wishlist_items (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  product_id  text not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, product_id)
);

create index wishlist_items_profile_idx on public.wishlist_items (profile_id);
