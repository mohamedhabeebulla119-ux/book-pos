-- ============================================================================
-- Apple Expert · 12 · Row Level Security
-- ----------------------------------------------------------------------------
-- RLS is not a layer of the security model here - it IS the model. The customer
-- app is a static export in a Capacitor WebView and the publishable key ships
-- inside the APK, so any customer can extract it and query this database
-- directly. There is no server, middleware or route handler in between.
--
-- Every table in `public` enables RLS below. A table without a permissive
-- policy is unreachable by anon/authenticated, which is the desired default.
--
-- All policies call helpers with (select auth.uid()) inside, so the uid is
-- resolved once per statement rather than once per row.
-- ============================================================================

alter table public.categories            enable row level security;
alter table public.device_models         enable row level security;
alter table public.products              enable row level security;
alter table public.product_variants      enable row level security;
alter table public.product_images        enable row level security;
alter table public.product_specs         enable row level security;
alter table public.product_compatibility enable row level security;
alter table public.price_tiers           enable row level security;
alter table public.product_prices        enable row level security;
alter table public.profiles              enable row level security;
alter table public.user_roles            enable row level security;
alter table public.addresses             enable row level security;
alter table public.carts                 enable row level security;
alter table public.cart_items            enable row level security;
alter table public.wishlist_items        enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_events          enable row level security;
alter table public.payments              enable row level security;
alter table public.inventory_movements   enable row level security;
alter table public.banners               enable row level security;
alter table public.featured_products     enable row level security;

-- ============================================================================
-- CATALOG - public reads of active rows, admin writes
-- ============================================================================

create policy "categories public read" on public.categories
  for select to anon, authenticated using (is_active);
create policy "categories admin all" on public.categories
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy "device_models public read" on public.device_models
  for select to anon, authenticated using (is_active);
create policy "device_models admin all" on public.device_models
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

-- Customers see only active products. The 54 replacement parts awaiting a
-- confirmed business price are seeded is_active = false, so they are invisible
-- here while remaining fully visible to staff in the admin panel.
create policy "products public read" on public.products
  for select to anon, authenticated using (is_active);
create policy "products staff read" on public.products
  for select to authenticated using (private.has_role('staff'));
create policy "products admin all" on public.products
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

-- Child catalog tables inherit visibility from their parent product.
create policy "product_variants public read" on public.product_variants
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_variants.product_id and p.is_active));
create policy "product_variants staff read" on public.product_variants
  for select to authenticated using (private.has_role('staff'));
create policy "product_variants admin all" on public.product_variants
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy "product_images public read" on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_images.product_id and p.is_active));
create policy "product_images staff read" on public.product_images
  for select to authenticated using (private.has_role('staff'));
create policy "product_images admin all" on public.product_images
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy "product_specs public read" on public.product_specs
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_specs.product_id and p.is_active));
create policy "product_specs staff read" on public.product_specs
  for select to authenticated using (private.has_role('staff'));
create policy "product_specs admin all" on public.product_specs
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy "product_compatibility public read" on public.product_compatibility
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_compatibility.product_id and p.is_active));
create policy "product_compatibility staff read" on public.product_compatibility
  for select to authenticated using (private.has_role('staff'));
create policy "product_compatibility admin all" on public.product_compatibility
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

-- ============================================================================
-- PRICING - the tier isolation boundary
-- ============================================================================

-- A tier is visible if it is public, or if it is the caller's own tier. An
-- anonymous visitor therefore cannot even enumerate that wholesale_vip exists.
create policy "price_tiers read visible" on public.price_tiers
  for select to anon, authenticated
  using (is_public or code = private.current_customer_type());
create policy "price_tiers owner all" on public.price_tiers
  for all to authenticated
  using (private.has_role('owner')) with check (private.has_role('owner'));

-- ----------------------------------------------------------------------------
-- product_prices
-- ----------------------------------------------------------------------------
-- A retail caller's query returns ZERO wholesale_vip rows. They are not hidden
-- by the application - they are absent from the result set the database builds.
--
-- Two permissive SELECT policies are OR'd together:
--   1. the caller's own tier (retail for anonymous and expired-VIP callers)
--   2. any public tier, which is what lets a VIP fall back to retail on a
--      product that has no VIP price yet
--
-- There is deliberately NO insert/update/delete policy for any role. Every
-- write goes through admin_set_price(), which is SECURITY DEFINER and therefore
-- bypasses RLS after checking the admin role itself. This is what enforces
-- "the client should NOT directly update product_prices".
-- ----------------------------------------------------------------------------
create policy "product_prices read own tier" on public.product_prices
  for select to anon, authenticated
  using (
    tier_code = private.current_customer_type()
    and now() >= starts_at
    and (ends_at is null or now() < ends_at)
  );

create policy "product_prices read public tier" on public.product_prices
  for select to anon, authenticated
  using (
    tier_code in (select t.code from public.price_tiers t where t.is_public)
    and now() >= starts_at
    and (ends_at is null or now() < ends_at)
  );

-- Staff and admins read every tier and every historical row, so the admin
-- pricing panel can show retail and VIP side by side.
create policy "product_prices staff read all" on public.product_prices
  for select to authenticated using (private.has_role('staff'));

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

