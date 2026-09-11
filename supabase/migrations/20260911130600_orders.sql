-- ============================================================================
-- Apple Expert · 07 · orders, order_items, order_events, payments
-- ----------------------------------------------------------------------------
-- ORDER IMMUTABILITY
-- order_items has NO foreign key to product_prices and never joins to it at
-- read time. The snapshot columns ARE the record, so an order placed at
-- Rs. 485,000 still reads Rs. 485,000 after the admin raises the price to
-- Rs. 500,000 - and still reads correctly after the product is deleted.
-- ============================================================================

create table public.orders (
  id                       uuid primary key default gen_random_uuid(),
  order_number             text not null unique,
  profile_id               uuid not null references public.profiles (id) on delete restrict,

  status                   text not null default 'pending'
                           check (status in ('pending', 'confirmed', 'processing',
                                             'shipped', 'delivered', 'cancelled', 'refunded')),

  -- Which tier this order was priced at. Explains, two years later, why a line
  -- cost what it did.
  customer_type_at_purchase text not null
                           references public.price_tiers (code) on delete restrict,

  subtotal_cents           bigint not null default 0 check (subtotal_cents >= 0),
  delivery_cents           bigint not null default 0 check (delivery_cents >= 0),
  discount_cents           bigint not null default 0 check (discount_cents >= 0),
  total_cents              bigint not null default 0 check (total_cents >= 0),
  currency                 text not null default 'LKR',

  -- Snapshot, not a FK: the address must survive the customer editing or
  -- deleting the address book entry.
  shipping_address         jsonb,

  notes                    text,
  placed_at                timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index orders_profile_idx on public.orders (profile_id, placed_at desc);
create index orders_status_idx  on public.orders (status, placed_at desc);

comment on column public.orders.shipping_address is
  'Address snapshot taken at placement, deliberately not a foreign key.';

-- ----------------------------------------------------------------------------
-- order_items - immutable snapshots
-- ----------------------------------------------------------------------------
create table public.order_items (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders (id) on delete cascade,

  -- SET NULL, never CASCADE: deleting a product must not destroy order history.
  product_id              text references public.products (id) on delete set null,
  variant_id              uuid references public.product_variants (id) on delete set null,

  -- The snapshot columns. These are what the receipt renders from.
  product_name_snapshot   text not null,
  variant_label_snapshot  text,
  image_path_snapshot     text,

  unit_price_cents        bigint  not null check (unit_price_cents >= 0),
  quantity                integer not null check (quantity > 0),
  -- Stored, not derived: a later rounding-rule change must not alter history.
  line_total_cents        bigint  not null check (line_total_cents >= 0),

  tier_code_snapshot      text not null,

  -- Audit reference only. Never read for display, and SET NULL so a purged
  -- price row can never break a receipt.
  price_id                uuid references public.product_prices (id) on delete set null,

  created_at              timestamptz not null default now()
);

create index order_items_order_idx   on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

comment on table public.order_items is
  'Immutable order lines. No FK to product_prices; snapshots are the record.';
comment on column public.order_items.price_id is
  'Audit-only pointer to the product_prices row used. Never joined for display.';

-- ----------------------------------------------------------------------------
-- order_events - status audit trail for the admin orders screen
-- ----------------------------------------------------------------------------
create table public.order_events (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  from_status  text,
  to_status    text not null,
  actor_id     uuid references public.profiles (id) on delete set null,
  note         text,
  created_at   timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at desc);

-- ----------------------------------------------------------------------------
-- payments - one order may have several attempts
-- ----------------------------------------------------------------------------
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete restrict,
  provider      text not null,
  provider_ref  text,
  amount_cents  bigint not null check (amount_cents >= 0),
  status        text not null default 'initiated'
                check (status in ('initiated', 'authorized', 'captured', 'failed', 'refunded')),
  raw           jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create index payments_order_idx on public.payments (order_id);
