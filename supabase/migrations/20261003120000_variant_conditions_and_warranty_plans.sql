-- ============================================================================
-- Per-variant product condition, product/variant warranty plans and
-- per-variant product images
-- ----------------------------------------------------------------------------
-- Migration 20261002120000 stored condition and warranty on public.products, so
-- one product-level value applied to every variant: marking an iPhone Pre-Owned
-- made all of its storage/colour variants Pre-Owned. This migration makes them
-- independently configurable per variant.
--
-- 1. public.product_conditions     - condition + pre-owned details, keyed like
--                                    product_prices: (product_id, variant_id).
--      * A product WITH variants takes each variant's condition ONLY from that
--        variant's own row; no row = Brand New. It never inherits.
--      * A product WITHOUT variants uses its (product_id, NULL) row; no row =
--        Brand New.
-- 2. public.product_warranty_plans - warranty type, included duration and terms,
--                                    keyed the same way. Resolution:
--        variant plan -> product plan (variant_id NULL) -> no warranty.
--      Unlike condition, falling back to the product here is intended: most
--      variants share the product's warranty, and an override is explicit.
-- 3. public.product_warranty_options gains plan_id: options belong to a plan,
--    not a product. One default and one row per duration, per PLAN.
-- 4. public.product_images gains variant_id: NULL = shared by all variants,
--    set = shown only for that variant (e.g. actual-unit photos).
-- 5. public.place_order() resolves condition and warranty from the selected
--    variant. Pricing, VIP fallback, stock and anti-tampering are unchanged.
--
-- "A variant must belong to the referenced product" is enforced by composite
-- foreign keys (variant_id, product_id) -> product_variants (id, product_id),
-- so a row can never pair product A with a variant of product B.
--
-- EXISTING DATA (documented decisions, not silent ones):
--   * Products WITHOUT variants: products.condition and its pre-owned columns
--     are copied into a (product_id, NULL) condition row - one row per product,
--     including Brand New, so nothing is inferred later.
--   * Products WITH variants: NOTHING is copied. A product-level Pre-Owned value
--     (production: iPhone 17 Pro Max, 4 variants) does not say WHICH variant is
--     the used unit, and copying it to every variant would recreate exactly the
--     problem this migration fixes. Those values stay in the products columns,
--     untouched, until an administrator assigns them per variant in the editor
--     (which surfaces them). Until then those variants read as Brand New.
--   * Warranty: every product gets a product-level plan copied from its
--     products.warranty_* columns, and every existing option is attached to it.
--     No variant overrides are created.
--   * Existing images keep variant_id NULL (shared). Existing orders are not
--     touched: order_items snapshots are the record.
--   * The products.condition* and products.warranty_* columns are KEPT for app
--     builds already installed on phones. Triggers mirror the product-level
--     (variant_id NULL) condition row and plan back into them; the new tables
--     are authoritative. A later migration can drop them once no supported build
--     reads them.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Composite keys that let child rows prove variant/product consistency
-- ----------------------------------------------------------------------------
alter table public.product_variants
  add constraint product_variants_id_product_uq unique (id, product_id);


-- ----------------------------------------------------------------------------
-- 1. product_conditions
-- ----------------------------------------------------------------------------
create table public.product_conditions (
  id                    uuid primary key default gen_random_uuid(),
  product_id            text not null references public.products (id) on delete cascade,
  variant_id            uuid,
  condition             text not null
                        check (condition in ('brand_new', 'pre_owned', 'refurbished')),
  condition_grade_id    uuid references public.condition_grades (id) on delete set null,
  battery_health        smallint check (battery_health is null or battery_health between 0 and 100),
  cycle_count           integer check (cycle_count is null or cycle_count >= 0),
  physical_condition    text check (physical_condition is null or length(physical_condition) <= 500),
  accessories_included  text check (accessories_included is null or length(accessories_included) <= 500),
  device_notes          text check (device_notes is null or length(device_notes) <= 2000),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint product_conditions_variant_fk
    foreign key (variant_id, product_id)
    references public.product_variants (id, product_id) on delete cascade,
  constraint product_conditions_one_per_target
    unique nulls not distinct (product_id, variant_id)
);

create trigger product_conditions_set_updated_at
  before update on public.product_conditions
  for each row execute function public.set_updated_at();

create index product_conditions_variant_idx on public.product_conditions (variant_id)
  where variant_id is not null;
create index product_conditions_grade_idx on public.product_conditions (condition_grade_id)
  where condition_grade_id is not null;

comment on table public.product_conditions is
  'Condition per sellable item. (product_id, NULL) for a product without variants; (product_id, variant_id) per variant. No row = Brand New; a variant never inherits a product-level row.';


