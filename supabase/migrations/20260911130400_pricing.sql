-- ============================================================================
-- Apple Expert · 05 · product_prices
-- ----------------------------------------------------------------------------
-- Money is bigint minor units: Rs. 485,000 is stored as 48500000.
-- Floating point is never used for a financial value anywhere in this schema.
--
-- variant_id NULL  = the row prices the whole product
-- variant_id set   = the row overrides that one variant
-- ends_at   NULL   = this is the live price
-- ends_at   set    = retired, retained as history and never overwritten
-- ============================================================================

create table public.product_prices (
  id           uuid primary key default gen_random_uuid(),
  product_id   text not null references public.products (id) on delete cascade,
  variant_id   uuid references public.product_variants (id) on delete cascade,
  tier_code    text not null references public.price_tiers (code) on delete restrict,

  price_cents  bigint not null check (price_cents > 0),

  -- Quantity break WITHIN a tier the customer already holds. It is NOT a
  -- qualification rule: buying 10, 100 or 1000 units never grants VIP status.
  -- Every launch price uses min_qty = 1.
  min_qty      integer not null default 1 check (min_qty >= 1),

  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,

  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Equality is allowed so that two edits in the same instant leave a
  -- zero-length historical row rather than failing the write.
  constraint product_prices_window_valid
    check (ends_at is null or ends_at >= starts_at)
);

create trigger product_prices_set_updated_at
  before update on public.product_prices
  for each row execute function public.set_updated_at();

comment on table public.product_prices is
  'Tiered prices in bigint minor units. Retired rows are kept for history; only ends_at IS NULL is live.';
comment on column public.product_prices.min_qty is
  'Quantity break within a tier. Never a VIP qualification rule. All launch rows use 1.';
comment on column public.product_prices.ends_at is
  'NULL = live. Set by admin_set_price() when a new price supersedes this row.';

-- ----------------------------------------------------------------------------
-- One live price per product / variant / tier / min_qty
-- ----------------------------------------------------------------------------
-- NULLS NOT DISTINCT (PostgreSQL 15+) is what makes this hold for product-level
-- rows, where variant_id is NULL and would otherwise never collide with itself.
-- The branch below keeps the migration correct on an older server by folding
-- NULL onto a sentinel UUID instead - same guarantee, uglier index.
-- ----------------------------------------------------------------------------
do $$
begin
  if current_setting('server_version_num')::int >= 150000 then
    execute $ddl$
      create unique index product_prices_live_uq
        on public.product_prices (product_id, variant_id, tier_code, min_qty)
        nulls not distinct
        where ends_at is null
    $ddl$;
  else
    execute $ddl$
      create unique index product_prices_live_uq
        on public.product_prices (
          product_id,
          coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
          tier_code,
          min_qty
        )
        where ends_at is null
    $ddl$;
  end if;
end
$$;

-- Bulk storefront read: every live price for one tier.
create index product_prices_live_lookup_idx
  on public.product_prices (tier_code, product_id)
  where ends_at is null;

-- Per-product admin pricing panel, and price history for one product.
create index product_prices_product_idx
  on public.product_prices (product_id, variant_id, tier_code, starts_at desc);

-- Window filtering when scheduled prices are in play.
create index product_prices_window_idx
  on public.product_prices (starts_at, ends_at);
