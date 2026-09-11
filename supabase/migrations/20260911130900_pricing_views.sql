-- ============================================================================
-- Apple Expert · 10 · customer-facing price views
-- ----------------------------------------------------------------------------
-- CRITICAL SECURITY PROPERTY
-- A PostgreSQL view runs with its OWNER's privileges by default, which BYPASSES
-- row-level security on the tables underneath. A view over product_prices
-- created without `security_invoker = on` would return every wholesale_vip
-- price to every anonymous customer, while the application looked completely
-- correct. It is the single easiest way to defeat this entire design.
--
-- security_invoker requires PostgreSQL 15+. If it is unavailable we ABORT the
-- migration rather than fall back to an unsafe view - failing loudly is the only
-- acceptable behaviour here.
-- ============================================================================

do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception
      'security_invoker views require PostgreSQL 15+. Refusing to create price views that would bypass RLS.';
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- public.my_prices - every live price row the CALLER is allowed to see
-- ----------------------------------------------------------------------------
-- The window is evaluated with database now(), never a device clock. On a
-- Capacitor app the phone's date is user-settable, so a scheduled price change
-- must never be triggerable by changing it.
-- ----------------------------------------------------------------------------
create view public.my_prices
  with (security_invoker = on)
as
select
  p.id,
  p.product_id,
  p.variant_id,
  p.tier_code,
  p.price_cents,
  p.min_qty
from public.product_prices p
where now() >= p.starts_at
  and (p.ends_at is null or now() < p.ends_at);

comment on view public.my_prices is
  'Live price rows visible to the caller under RLS. security_invoker = on is mandatory.';

-- ----------------------------------------------------------------------------
-- public.my_effective_prices - one resolved price per product/variant
-- ----------------------------------------------------------------------------
-- Tier fallback happens here: prefer a wholesale_vip row when the caller can see
-- one, otherwise take retail. This is what lets VIP pricing roll out gradually -
-- a VIP customer is never left without a price on a product the owner has not
-- given a VIP price yet.
--
-- A retail caller sees no wholesale_vip rows at all (RLS removed them upstream),
-- so for them this collapses to retail with no special-casing.
--
-- Variant-to-product fallback is deliberately NOT done here: both the
-- variant-level row and the product-level row (variant_id IS NULL) are returned
-- so the catalog mapper can key them as `${product_id}:${variant_id ?? ''}` and
-- pick the specific one when a variant is selected.
--
-- min_qty = 1 only, matching the launch rule that no quantity breaks exist yet.
-- ----------------------------------------------------------------------------
create view public.my_effective_prices
  with (security_invoker = on)
as
select distinct on (m.product_id, m.variant_id)
  m.product_id,
  m.variant_id,
  m.tier_code,
  m.price_cents,
  m.min_qty
from public.my_prices m
where m.min_qty = 1
order by
  m.product_id,
  m.variant_id,
  (m.tier_code = 'wholesale_vip') desc,  -- VIP wins when visible
  m.price_cents asc;                     -- deterministic tiebreak

comment on view public.my_effective_prices is
  'One price per product/variant for the caller: wholesale_vip when visible, else retail.';

grant select on public.my_prices            to anon, authenticated;
grant select on public.my_effective_prices  to anon, authenticated;