-- ----------------------------------------------------------------------------
-- 2. product_warranty_plans
-- ----------------------------------------------------------------------------
create table public.product_warranty_plans (
  id                    uuid primary key default gen_random_uuid(),
  product_id            text not null references public.products (id) on delete cascade,
  variant_id            uuid,
  warranty_type         text not null default 'none'
                        check (warranty_type in ('none', 'included', 'optional_paid')),
  -- For 'included': the fixed cover, e.g. '1 Year' / 12.
  warranty_duration     text check (warranty_duration is null or length(warranty_duration) <= 60),
  warranty_months       integer check (warranty_months is null or warranty_months >= 0),
  warranty_title        text check (warranty_title is null or length(warranty_title) <= 120),
  warranty_description  text check (warranty_description is null or length(warranty_description) <= 2000),
  warranty_covered      text[] not null default '{}' check (cardinality(warranty_covered) <= 30),
  warranty_excluded     text[] not null default '{}' check (cardinality(warranty_excluded) <= 30),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint product_warranty_plans_variant_fk
    foreign key (variant_id, product_id)
    references public.product_variants (id, product_id) on delete cascade,
  constraint product_warranty_plans_one_per_target
    unique nulls not distinct (product_id, variant_id),
  constraint product_warranty_plans_id_product_uq unique (id, product_id)
);

create trigger product_warranty_plans_set_updated_at
  before update on public.product_warranty_plans
  for each row execute function public.set_updated_at();

create index product_warranty_plans_variant_idx on public.product_warranty_plans (variant_id)
  where variant_id is not null;

comment on table public.product_warranty_plans is
  'Warranty configuration. variant_id NULL = the product default; a variant row overrides it for that variant. Neither = no warranty.';


-- ----------------------------------------------------------------------------
-- Backfill (see EXISTING DATA above)
-- ----------------------------------------------------------------------------
-- Conditions: products WITHOUT variants only.
insert into public.product_conditions
  (product_id, variant_id, condition, condition_grade_id, battery_health, cycle_count,
   physical_condition, accessories_included, device_notes)
select p.id, null, p.condition, p.condition_grade_id, p.battery_health, p.cycle_count,
       p.physical_condition, p.accessories_included, p.device_notes
from public.products p
where not exists (select 1 from public.product_variants v where v.product_id = p.id);

-- Warranty: one product-level plan per product, copied from its columns.
insert into public.product_warranty_plans
  (product_id, variant_id, warranty_type, warranty_duration, warranty_months,
   warranty_title, warranty_description, warranty_covered, warranty_excluded)
select p.id, null, p.warranty_type, p.warranty_duration, p.warranty_months,
       p.warranty_title, p.warranty_description, p.warranty_covered, p.warranty_excluded
from public.products p;


-- ----------------------------------------------------------------------------
-- 3. product_warranty_options -> per plan
-- ----------------------------------------------------------------------------
alter table public.product_warranty_options add column plan_id uuid;

update public.product_warranty_options o
   set plan_id = pl.id
  from public.product_warranty_plans pl
 where pl.product_id = o.product_id and pl.variant_id is null;

alter table public.product_warranty_options
  alter column plan_id set not null,
  -- product_id is kept (RLS and older app builds read it) and must match the plan's.
  add constraint product_warranty_options_plan_fk
    foreign key (plan_id, product_id)
    references public.product_warranty_plans (id, product_id) on delete cascade,
  drop constraint product_warranty_options_product_id_duration_months_key,
  add constraint product_warranty_options_plan_duration_uq unique (plan_id, duration_months);

drop index public.product_warranty_options_one_default;
create unique index product_warranty_options_one_default
  on public.product_warranty_options (plan_id) where is_default;
create index product_warranty_options_plan_idx
  on public.product_warranty_options (plan_id, display_order);

-- Deleting a variant now removes its warranty plan and that plan's options in
-- the same statement that sets order_items.variant_id to NULL. The SET NULL on
-- variant_id re-validates the line's warranty_option_id before that option's
-- own ON DELETE SET NULL has run, so an ordered variant with a warranty override
-- could not be deleted (verified locally; deferring only to end of statement is
-- not enough). The check is therefore deferred to COMMIT: it is still enforced,
-- both SET NULL actions complete, and the order line keeps its snapshots.
alter table public.order_items
  alter constraint order_items_warranty_option_id_fkey deferrable initially deferred;

comment on column public.product_warranty_options.plan_id is
  'The warranty plan (product default or variant override) this option belongs to.';


