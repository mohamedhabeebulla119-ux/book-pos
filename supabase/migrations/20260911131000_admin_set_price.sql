-- ============================================================================
-- Apple Expert · 11 · admin_set_price() RPC
-- ----------------------------------------------------------------------------
-- The only supported way to change a price. Clients never write product_prices
-- directly - migration 12 grants no INSERT/UPDATE/DELETE policy on that table to
-- anyone, so every write must come through this function.
--
-- Close-and-insert rather than UPDATE in place, which buys three things for the
-- same effort: price history, scheduled changes via starts_at, and a created_by
-- audit trail. The partial unique index is never violated mid-flight because
-- both statements run in the function's single transaction.
--
-- This function writes ONLY product_prices. It touches no inventory column and
-- no order row.
-- ============================================================================

create or replace function public.admin_set_price(
  p_product_id  text,
  p_variant_id  uuid          default null,
  p_tier_code   text          default 'retail',
  p_price_cents bigint        default null,
  p_min_qty     integer       default 1,
  p_starts_at   timestamptz   default null
)
returns public.product_prices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_start timestamptz;
  v_new   public.product_prices;
begin
  v_actor := (select auth.uid());
  v_start := coalesce(p_starts_at, now());

  -- 1. Authorisation. Checked server-side; a client cannot skip this.
  if not private.has_role('admin') then
    raise exception 'insufficient_privilege: admin or owner role required'
      using errcode = '42501';
  end if;

  -- 2. Price validation.
  if p_price_cents is null or p_price_cents <= 0 then
    raise exception 'invalid_price: price_cents must be a positive integer (minor units)'
      using errcode = '22023';
  end if;

  if p_min_qty is null or p_min_qty < 1 then
    raise exception 'invalid_min_qty: min_qty must be >= 1'
      using errcode = '22023';
  end if;

  -- 3. Tier must exist. No generic wholesale tier is created by this schema.
  if not exists (select 1 from public.price_tiers t where t.code = p_tier_code) then
    raise exception 'unknown_tier: %', p_tier_code using errcode = '23503';
  end if;

  -- 4. Product must exist.
  if not exists (select 1 from public.products pr where pr.id = p_product_id) then
    raise exception 'unknown_product: %', p_product_id using errcode = '23503';
  end if;

  -- 5. A variant, when supplied, must belong to that product.
  if p_variant_id is not null
     and not exists (
       select 1 from public.product_variants v
       where v.id = p_variant_id and v.product_id = p_product_id
     )
  then
    raise exception 'variant_product_mismatch: variant % does not belong to product %',
      p_variant_id, p_product_id using errcode = '23503';
  end if;

  -- 6. Retire the current live row. `is not distinct from` matches NULL
  --    variant_id correctly, which a plain `=` would not.
  update public.product_prices pp
     set ends_at    = v_start,
         updated_at = now()
   where pp.product_id = p_product_id
     and pp.variant_id is not distinct from p_variant_id
     and pp.tier_code  = p_tier_code
     and pp.min_qty    = p_min_qty
     and pp.ends_at is null;

  -- 7. Insert the new live row.
  insert into public.product_prices
    (product_id, variant_id, tier_code, price_cents, min_qty, starts_at, created_by)
  values
    (p_product_id, p_variant_id, p_tier_code, p_price_cents, p_min_qty, v_start, v_actor)
  returning * into v_new;

  return v_new;
end;
$$;

comment on function public.admin_set_price(text, uuid, text, bigint, integer, timestamptz) is
  'Admin-only price change. Retires the live row and inserts a new one in one transaction. Writes product_prices only.';

revoke all on function public.admin_set_price(text, uuid, text, bigint, integer, timestamptz) from public, anon;
grant execute on function public.admin_set_price(text, uuid, text, bigint, integer, timestamptz)
  to authenticated, service_role;