create policy "profiles read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles staff read" on public.profiles
  for select to authenticated using (private.has_role('staff'));
create policy "profiles admin all" on public.profiles
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

-- has_role() is SECURITY DEFINER, so this policy does NOT recurse when it
-- queries the very table it protects.
create policy "user_roles read own" on public.user_roles
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "user_roles owner all" on public.user_roles
  for all to authenticated
  using (private.has_role('owner')) with check (private.has_role('owner'));

create policy "addresses own all" on public.addresses
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy "addresses staff read" on public.addresses
  for select to authenticated using (private.has_role('staff'));

-- ============================================================================
-- SHOPPING - own rows only
-- ============================================================================

create policy "carts own all" on public.carts
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "cart_items own all" on public.cart_items
  for all to authenticated
  using (exists (select 1 from public.carts c
                 where c.id = cart_items.cart_id and c.profile_id = (select auth.uid())))
  with check (exists (select 1 from public.carts c
                 where c.id = cart_items.cart_id and c.profile_id = (select auth.uid())));

create policy "wishlist_items own all" on public.wishlist_items
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ============================================================================
-- ORDERS - read-only for customers
-- ============================================================================
-- DOCUMENTED DECISION: customers get SELECT only. No INSERT policy is granted,
-- because a client-side INSERT would let anyone with the extracted publishable
-- key post their own total_cents and order an iPhone for Rs. 1. Orders will be
-- created by a future place_order() SECURITY DEFINER RPC that resolves prices
-- and computes totals inside PostgreSQL.
--
-- This is flagged in the report rather than decided silently.
-- ============================================================================

create policy "orders read own" on public.orders
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "orders staff read" on public.orders
  for select to authenticated using (private.has_role('staff'));
create policy "orders staff update status" on public.orders
  for update to authenticated
  using (private.has_role('staff')) with check (private.has_role('staff'));
create policy "orders admin all" on public.orders
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy "order_items read own" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_items.order_id and o.profile_id = (select auth.uid())));
create policy "order_items staff read" on public.order_items
  for select to authenticated using (private.has_role('staff'));
create policy "order_items admin all" on public.order_items
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy "order_events read own" on public.order_events
  for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_events.order_id and o.profile_id = (select auth.uid())));
create policy "order_events staff all" on public.order_events
  for all to authenticated
  using (private.has_role('staff')) with check (private.has_role('staff'));

create policy "payments read own" on public.payments
  for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = payments.order_id and o.profile_id = (select auth.uid())));
create policy "payments admin read" on public.payments
  for select to authenticated using (private.has_role('admin'));
-- No write policy: payment rows are written by the payment integration using
-- the service_role key from the separate admin/server deployment.

-- ============================================================================
-- INVENTORY - staff only, never customers
-- ============================================================================

create policy "inventory_movements staff read" on public.inventory_movements
  for select to authenticated using (private.has_role('staff'));
create policy "inventory_movements staff insert" on public.inventory_movements
  for insert to authenticated with check (private.has_role('staff'));
create policy "inventory_movements admin all" on public.inventory_movements
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

-- ============================================================================
-- MERCHANDISING
-- ============================================================================

create policy "featured_products public read" on public.featured_products
  for select to anon, authenticated using (is_active);
create policy "featured_products admin all" on public.featured_products
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy "banners public read" on public.banners
  for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or now() >= starts_at)
    and (ends_at   is null or now() <  ends_at)
  );
create policy "banners admin all" on public.banners
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

-- ============================================================================
-- COLUMN-LEVEL AND TABLE-LEVEL REVOKES (defence in depth)
-- ============================================================================
-- PostgreSQL RLS has no column-level WITH CHECK, so a policy alone cannot say
-- "you may update your own profile except this column". Column privileges can.
--
-- This intentionally blocks admins too (an admin is also `authenticated`),
-- which is what forces every VIP change through admin_set_customer_type().
--
-- IMPORTANT: a column-level REVOKE does nothing while a TABLE-level UPDATE
-- grant is still in place, because the table grant already implies every
-- column. Supabase's default privileges grant ALL on new public tables to
-- anon/authenticated, so the table-level UPDATE must be revoked FIRST and the
-- permitted columns granted back explicitly. Omitting this order is a silent
-- failure: the policy looks correct and customers can still self-promote.
revoke update on public.profiles from anon, authenticated;

grant update (full_name, email, phone, avatar_url, updated_at)
  on public.profiles to authenticated;

-- Customers must never mutate order history. RLS already grants no such policy;
-- these revokes mean a future accidental policy cannot re-open the hole.
revoke insert, update, delete on public.orders      from anon;
revoke insert, update, delete on public.order_items from anon;
-- Order lines are immutable once written, for staff and admins alike. The
-- "order_items admin all" policy above therefore reaches SELECT and INSERT
-- only; UPDATE/DELETE are refused by the grant system before RLS is consulted.
revoke update, delete         on public.order_items from authenticated;
revoke insert, update, delete on public.payments    from anon, authenticated;

-- Prices are written only by admin_set_price().
revoke insert, update, delete on public.product_prices from anon, authenticated;

-- Reference data is never client-writable.
revoke insert, update, delete on public.price_tiers from anon, authenticated;