-- ----------------------------------------------------------------------------
-- 4. product_images.variant_id
-- ----------------------------------------------------------------------------
alter table public.product_images
  add column variant_id uuid,
  add constraint product_images_variant_fk
    foreign key (variant_id, product_id)
    references public.product_variants (id, product_id) on delete cascade;

create index product_images_variant_idx on public.product_images (variant_id)
  where variant_id is not null;

comment on column public.product_images.variant_id is
  'NULL = shown for every variant. Set = shown only for that variant (e.g. actual-unit photos of a pre-owned variant).';


-- ----------------------------------------------------------------------------
-- Backward compatibility: mirror the PRODUCT-LEVEL row/plan into the old
-- products columns that installed app builds still read. Security invoker:
-- the writer must already be allowed to update products (admin).
-- ----------------------------------------------------------------------------
create or replace function public.mirror_product_condition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.variant_id is null then
      update public.products
         set condition = 'brand_new', condition_grade_id = null, battery_health = null,
             cycle_count = null, physical_condition = null, accessories_included = null,
             device_notes = null
       where id = old.product_id;
    end if;
    return old;
  end if;
  if new.variant_id is null then
    update public.products
       set condition = new.condition, condition_grade_id = new.condition_grade_id,
           battery_health = new.battery_health, cycle_count = new.cycle_count,
           physical_condition = new.physical_condition,
           accessories_included = new.accessories_included, device_notes = new.device_notes
     where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger product_conditions_mirror
  after insert or update or delete on public.product_conditions
  for each row execute function public.mirror_product_condition();

create or replace function public.mirror_product_warranty_plan()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.variant_id is null then
      update public.products set warranty_type = 'none', warranty_status = 'none'
       where id = old.product_id;
    end if;
    return old;
  end if;
  if new.variant_id is null then
    update public.products
       set warranty_type = new.warranty_type,
           warranty_status = case when new.warranty_type = 'none' then 'none' else 'active' end,
           warranty_duration = new.warranty_duration, warranty_months = new.warranty_months,
           warranty_title = new.warranty_title, warranty_description = new.warranty_description,
           warranty_covered = new.warranty_covered, warranty_excluded = new.warranty_excluded
     where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger product_warranty_plans_mirror
  after insert or update or delete on public.product_warranty_plans
  for each row execute function public.mirror_product_warranty_plan();

revoke all on function public.mirror_product_condition() from public, anon;
revoke all on function public.mirror_product_warranty_plan() from public, anon;


-- ----------------------------------------------------------------------------
-- RLS - the catalog model: public reads of active products, staff read, admin
-- writes, no anonymous writes.
-- ----------------------------------------------------------------------------
alter table public.product_conditions     enable row level security;
alter table public.product_warranty_plans enable row level security;

create policy "product_conditions public read" on public.product_conditions
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_conditions.product_id and p.is_active));
create policy "product_conditions staff read" on public.product_conditions
  for select to authenticated using (private.has_role('staff'));
create policy "product_conditions admin all" on public.product_conditions
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy "product_warranty_plans public read" on public.product_warranty_plans
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_warranty_plans.product_id and p.is_active));
create policy "product_warranty_plans staff read" on public.product_warranty_plans
  for select to authenticated using (private.has_role('staff'));
create policy "product_warranty_plans admin all" on public.product_warranty_plans
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

revoke insert, update, delete, truncate on public.product_conditions     from anon;
revoke insert, update, delete, truncate on public.product_warranty_plans from anon;
revoke truncate on public.product_conditions, public.product_warranty_plans from authenticated;


