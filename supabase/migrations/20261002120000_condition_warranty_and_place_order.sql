-- ============================================================================
-- Product condition, universal product warranty, product image storage and
-- server-side order placement
-- ----------------------------------------------------------------------------
-- 1. public.condition_grades   - admin-defined grade list (A+, A, ... or
--                                whatever the business uses). Seeded EMPTY: the
--                                grading terminology is a business decision.
-- 2. public.products           - condition (+ pre-owned details) and warranty
--                                type/terms, on the one canonical product row.
--                                Condition is a dimension, not a category.
-- 3. public.product_warranty_options
--                              - one reusable warranty system for devices,
--                                displays, batteries and every other product.
--                                One row per option, never per-duration columns.
-- 4. public.order_items        - warranty / condition snapshot columns.
-- 5. public.place_order()      - the SECURITY DEFINER order RPC that migration
--                                12 reserved: every price (product AND warranty)
--                                is resolved here, never accepted from a client.
-- 6. storage bucket `product-images` - admin-uploaded product photos, including
--                                actual-unit photos of pre-owned devices.
--
-- DOCUMENTED DECISIONS (not silent ones):
--   * 'refurbished' is accepted by the CHECK so it can be enabled later without
--     a migration, but the admin UI offers only brand_new / pre_owned until the
--     business confirms it sells refurbished stock.
--   * Warranty add-on prices are one price per option for every customer type.
--     If the business later needs tier-specific warranty prices, add a nullable
--     tier_code to product_warranty_options (NULL = all tiers) and extend
--     place_order(); nothing else has to change.
--   * IMEI / serial tracking is deferred: there is no per-unit inventory to
--     attach it to, and nothing here exposes one.
--   * place_order() does not decrement stock. Orders are created 'pending' with
--     no payment step yet, so reserving stock on an unpaid order would let
--     abandoned orders empty the shelf. It does refuse quantities above the
--     stock currently on record.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. condition_grades
-- ----------------------------------------------------------------------------
create table public.condition_grades (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (length(btrim(code)) between 1 and 12),
  label        text not null check (length(btrim(label)) between 1 and 60),
  description  text check (description is null or length(description) <= 500),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger condition_grades_set_updated_at
  before update on public.condition_grades
  for each row execute function public.set_updated_at();

comment on table public.condition_grades is
  'Admin-defined grading scale for pre-owned products. Codes and meanings are business-defined; nothing is seeded.';


-- ----------------------------------------------------------------------------
-- 2. products: condition + warranty type and terms
-- ----------------------------------------------------------------------------
alter table public.products
  add column condition text not null default 'brand_new'
    check (condition in ('brand_new', 'pre_owned', 'refurbished')),
  add column condition_grade_id uuid
    references public.condition_grades (id) on delete set null,
  add column battery_health smallint
    check (battery_health is null or battery_health between 0 and 100),
  add column cycle_count integer
    check (cycle_count is null or cycle_count >= 0),
  add column physical_condition text
    check (physical_condition is null or length(physical_condition) <= 500),
  add column accessories_included text
    check (accessories_included is null or length(accessories_included) <= 500),
  add column device_notes text
    check (device_notes is null or length(device_notes) <= 2000),

  add column warranty_type text not null default 'none'
    check (warranty_type in ('none', 'included', 'optional_paid')),
  add column warranty_title text
    check (warranty_title is null or length(warranty_title) <= 120),
  add column warranty_description text
    check (warranty_description is null or length(warranty_description) <= 2000),
  add column warranty_covered text[] not null default '{}'
    check (cardinality(warranty_covered) <= 30),
  add column warranty_excluded text[] not null default '{}'
    check (cardinality(warranty_excluded) <= 30);

create index products_condition_idx on public.products (condition) where is_active;
create index products_condition_grade_idx on public.products (condition_grade_id)
  where condition_grade_id is not null;

comment on column public.products.condition is
  'brand_new | pre_owned | refurbished. Independent of category. refurbished is accepted but not offered in the admin UI yet.';
comment on column public.products.warranty_type is
  'none = no warranty; included = the fixed warranty described by warranty_duration/months and the terms; optional_paid = customer picks from product_warranty_options.';
comment on column public.products.warranty_status is
  'Legacy display flag, kept for existing rows. warranty_type is authoritative for ordering.';

-- Existing products keep meaning what they meant: an 'active' warranty is an
-- included one, everything else has none.
update public.products
   set warranty_type = case when warranty_status = 'active' then 'included' else 'none' end;


-- ----------------------------------------------------------------------------
-- 3. product_warranty_options
-- ----------------------------------------------------------------------------
create table public.product_warranty_options (
  id                      uuid primary key default gen_random_uuid(),
  product_id              text not null references public.products (id) on delete cascade,
  duration_months         integer not null check (duration_months between 1 and 120),
  -- LKR minor units, like every other price. 0 = included at no extra cost.
  additional_price_cents  bigint not null default 0 check (additional_price_cents >= 0),
  is_enabled              boolean not null default true,
  is_default              boolean not null default false,
  display_order           integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (product_id, duration_months),
  constraint product_warranty_options_default_enabled check (not is_default or is_enabled)
);

create trigger product_warranty_options_set_updated_at
  before update on public.product_warranty_options
  for each row execute function public.set_updated_at();

-- At most one default per product.
create unique index product_warranty_options_one_default
  on public.product_warranty_options (product_id) where is_default;
create index product_warranty_options_product_idx
  on public.product_warranty_options (product_id, display_order);

comment on table public.product_warranty_options is
  'Selectable warranty durations and add-on prices per product (warranty_type = optional_paid). One price for all customer tiers.';


-- ----------------------------------------------------------------------------
-- 4. order_items: what was bought, frozen at placement
-- ----------------------------------------------------------------------------
alter table public.order_items
  add column base_unit_price_cents bigint
    check (base_unit_price_cents is null or base_unit_price_cents >= 0),
  add column condition_snapshot text,
  add column condition_grade_snapshot text,
  -- Audit pointer only, like price_id. The snapshot columns are the record.
  add column warranty_option_id uuid
    references public.product_warranty_options (id) on delete set null,
  add column warranty_months_snapshot integer,
  add column warranty_label_snapshot text,
  add column warranty_price_cents_snapshot bigint not null default 0
    check (warranty_price_cents_snapshot >= 0),
  add constraint order_items_unit_price_breakdown
    check (base_unit_price_cents is null
           or unit_price_cents = base_unit_price_cents + warranty_price_cents_snapshot);

comment on column public.order_items.unit_price_cents is
  'Charged unit price = base_unit_price_cents + warranty_price_cents_snapshot (for lines placed through place_order).';


-- ----------------------------------------------------------------------------
-- RLS for the new catalog tables - public reads of live rows, admin writes,
-- the same shape as every other catalog table in migration 12.
-- ----------------------------------------------------------------------------
alter table public.condition_grades         enable row level security;
alter table public.product_warranty_options enable row level security;

create policy "condition_grades public read" on public.condition_grades
  for select to anon, authenticated using (is_active);
create policy "condition_grades staff read" on public.condition_grades
  for select to authenticated using (private.has_role('staff'));
create policy "condition_grades admin all" on public.condition_grades
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy "product_warranty_options public read" on public.product_warranty_options
  for select to anon, authenticated
  using (is_enabled and exists (select 1 from public.products p
                                where p.id = product_warranty_options.product_id and p.is_active));
create policy "product_warranty_options staff read" on public.product_warranty_options
  for select to authenticated using (private.has_role('staff'));
create policy "product_warranty_options admin all" on public.product_warranty_options
  for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

-- Defence in depth: anonymous callers can never write either table, whatever a
-- future policy says.
revoke insert, update, delete, truncate on public.condition_grades         from anon;
revoke insert, update, delete, truncate on public.product_warranty_options from anon;
revoke truncate on public.condition_grades, public.product_warranty_options from authenticated;


-- ----------------------------------------------------------------------------
-- 5. place_order()
-- ----------------------------------------------------------------------------
-- The live price for one product/variant at one tier, exactly as my_prices
-- defines "live" (min_qty 1, inside its window). Returns no row when unset.
create or replace function private.live_price(p_product_id text, p_variant_id uuid, p_tier text)
returns table (price_id uuid, price_cents bigint, tier_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select pp.id, pp.price_cents, pp.tier_code
  from public.product_prices pp
  where pp.product_id = p_product_id
    and pp.variant_id is not distinct from p_variant_id
    and pp.tier_code = p_tier
    and pp.min_qty = 1
    and now() >= pp.starts_at
    and (pp.ends_at is null or now() < pp.ends_at)
  order by pp.starts_at desc
  limit 1;
$$;

-- Never callable by clients: it reads every tier, VIP rows included.
revoke all on function private.live_price(text, uuid, text) from public, anon, authenticated;

/*
 * Places an order for the signed-in customer.
 *
 * p_lines: [{ "product_id": text, "variant_key": text|null,
 *             "warranty_option_id": uuid|null, "quantity": int }, ...]
 *
 * The client sends WHAT it wants, never what it costs. Every amount is resolved
 * here, at the caller's tier from private.current_customer_type() (the same
 * function my_effective_prices relies on), with the storefront's precedence:
 *
 *   variant price at the caller's tier
 *   -> variant retail price            (VIP only: VIP falls back to retail)
 *   -> product price at the caller's tier
 *   -> product retail price            (VIP only)
 *
 * The warranty add-on is read from product_warranty_options; a disabled or
 * foreign option, or an option on a product that does not sell one, is refused.
 */
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

  -- The storefront switches in /admin/settings close ordering too, not just
  -- the screens (a customer could otherwise call this RPC directly).
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

    -- Quantity: a whole number from 1 to 99.
    -- coalesce: a missing key yields NULL, which must fail the check, not skip it.
    if coalesce(jsonb_typeof(v_line -> 'quantity'), '') <> 'number'
       or coalesce(v_line ->> 'quantity', '') !~ '^[0-9]{1,2}$'
       or (v_line ->> 'quantity')::integer < 1 then
      raise exception 'invalid_quantity: quantity must be a whole number from 1 to 99' using errcode = '22023';
    end if;
    v_qty := (v_line ->> 'quantity')::integer;

    -- Product: must exist AND be published.
    select * into v_product from public.products
     where id = v_line ->> 'product_id' and is_active;
    if not found then
      raise exception 'product_unavailable: %', coalesce(v_line ->> 'product_id', '(missing)') using errcode = 'P0001';
    end if;

    -- Variant: required when the product has variants, by its legacy_key (the
    -- id the storefront and cart use).
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

    -- Base price, resolved here at the caller's tier.
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

    -- Stock on record (a variant without its own stock inherits the product's).
    v_stock := coalesce(v_variant.stock, v_product.stock);
    if v_qty > v_stock then
      raise exception 'insufficient_stock: % (requested %, available %)', v_product.id, v_qty, v_stock
        using errcode = 'P0001';
    end if;

    -- Warranty: only an enabled option of THIS product, only when it sells one.
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

    if v_product.warranty_type = 'optional_paid' then
      if v_option_id is null then
        select * into v_option from public.product_warranty_options
         where product_id = v_product.id and is_default and is_enabled;
      else
        select * into v_option from public.product_warranty_options
         where id = v_option_id and product_id = v_product.id and is_enabled;
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
    elsif v_product.warranty_type = 'included' then
      v_label := coalesce(nullif(btrim(v_product.warranty_duration), '') || ' Warranty (included)', 'Included warranty');
    end if;

    select g.label into v_grade from public.condition_grades g where g.id = v_product.condition_grade_id;
    select i.path into v_image from public.product_images i
     where i.product_id = v_product.id
     order by i.is_primary desc, i.position asc limit 1;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name_snapshot, variant_label_snapshot,
      image_path_snapshot, unit_price_cents, quantity, line_total_cents, tier_code_snapshot,
      price_id, base_unit_price_cents, condition_snapshot, condition_grade_snapshot,
      warranty_option_id, warranty_months_snapshot, warranty_label_snapshot,
      warranty_price_cents_snapshot
    ) values (
      v_order_id, v_product.id, v_variant.id, v_product.name, v_variant.name,
      v_image, v_base + v_warranty, v_qty, (v_base + v_warranty) * v_qty, v_price.tier_code,
      v_price.price_id, v_base, v_product.condition, v_grade,
      v_option.id,
      case v_product.warranty_type
        when 'optional_paid' then v_option.duration_months
        when 'included' then v_product.warranty_months
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
  'Customer order placement. Resolves product and warranty prices server-side at the caller''s tier; the client never supplies an amount.';

revoke all on function public.place_order(jsonb, text) from public, anon;
grant execute on function public.place_order(jsonb, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Product images in Supabase Storage
-- ----------------------------------------------------------------------------
-- Existing rows keep storage_bucket NULL and their bundled path, so every
-- current image URL keeps working. Uploaded images set storage_bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "product images admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and private.has_role('admin'));

create policy "product images admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and private.has_role('admin'))
  with check (bucket_id = 'product-images' and private.has_role('admin'));

create policy "product images admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and private.has_role('admin'));

create policy "product images staff list" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and private.has_role('staff'));

alter table public.product_images
  add constraint product_images_bucket_known
  check (storage_bucket is null or storage_bucket = 'product-images')
  not valid;


-- ----------------------------------------------------------------------------
-- Rollback (manual, if ever needed):
--   alter table public.product_images drop constraint if exists product_images_bucket_known;
--   drop policy if exists "product images admin insert" on storage.objects;
--   drop policy if exists "product images admin update" on storage.objects;
--   drop policy if exists "product images admin delete" on storage.objects;
--   drop policy if exists "product images staff list"   on storage.objects;
--   -- empty the bucket in the dashboard first, then:
--   delete from storage.buckets where id = 'product-images';
--   drop function if exists public.place_order(jsonb, text);
--   drop function if exists private.live_price(text, uuid, text);
--   alter table public.order_items drop constraint if exists order_items_unit_price_breakdown,
--     drop column if exists base_unit_price_cents, drop column if exists condition_snapshot,
--     drop column if exists condition_grade_snapshot, drop column if exists warranty_option_id,
--     drop column if exists warranty_months_snapshot, drop column if exists warranty_label_snapshot,
--     drop column if exists warranty_price_cents_snapshot;
--   drop table if exists public.product_warranty_options;
--   alter table public.products drop column if exists condition, drop column if exists condition_grade_id,
--     drop column if exists battery_health, drop column if exists cycle_count,
--     drop column if exists physical_condition, drop column if exists accessories_included,
--     drop column if exists device_notes, drop column if exists warranty_type,
--     drop column if exists warranty_title, drop column if exists warranty_description,
--     drop column if exists warranty_covered, drop column if exists warranty_excluded;
--   drop table if exists public.condition_grades;
-- ----------------------------------------------------------------------------
