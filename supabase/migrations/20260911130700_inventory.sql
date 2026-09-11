-- ============================================================================
-- Apple Expert · 08 · inventory_movements
-- ----------------------------------------------------------------------------
-- Inventory is completely decoupled from pricing. admin_set_price() (migration
-- 11) writes only product_prices and touches no column in this file. The two
-- concerns share no table and no code path, so a price edit can never move
-- stock.
-- ============================================================================

create table public.inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references public.products (id) on delete restrict,
  variant_id  uuid references public.product_variants (id) on delete restrict,

  -- Signed: negative for a sale, positive for a restock.
  delta       integer not null check (delta <> 0),

  reason      text not null check (reason in (
                'seed', 'restock', 'sale', 'return', 'adjustment', 'damage', 'transfer'
              )),

  order_id    uuid references public.orders (id) on delete set null,
  actor_id    uuid references public.profiles (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

create index inventory_movements_product_idx
  on public.inventory_movements (product_id, created_at desc);

create index inventory_movements_order_idx
  on public.inventory_movements (order_id)
  where order_id is not null;

comment on table public.inventory_movements is
  'Append-only stock ledger. products.stock is the maintained running total; this table is the history.';

-- Low-stock alert list for the admin inventory screen. Partial, so it stays
-- small no matter how large the catalog grows. The <= 5 predicate matches the
-- threshold ProductCard already uses to render its "low stock" state.
create index products_low_stock_idx
  on public.products (stock)
  where stock <= 5 and is_active;