-- ----------------------------------------------------------------------------
-- 5. place_order() - condition and warranty from the SELECTED VARIANT
-- ----------------------------------------------------------------------------
-- Same signature, grants and pricing as migration 20261002120000. Changed:
--   condition: the variant's own product_conditions row (product with variants)
--              or the (product, NULL) row (product without variants); none =
--              brand_new. products.condition is never read.
--   warranty:  variant plan -> product plan -> no warranty; the option must be
--              an enabled option of THAT plan.
--   image:     the variant's own image first, then a shared one.
create or replace function public.place_order(
  p_lines jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_tier       text;
  v_settings   public.store_settings;
  v_order_id   uuid;
  v_number     text;
  v_subtotal   bigint := 0;
  v_line       jsonb;
  v_qty        integer;
  v_product    public.products;
  v_variant    public.product_variants;
  v_variant_key text;
  v_option_id  uuid;
  v_option     public.product_warranty_options;
  v_plan       public.product_warranty_plans;
  v_wtype      text;
  v_cond       public.product_conditions;
  v_condition  text;
  v_price      record;
  v_base       bigint;
  v_warranty   bigint;
  v_stock      integer;
  v_grade      text;
  v_image      text;
  v_label      text;
begin
  if v_uid is null then
    raise exception 'not_authenticated: sign in to place an order' using errcode = '42501';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 50 then
    raise exception 'invalid_lines: between 1 and 50 order lines are required' using errcode = '22023';
  end if;

  if p_notes is not null and length(p_notes) > 500 then
    raise exception 'invalid_notes: notes are limited to 500 characters' using errcode = '22023';
  end if;

  v_tier := private.current_customer_type();

  select * into v_settings from public.store_settings where id;
  if found then
    if v_settings.maintenance_mode then
      raise exception 'store_unavailable: the store is in maintenance mode' using errcode = 'P0001';
    end if;
    if v_tier = 'retail' and not v_settings.retail_enabled then
      raise exception 'store_unavailable: the retail store is unavailable' using errcode = 'P0001';
    end if;
    if v_tier = 'wholesale_vip' and not v_settings.wholesale_enabled then
      raise exception 'store_unavailable: the wholesale store is unavailable' using errcode = 'P0001';
    end if;
  end if;

  v_number := 'AE-' || to_char(now() at time zone 'Asia/Colombo', 'YYMMDD') || '-'
              || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.orders (order_number, profile_id, status, customer_type_at_purchase,
                             subtotal_cents, total_cents, currency, notes)
  values (v_number, v_uid, 'pending', v_tier, 0, 0, 'LKR', nullif(btrim(p_notes), ''))
  returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_line) <> 'object' then
      raise exception 'invalid_lines: each line must be an object' using errcode = '22023';
    end if;

    if coalesce(jsonb_typeof(v_line -> 'quantity'), '') <> 'number'
       or coalesce(v_line ->> 'quantity', '') !~ '^[0-9]{1,2}$'
       or (v_line ->> 'quantity')::integer < 1 then
      raise exception 'invalid_quantity: quantity must be a whole number from 1 to 99' using errcode = '22023';
    end if;
    v_qty := (v_line ->> 'quantity')::integer;

    select * into v_product from public.products
     where id = v_line ->> 'product_id' and is_active;
    if not found then
      raise exception 'product_unavailable: %', coalesce(v_line ->> 'product_id', '(missing)') using errcode = 'P0001';
    end if;

    v_variant := null;
    v_variant_key := nullif(v_line ->> 'variant_key', '');
    if v_variant_key is not null then
      select * into v_variant from public.product_variants
       where product_id = v_product.id and legacy_key = v_variant_key;
      if not found then
        raise exception 'variant_unavailable: % / %', v_product.id, v_variant_key using errcode = 'P0001';
      end if;
    elsif exists (select 1 from public.product_variants where product_id = v_product.id) then
      raise exception 'variant_required: choose an option for %', v_product.id using errcode = 'P0001';
    end if;

    -- Base price, resolved here at the caller's tier (unchanged).
    select * into v_price from private.live_price(v_product.id, v_variant.id, v_tier);
    if v_price is null and v_tier <> 'retail' and v_variant.id is not null then
      select * into v_price from private.live_price(v_product.id, v_variant.id, 'retail');
    end if;
    if v_price is null then
      select * into v_price from private.live_price(v_product.id, null, v_tier);
    end if;
    if v_price is null and v_tier <> 'retail' then
      select * into v_price from private.live_price(v_product.id, null, 'retail');
    end if;
    if v_price is null then
      raise exception 'price_unavailable: % has no price yet', v_product.id using errcode = 'P0001';
    end if;
    v_base := v_price.price_cents;

    v_stock := coalesce(v_variant.stock, v_product.stock);
    if v_qty > v_stock then
      raise exception 'insufficient_stock: % (requested %, available %)', v_product.id, v_qty, v_stock
        using errcode = 'P0001';
    end if;

    -- Condition of the item actually bought. A variant uses only its own row.
    v_cond := null;
    select * into v_cond from public.product_conditions
     where product_id = v_product.id and variant_id is not distinct from v_variant.id;
    v_condition := coalesce(v_cond.condition, 'brand_new');
    v_grade := null;
    if v_cond.condition_grade_id is not null then
      select g.label into v_grade from public.condition_grades g where g.id = v_cond.condition_grade_id;
    end if;

    -- Warranty plan: the variant's override, else the product default, else none.
    v_plan := null;
    if v_variant.id is not null then
      select * into v_plan from public.product_warranty_plans
       where product_id = v_product.id and variant_id = v_variant.id;
    end if;
    if v_plan.id is null then
      select * into v_plan from public.product_warranty_plans
       where product_id = v_product.id and variant_id is null;
    end if;
    v_wtype := coalesce(v_plan.warranty_type, 'none');

    v_option := null;
    v_warranty := 0;
    v_label := null;
    v_option_id := null;
    if v_line ? 'warranty_option_id' and jsonb_typeof(v_line -> 'warranty_option_id') = 'string' then
      begin
        v_option_id := (v_line ->> 'warranty_option_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'warranty_option_invalid: malformed id' using errcode = '22023';
      end;
    end if;

    if v_wtype = 'optional_paid' then
      if v_option_id is null then
        select * into v_option from public.product_warranty_options
         where plan_id = v_plan.id and is_default and is_enabled;
      else
        select * into v_option from public.product_warranty_options
         where id = v_option_id and plan_id = v_plan.id and is_enabled;
      end if;
      if v_option.id is null then
        raise exception 'warranty_option_invalid: choose an available warranty for %', v_product.id
          using errcode = 'P0001';
      end if;
      v_warranty := v_option.additional_price_cents;
      v_label := v_option.duration_months || case when v_option.duration_months = 1 then ' Month' else ' Months' end
                 || case v_product.subcategory
                      when 'Displays'  then ' Part Warranty'
                      when 'Batteries' then ' Battery Warranty'
                      else ' Warranty' end;
    elsif v_option_id is not null then
      raise exception 'warranty_not_applicable: % has no selectable warranty', v_product.id using errcode = 'P0001';
    elsif v_wtype = 'included' then
      v_label := coalesce(nullif(btrim(v_plan.warranty_duration), '') || ' Warranty (included)', 'Included warranty');
    end if;

    select i.path into v_image from public.product_images i
     where i.product_id = v_product.id
       and (i.variant_id is null or i.variant_id is not distinct from v_variant.id)
     order by (i.variant_id is not null) desc, i.is_primary desc, i.position asc limit 1;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name_snapshot, variant_label_snapshot,
      image_path_snapshot, unit_price_cents, quantity, line_total_cents, tier_code_snapshot,
      price_id, base_unit_price_cents, condition_snapshot, condition_grade_snapshot,
      warranty_option_id, warranty_months_snapshot, warranty_label_snapshot,
      warranty_price_cents_snapshot
    ) values (
      v_order_id, v_product.id, v_variant.id, v_product.name, v_variant.name,
      v_image, v_base + v_warranty, v_qty, (v_base + v_warranty) * v_qty, v_price.tier_code,
      v_price.price_id, v_base, v_condition, v_grade,
      v_option.id,
      case v_wtype
        when 'optional_paid' then v_option.duration_months
        when 'included' then v_plan.warranty_months
      end,
      v_label,
      v_warranty
    );

    v_subtotal := v_subtotal + (v_base + v_warranty) * v_qty;
  end loop;

  update public.orders
     set subtotal_cents = v_subtotal, total_cents = v_subtotal
   where id = v_order_id;

  insert into public.order_events (order_id, from_status, to_status, actor_id, note)
  values (v_order_id, null, 'pending', v_uid, 'Order placed by customer');

  return jsonb_build_object('id', v_order_id, 'order_number', v_number, 'total_cents', v_subtotal);
end;
$$;

comment on function public.place_order(jsonb, text) is
  'Customer order placement. Prices, warranty add-on, condition and warranty plan are resolved server-side for the selected variant; the client never supplies an amount.';


-- ----------------------------------------------------------------------------
-- Rollback (manual, if ever needed):
--   (restore place_order from migration 20261002120000 first)
--   alter table public.order_items alter constraint order_items_warranty_option_id_fkey not deferrable;
--   drop trigger if exists product_conditions_mirror on public.product_conditions;
--   drop trigger if exists product_warranty_plans_mirror on public.product_warranty_plans;
--   drop function if exists public.mirror_product_condition();
--   drop function if exists public.mirror_product_warranty_plan();
--   alter table public.product_images drop constraint if exists product_images_variant_fk,
--     drop column if exists variant_id;
--   drop index if exists public.product_warranty_options_one_default;
--   alter table public.product_warranty_options drop constraint if exists product_warranty_options_plan_fk,
--     drop constraint if exists product_warranty_options_plan_duration_uq, drop column if exists plan_id,
--     add constraint product_warranty_options_product_id_duration_months_key unique (product_id, duration_months);
--   create unique index product_warranty_options_one_default
--     on public.product_warranty_options (product_id) where is_default;
--   drop table if exists public.product_warranty_plans;
--   drop table if exists public.product_conditions;
--   alter table public.product_variants drop constraint if exists product_variants_id_product_uq;
-- ----------------------------------------------------------------------------
