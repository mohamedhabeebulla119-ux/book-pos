-- ============================================================================
-- Apple Expert · GRN, barcode-tracked units, FIFO reservation and in-store POS
-- ----------------------------------------------------------------------------
-- Until now stock was a NUMBER (products.stock / product_variants.stock). This
-- migration gives every physical item its own identity:
--
--   GRN (goods received note)  -> one row per delivery from a supplier
--     grn_lines                -> what arrived: product, variant, qty, cost
--       inventory_units        -> ONE ROW PER PHYSICAL ITEM, each with its own
--                                 barcode (AE00000001 ...) and, for phones, an
--                                 IMEI / serial number
--
-- and keeps the number honest: for a barcode-tracked item, the stock number is
-- always the count of its units that are on the shelf.
--
-- HOW A UNIT MOVES
--
--   in_stock --(customer orders online)--------> reserved --(shipped/delivered)--> sold
--      ^  \                                          |
--      |   \--(scanned at the shop counter, POS)-----+---------------------------> sold
--      |                                             |
--      +----(order cancelled or refunded)------------+
--      +----(admin: return of a counter sale)
--   in_stock --(admin: write off - damaged / GRN mistake)--> written_off
--
--   * Online: place_order() now TAKES stock when the order is placed. For a
--     barcode-tracked item it reserves the OLDEST units first (FIFO: earliest
--     GRN date, then the order they were received in). Customers never see a
--     barcode - only staff can read inventory_units.
--   * Cancelling or refunding an order puts its units (and the number) back.
--     Moving it out of cancelled/refunded again reserves fresh units, or is
--     refused if there are not enough.
--   * Shop counter: pos_create_sale() takes the scanned barcodes (or IMEIs),
--     marks exactly those units sold and prints a bill.
--
-- EVERY STOCK CHANGE STILL WRITES THE LEDGER. All of the above goes through
-- private.move_stock(), which writes the inventory_movements row first and the
-- stock second, exactly like admin_set_stock(), so the stock guard from
-- 20261023120000 is satisfied and not weakened.
--
-- DECISIONS (documented, not silent)
--   * An item becomes "barcode-tracked" the moment its first GRN is posted.
--     From then on Adjust stock (admin_set_stock) is refused for it: stock
--     arrives through a GRN and leaves through a sale or a write-off.
--   * A GRN is refused for an item that still has untracked stock (a number
--     with no units behind it). Set that number to 0 with Adjust stock (a stock
--     count), then receive the physical items through a GRN so every one gets
--     a barcode label.
--   * Categories gain requires_serial. It is switched on for iPhone: every
--     unit received must carry an IMEI / serial number, unique across units.
--     A 15-digit IMEI must pass the Luhn check (catches a mistyped digit).
--   * GRN and write-off: admin and owner (same as Adjust stock). POS sale and
--     unit lookup: staff, admin and owner (cashiers are usually staff).
--   * POS price is the item's live RETAIL price, resolved here (the client
--     never sends a price). The cashier may give one bill-level discount.
--   * Orders placed BEFORE this migration took no stock, so cancelling them
--     returns none (orders.stock_state is NULL for them).
--   * A refund returns the units to the shelf (the item is assumed returned);
--     write it off afterwards if it came back damaged.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Pre-flight
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.admin_set_stock(text, uuid, integer, integer, text, text, uuid)') is null then
    raise exception 'pre-flight: admin_set_stock() is missing; apply 20261023120000 first';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'inventory_movements'
                   and column_name = 'quantity_after') then
    raise exception 'pre-flight: inventory_movements.quantity_after is missing; apply 20261023120000 first';
  end if;
end
$$;


-- ----------------------------------------------------------------------------
-- 1. Categories: which ones need an IMEI / serial per unit
-- ----------------------------------------------------------------------------
alter table public.categories
  add column requires_serial boolean not null default false;

comment on column public.categories.requires_serial is
  'When true, every unit received through a GRN for a product in this category must carry a unique IMEI / serial number.';

update public.categories set requires_serial = true where slug = 'iphone';


-- ----------------------------------------------------------------------------
-- 2. Number sequences (private: only the functions below draw from them)
-- ----------------------------------------------------------------------------
create sequence private.inventory_unit_barcode_seq;
create sequence private.grn_number_seq;
create sequence private.pos_bill_number_seq;


-- ----------------------------------------------------------------------------
-- 3. Tables
-- ----------------------------------------------------------------------------
create table public.grns (
  id                uuid primary key default gen_random_uuid(),
  grn_number        text not null unique,
  supplier_name     text not null check (length(btrim(supplier_name)) between 2 and 120),
  supplier_invoice  text check (supplier_invoice is null or length(supplier_invoice) <= 60),
  received_on       date not null,
  note              text check (note is null or length(note) <= 500),
  total_units       integer not null check (total_units > 0),
  total_cost_cents  bigint  not null default 0 check (total_cost_cents >= 0),
  created_by        uuid references public.profiles (id) on delete set null,
  request_id        uuid not null unique,
  created_at        timestamptz not null default now()
);

create index grns_received_idx on public.grns (received_on desc, created_at desc);

comment on table public.grns is
  'Goods received notes. Written only by admin_post_grn(); never edited afterwards (mistakes are corrected by writing units off).';

create table public.grn_lines (
  id                      uuid primary key default gen_random_uuid(),
  grn_id                  uuid not null references public.grns (id) on delete restrict,
  line_no                 smallint not null check (line_no > 0),
  product_id              text not null references public.products (id) on delete restrict,
  variant_id              uuid,
  product_name_snapshot   text not null,
  variant_label_snapshot  text,
  quantity                integer not null check (quantity between 1 and 500),
  unit_cost_cents         bigint  not null default 0 check (unit_cost_cents >= 0),
  constraint grn_lines_variant_fk
    foreign key (variant_id, product_id)
    references public.product_variants (id, product_id) on delete restrict,
  constraint grn_lines_line_no_uq unique (grn_id, line_no)
);

create index grn_lines_product_idx on public.grn_lines (product_id);

create table public.pos_sales (
  id                uuid primary key default gen_random_uuid(),
  bill_number       text not null unique,
  customer_name     text check (customer_name is null or length(customer_name) <= 120),
  customer_phone    text check (customer_phone is null or length(customer_phone) <= 30),
  payment_method    text not null check (payment_method in ('cash', 'card', 'bank_transfer', 'other')),
  subtotal_cents    bigint not null check (subtotal_cents >= 0),
  discount_cents    bigint not null default 0 check (discount_cents >= 0),
  total_cents       bigint not null check (total_cents >= 0),
  note              text check (note is null or length(note) <= 500),
  cashier_id        uuid references public.profiles (id) on delete set null,
  request_id        uuid not null unique,
  created_at        timestamptz not null default now(),
  constraint pos_sales_total_matches check (total_cents = subtotal_cents - discount_cents)
);

create index pos_sales_created_idx on public.pos_sales (created_at desc);

comment on table public.pos_sales is
  'In-store bills. Written only by pos_create_sale(); amounts are resolved server-side.';

create table public.inventory_units (
  id                 uuid primary key default gen_random_uuid(),
  barcode            text not null unique check (barcode ~ '^AE[0-9]{8,}$'),
  serial_number      text check (serial_number is null or serial_number ~ '^[A-Z0-9][A-Z0-9-]{3,29}$'),
  product_id         text not null references public.products (id) on delete restrict,
  variant_id         uuid,
  grn_id             uuid not null references public.grns (id) on delete restrict,
  grn_line_id        uuid not null references public.grn_lines (id) on delete restrict,
  unit_cost_cents    bigint not null default 0 check (unit_cost_cents >= 0),
  received_on        date not null,
  -- Receiving order. FIFO is (received_on, fifo_seq).
  fifo_seq           bigint generated always as identity,
  status             text not null default 'in_stock'
                     check (status in ('in_stock', 'reserved', 'sold', 'written_off')),
  order_id           uuid references public.orders (id) on delete set null,
  order_item_id      uuid references public.order_items (id) on delete set null,
  pos_sale_id        uuid references public.pos_sales (id) on delete restrict,
  status_changed_at  timestamptz not null default now(),
  status_note        text check (status_note is null or length(status_note) <= 500),
  created_at         timestamptz not null default now(),
  constraint inventory_units_variant_fk
    foreign key (variant_id, product_id)
    references public.product_variants (id, product_id) on delete restrict,
  -- A reserved unit always belongs to an order line; an in-stock one never does.
  constraint inventory_units_reserved_has_order
    check (status <> 'reserved' or order_item_id is not null),
  constraint inventory_units_in_stock_is_free
    check (status <> 'in_stock' or (order_id is null and order_item_id is null and pos_sale_id is null))
);

create unique index inventory_units_serial_key on public.inventory_units (serial_number)
  where serial_number is not null;
-- The FIFO pick: the oldest shelf unit of one product/variant.
create index inventory_units_fifo_idx on public.inventory_units (product_id, variant_id, received_on, fifo_seq)
  where status = 'in_stock';
create index inventory_units_order_item_idx on public.inventory_units (order_item_id)
  where order_item_id is not null;
create index inventory_units_order_idx on public.inventory_units (order_id)
  where order_id is not null;
create index inventory_units_grn_idx on public.inventory_units (grn_id);
create index inventory_units_pos_idx on public.inventory_units (pos_sale_id)
  where pos_sale_id is not null;

comment on table public.inventory_units is
  'One row per physical item. Readable by staff only, so customers never see a barcode or IMEI. Written only by SECURITY DEFINER functions.';

create table public.pos_sale_items (
  id                      uuid primary key default gen_random_uuid(),
  pos_sale_id             uuid not null references public.pos_sales (id) on delete restrict,
  unit_id                 uuid not null references public.inventory_units (id) on delete restrict,
  product_id              text references public.products (id) on delete set null,
  variant_id              uuid references public.product_variants (id) on delete set null,
  product_name_snapshot   text not null,
  variant_label_snapshot  text,
  barcode_snapshot        text not null,
  serial_snapshot         text,
  unit_price_cents        bigint not null check (unit_price_cents >= 0),
  price_id                uuid references public.product_prices (id) on delete set null,
  returned_at             timestamptz,
  return_note             text check (return_note is null or length(return_note) <= 500),
  constraint pos_sale_items_unit_once unique (pos_sale_id, unit_id)
);

create index pos_sale_items_sale_idx on public.pos_sale_items (pos_sale_id);
create index pos_sale_items_unit_idx on public.pos_sale_items (unit_id);

-- Orders: did placing this order take stock? NULL = placed before this
-- migration (took none); 'reserved' = holding stock; 'released' = given back.
alter table public.orders
  add column stock_state text check (stock_state is null or stock_state in ('reserved', 'released'));

comment on column public.orders.stock_state is
  'NULL for orders placed before stock was taken at placement. reserved = this order holds stock; released = cancelled/refunded and its stock was returned.';

-- Ledger: which GRN or counter bill caused a movement.
alter table public.inventory_movements
  add column grn_id      uuid references public.grns (id) on delete restrict,
  add column pos_sale_id uuid references public.pos_sales (id) on delete restrict;

create index inventory_movements_grn_idx on public.inventory_movements (grn_id) where grn_id is not null;
create index inventory_movements_pos_idx on public.inventory_movements (pos_sale_id) where pos_sale_id is not null;


-- ----------------------------------------------------------------------------
-- 4. Row level security: staff read, nobody writes directly
-- ----------------------------------------------------------------------------
alter table public.grns            enable row level security;
alter table public.grn_lines       enable row level security;
alter table public.inventory_units enable row level security;
alter table public.pos_sales       enable row level security;
alter table public.pos_sale_items  enable row level security;

create policy "grns staff read"            on public.grns            for select to authenticated using (private.has_role('staff'));
create policy "grn_lines staff read"       on public.grn_lines       for select to authenticated using (private.has_role('staff'));
create policy "inventory_units staff read" on public.inventory_units for select to authenticated using (private.has_role('staff'));
create policy "pos_sales staff read"       on public.pos_sales       for select to authenticated using (private.has_role('staff'));
create policy "pos_sale_items staff read"  on public.pos_sale_items  for select to authenticated using (private.has_role('staff'));

revoke all on public.grns, public.grn_lines, public.inventory_units, public.pos_sales, public.pos_sale_items
  from anon;
revoke insert, update, delete, truncate
  on public.grns, public.grn_lines, public.inventory_units, public.pos_sales, public.pos_sale_items
  from authenticated, service_role;
grant select on public.grns, public.grn_lines, public.inventory_units, public.pos_sales, public.pos_sale_items
  to authenticated;

revoke all on sequence private.inventory_unit_barcode_seq, private.grn_number_seq, private.pos_bill_number_seq
  from public;


-- ----------------------------------------------------------------------------
-- 5. Helpers
-- ----------------------------------------------------------------------------

-- Luhn check for a 15-digit IMEI.
create or replace function private.imei_ok(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_sum integer := 0;
  v_d   integer;
  i     integer;
begin
  if p_value !~ '^[0-9]{15}$' then
    return false;
  end if;
  for i in 1..15 loop
    v_d := substr(p_value, i, 1)::integer;
    if i % 2 = 0 then
      v_d := v_d * 2;
      if v_d > 9 then v_d := v_d - 9; end if;
    end if;
    v_sum := v_sum + v_d;
  end loop;
  return v_sum % 10 = 0;
end;
$$;

-- Upper-case, spaces removed. NULL / blank -> NULL.
create or replace function private.normalize_serial(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(upper(regexp_replace(coalesce(p_value, ''), '\s', '', 'g')), '')
$$;

-- Is this product barcode-tracked (has it ever received a unit)?
create or replace function private.is_unit_tracked(p_product_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.inventory_units u where u.product_id = p_product_id)
$$;

/*
 * The one place unit-driven stock changes happen. Same order as
 * admin_set_stock(): lock product, then variant -> ledger row -> stock.
 *
 * Stock lives on the variant only when that variant keeps its own number
 * (stock IS NOT NULL); otherwise every variant shares the product's number and
 * the ledger row is written for the product (variant_id NULL), which is what
 * the stock guard matches.
 */
create or replace function private.move_stock(
  p_product_id  text,
  p_variant_id  uuid,
  p_delta       integer,
  p_reason      text,
  p_note        text,
  p_order_id    uuid,
  p_grn_id      uuid,
  p_pos_sale_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_variant public.product_variants;
  v_holder  uuid := null;
  v_before  integer;
  v_after   integer;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'unknown_product: %', coalesce(p_product_id, '(missing)') using errcode = 'P0001';
  end if;

  if p_variant_id is not null then
    select * into v_variant from public.product_variants
     where id = p_variant_id and product_id = p_product_id
     for update;
    if not found then
      raise exception 'variant_product_mismatch: that variant does not belong to %', p_product_id using errcode = 'P0001';
    end if;
    if v_variant.stock is not null then
      v_holder := v_variant.id;
    end if;
  end if;

  v_before := case when v_holder is null then v_product.stock else v_variant.stock end;
  if p_delta = 0 then
    return v_before;
  end if;

  v_after := v_before + p_delta;
  if v_after < 0 then
    raise exception 'insufficient_stock: % (requested %, available %)', p_product_id, -p_delta, v_before
      using errcode = 'P0001';
  end if;
  if v_after > 100000 then
    raise exception 'invalid_quantity: stock cannot exceed 100000' using errcode = '22023';
  end if;

  insert into public.inventory_movements
    (product_id, variant_id, delta, reason, order_id, actor_id, note,
     quantity_before, quantity_after, grn_id, pos_sale_id)
  values
    (p_product_id, v_holder, p_delta, p_reason, p_order_id, (select auth.uid()), p_note,
     v_before, v_after, p_grn_id, p_pos_sale_id);

  if v_holder is null then
    update public.products set stock = v_after where id = p_product_id;
  else
    update public.product_variants set stock = v_after where id = v_holder;
  end if;

  return v_after;
end;
$$;

/*
 * Takes stock for one order line: the number always, and for a barcode-tracked
 * product the OLDEST shelf units of that exact variant (FIFO).
 * move_stock() locks the product first, so two orders (or an order and a
 * counter sale) for the same item queue here instead of picking the same unit.
 */
create or replace function private.reserve_order_line(
  p_order_id     uuid,
  p_order_number text,
  p_item_id      uuid,
  p_product_id   text,
  p_variant_id   uuid,
  p_quantity     integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taken integer;
begin
  perform private.move_stock(p_product_id, p_variant_id, -p_quantity, 'sale',
                             'Online order ' || p_order_number, p_order_id, null, null);

  if private.is_unit_tracked(p_product_id) then
    with picked as (
      select u.id
        from public.inventory_units u
       where u.product_id = p_product_id
         and u.variant_id is not distinct from p_variant_id
         and u.status = 'in_stock'
       order by u.received_on, u.fifo_seq
       limit p_quantity
       for update
    )
    update public.inventory_units u
       set status = 'reserved', order_id = p_order_id, order_item_id = p_item_id,
           status_changed_at = now(), status_note = null
      from picked
     where u.id = picked.id;
    get diagnostics v_taken = row_count;

    if v_taken < p_quantity then
      raise exception 'insufficient_stock: % (requested %, available %)', p_product_id, p_quantity, v_taken
        using errcode = 'P0001';
    end if;
  end if;
end;
$$;

revoke all on function private.imei_ok(text) from public, anon, authenticated, service_role;
revoke all on function private.normalize_serial(text) from public, anon, authenticated, service_role;
revoke all on function private.is_unit_tracked(text) from public, anon, authenticated, service_role;
revoke all on function private.move_stock(text, uuid, integer, text, text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.reserve_order_line(uuid, text, uuid, text, uuid, integer)
  from public, anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 6. admin_post_grn() - receive goods, create one barcoded unit per item
-- ----------------------------------------------------------------------------
-- p_lines: [{ "product_id": text, "variant_id": uuid|null, "quantity": int,
--             "unit_cost_cents": int, "serials": [text, ...] }, ...]
--
-- serials: required (one per unit) when the product's category requires it;
-- otherwise optional - leave it out, or give one entry per unit (blank entries
-- allowed). The same request id posted again returns the first result.
create or replace function public.admin_post_grn(
  p_supplier_name    text,
  p_supplier_invoice text,
  p_received_on      date,
  p_note             text,
  p_lines            jsonb,
  p_request_id       uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_supplier   text := btrim(coalesce(p_supplier_name, ''));
  v_invoice    text := nullif(btrim(coalesce(p_supplier_invoice, '')), '');
  v_note       text := nullif(btrim(coalesce(p_note, '')), '');
  v_today      date := (now() at time zone 'Asia/Colombo')::date;
  v_grn        public.grns;
  v_line       jsonb;
  v_line_no    integer := 0;
  v_product    public.products;
  v_variant    public.product_variants;
  v_needs_sn   boolean;
  v_qty        integer;
  v_cost       bigint;
  v_serials    jsonb;
  v_serial     text;
  v_seen       text[] := '{}';
  v_line_id    uuid;
  v_total      integer := 0;
  v_cost_total bigint := 0;
  v_holder     record;
  v_stock      integer;
  v_counted    integer;
  v_dup        text;
  i            integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated: sign in to receive stock' using errcode = '42501';
  end if;
  if not private.has_role('admin') then
    raise exception 'insufficient_privilege: admin or owner role required' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'invalid_request: a request id is required' using errcode = '22023';
  end if;

  -- Replay: the same request posted twice (a lost response) is applied once.
  select * into v_grn from public.grns where request_id = p_request_id;
  if found then
    return jsonb_build_object('id', v_grn.id, 'grn_number', v_grn.grn_number,
                              'total_units', v_grn.total_units, 'replayed', true);
  end if;

  if length(v_supplier) < 2 or length(v_supplier) > 120 then
    raise exception 'invalid_supplier: a supplier name of 2 to 120 characters is required' using errcode = '22023';
  end if;
  if v_invoice is not null and length(v_invoice) > 60 then
    raise exception 'invalid_invoice: the supplier invoice number is limited to 60 characters' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'invalid_note: the note is limited to 500 characters' using errcode = '22023';
  end if;
  if p_received_on is null or p_received_on > v_today or p_received_on < v_today - 366 then
    raise exception 'invalid_date: the received date must be within the last year and not in the future' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 100 then
    raise exception 'invalid_lines: between 1 and 100 GRN lines are required' using errcode = '22023';
  end if;

  insert into public.grns (grn_number, supplier_name, supplier_invoice, received_on, note,
                           total_units, total_cost_cents, created_by, request_id)
  values ('GRN-' || to_char(now() at time zone 'Asia/Colombo', 'YYMMDD') || '-'
            || lpad(nextval('private.grn_number_seq')::text, 4, '0'),
          v_supplier, v_invoice, p_received_on, v_note, 1, 0, v_uid, p_request_id)
  returning * into v_grn;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_no := v_line_no + 1;

    if jsonb_typeof(v_line) <> 'object' then
      raise exception 'invalid_lines: line % must be an object', v_line_no using errcode = '22023';
    end if;

    if coalesce(jsonb_typeof(v_line -> 'quantity'), '') <> 'number'
       or coalesce(v_line ->> 'quantity', '') !~ '^[0-9]{1,3}$'
       or (v_line ->> 'quantity')::integer not between 1 and 500 then
      raise exception 'invalid_quantity: line % quantity must be a whole number from 1 to 500', v_line_no
        using errcode = '22023';
    end if;
    v_qty := (v_line ->> 'quantity')::integer;

    if v_line ? 'unit_cost_cents' and jsonb_typeof(v_line -> 'unit_cost_cents') <> 'null' then
      if jsonb_typeof(v_line -> 'unit_cost_cents') <> 'number'
         or (v_line ->> 'unit_cost_cents') !~ '^[0-9]{1,12}$' then
        raise exception 'invalid_cost: line % unit cost must be a whole number of cents', v_line_no using errcode = '22023';
      end if;
      v_cost := (v_line ->> 'unit_cost_cents')::bigint;
    else
      v_cost := 0;
    end if;

    select * into v_product from public.products where id = v_line ->> 'product_id';
    if not found then
      raise exception 'unknown_product: %', coalesce(v_line ->> 'product_id', '(missing)') using errcode = 'P0001';
    end if;

    v_variant := null;
    if nullif(v_line ->> 'variant_id', '') is not null then
      begin
        select * into v_variant from public.product_variants
         where id = (v_line ->> 'variant_id')::uuid and product_id = v_product.id;
      exception when invalid_text_representation then
        raise exception 'invalid_variant: line % has a malformed variant id', v_line_no using errcode = '22023';
      end;
      if v_variant.id is null then
        raise exception 'variant_product_mismatch: that variant does not belong to %', v_product.id using errcode = 'P0001';
      end if;
    elsif exists (select 1 from public.product_variants where product_id = v_product.id) then
      raise exception 'variant_required: choose the variant (colour / storage) for %', v_product.name using errcode = 'P0001';
    end if;

    select c.requires_serial into v_needs_sn from public.categories c where c.id = v_product.category_id;
    v_needs_sn := coalesce(v_needs_sn, false);

    v_serials := v_line -> 'serials';
    if v_serials is null or jsonb_typeof(v_serials) = 'null' then
      v_serials := '[]'::jsonb;
    end if;
    if jsonb_typeof(v_serials) <> 'array' then
      raise exception 'invalid_serials: line % serials must be a list', v_line_no using errcode = '22023';
    end if;
    if jsonb_array_length(v_serials) not in (0, v_qty) then
      raise exception 'invalid_serials: line % has % serial numbers for % units', v_line_no, jsonb_array_length(v_serials), v_qty
        using errcode = '22023';
    end if;
    if v_needs_sn and jsonb_array_length(v_serials) <> v_qty then
      raise exception 'serial_required: % needs an IMEI / serial number for each of the % units', v_product.name, v_qty
        using errcode = '22023';
    end if;

    insert into public.grn_lines (grn_id, line_no, product_id, variant_id, product_name_snapshot,
                                  variant_label_snapshot, quantity, unit_cost_cents)
    values (v_grn.id, v_line_no, v_product.id, v_variant.id, v_product.name, v_variant.name, v_qty, v_cost)
    returning id into v_line_id;

    for i in 1..v_qty loop
      v_serial := null;
      if jsonb_array_length(v_serials) > 0 then
        if jsonb_typeof(v_serials -> (i - 1)) not in ('string', 'null') then
          raise exception 'invalid_serials: line % serial % must be text', v_line_no, i using errcode = '22023';
        end if;
        v_serial := private.normalize_serial(v_serials ->> (i - 1));
      end if;

      if v_serial is null and v_needs_sn then
        raise exception 'serial_required: % unit % has no IMEI / serial number', v_product.name, i using errcode = '22023';
      end if;

      if v_serial is not null then
        if v_serial !~ '^[A-Z0-9][A-Z0-9-]{3,29}$' then
          raise exception 'invalid_serial: "%" is not a valid IMEI / serial (4 to 30 letters or digits)', v_serial
            using errcode = '22023';
        end if;
        if v_needs_sn and v_serial ~ '^[0-9]{15}$' and not private.imei_ok(v_serial) then
          raise exception 'invalid_imei: % fails the IMEI check digit - please re-type it', v_serial using errcode = '22023';
        end if;
        if v_serial = any (v_seen) then
          raise exception 'duplicate_serial: % is entered twice in this GRN', v_serial using errcode = '23505';
        end if;
        select u.barcode into v_dup from public.inventory_units u where u.serial_number = v_serial;
        if found then
          raise exception 'duplicate_serial: % is already recorded on unit %', v_serial, v_dup using errcode = '23505';
        end if;
        v_seen := v_seen || v_serial;
      end if;

      insert into public.inventory_units (barcode, serial_number, product_id, variant_id, grn_id, grn_line_id,
                                          unit_cost_cents, received_on)
      values ('AE' || lpad(nextval('private.inventory_unit_barcode_seq')::text, 8, '0'),
              v_serial, v_product.id, v_variant.id, v_grn.id, v_line_id, v_cost, p_received_on);
    end loop;

    v_total := v_total + v_qty;
    v_cost_total := v_cost_total + v_cost * v_qty;
  end loop;

  if v_total > 2000 then
    raise exception 'invalid_lines: a GRN is limited to 2000 units' using errcode = '22023';
  end if;

  -- Stock: one ledger movement per stock holder. Before the movement, the
  -- holder's number must equal its shelf units from earlier GRNs - otherwise
  -- it still carries untracked stock that has no barcode.
  for v_holder in
    select l.product_id,
           case when v.stock is not null then v.id end as holder_variant,
           min(l.variant_id::text)::uuid as any_variant,
           sum(l.quantity)::integer as qty
      from public.grn_lines l
      left join public.product_variants v on v.id = l.variant_id
     where l.grn_id = v_grn.id
     group by l.product_id, case when v.stock is not null then v.id end
     order by l.product_id
  loop
    if v_holder.holder_variant is null then
      select p.stock into v_stock from public.products p where p.id = v_holder.product_id for update;
      select count(*) into v_counted from public.inventory_units u
       where u.product_id = v_holder.product_id and u.status = 'in_stock' and u.grn_id <> v_grn.id
         and (u.variant_id is null
              or exists (select 1 from public.product_variants pv where pv.id = u.variant_id and pv.stock is null));
    else
      perform 1 from public.products p where p.id = v_holder.product_id for update;
      select pv.stock into v_stock from public.product_variants pv where pv.id = v_holder.holder_variant for update;
      select count(*) into v_counted from public.inventory_units u
       where u.variant_id = v_holder.holder_variant and u.status = 'in_stock' and u.grn_id <> v_grn.id;
    end if;

    if v_stock <> v_counted then
      raise exception 'untracked_stock: % has % in stock without barcodes (% tracked). Set it to the tracked count with Adjust stock first, then receive the items through a GRN.',
        v_holder.product_id, v_stock - v_counted, v_counted
        using errcode = 'P0001';
    end if;

    perform private.move_stock(v_holder.product_id, coalesce(v_holder.holder_variant, v_holder.any_variant),
                               v_holder.qty, 'restock', 'GRN ' || v_grn.grn_number || ' from ' || v_supplier,
                               null, v_grn.id, null);
  end loop;

  update public.grns set total_units = v_total, total_cost_cents = v_cost_total where id = v_grn.id;

  return jsonb_build_object('id', v_grn.id, 'grn_number', v_grn.grn_number,
                            'total_units', v_total, 'replayed', false);
end;
$$;

comment on function public.admin_post_grn(text, text, date, text, jsonb, uuid) is
  'Admin/owner. Records a goods received note and creates one barcoded inventory unit per item received; stock rises through the ledger.';

revoke all on function public.admin_post_grn(text, text, date, text, jsonb, uuid) from public, anon, service_role;
grant execute on function public.admin_post_grn(text, text, date, text, jsonb, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. pos_lookup_unit() - what the cashier sees after a scan
-- ----------------------------------------------------------------------------
-- Accepts the unit barcode (AE...) or its IMEI / serial (the box barcode).
create or replace function public.pos_lookup_unit(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code  text := private.normalize_serial(p_code);
  v_unit  public.inventory_units;
  v_name  text;
  v_vname text;
  v_price record;
begin
  if (select auth.uid()) is null or not private.has_role('staff') then
    raise exception 'insufficient_privilege: staff role required' using errcode = '42501';
  end if;
  if v_code is null or length(v_code) > 40 then
    raise exception 'unit_not_found: nothing was scanned' using errcode = 'P0001';
  end if;

  select * into v_unit from public.inventory_units where barcode = v_code;
  if not found then
    select * into v_unit from public.inventory_units where serial_number = v_code;
  end if;
  if v_unit.id is null then
    raise exception 'unit_not_found: no item with barcode or IMEI %', v_code using errcode = 'P0001';
  end if;

  select p.name into v_name from public.products p where p.id = v_unit.product_id;
  select v.name into v_vname from public.product_variants v where v.id = v_unit.variant_id;

  select * into v_price from private.live_price(v_unit.product_id, v_unit.variant_id, 'retail');
  if v_price is null then
    select * into v_price from private.live_price(v_unit.product_id, null, 'retail');
  end if;

  return jsonb_build_object(
    'unit_id', v_unit.id, 'barcode', v_unit.barcode, 'serial_number', v_unit.serial_number,
    'status', v_unit.status, 'product_id', v_unit.product_id, 'variant_id', v_unit.variant_id,
    'product_name', v_name, 'variant_name', v_vname,
    'price_cents', v_price.price_cents);
end;
$$;

revoke all on function public.pos_lookup_unit(text) from public, anon, service_role;
grant execute on function public.pos_lookup_unit(text) to authenticated;


-- ----------------------------------------------------------------------------
-- 8. pos_create_sale() - the counter bill
-- ----------------------------------------------------------------------------
create or replace function public.pos_create_sale(
  p_codes          text[],
  p_payment_method text,
  p_discount_cents bigint,
  p_customer_name  text,
  p_customer_phone text,
  p_note           text,
  p_request_id     uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_name      text := nullif(btrim(coalesce(p_customer_name, '')), '');
  v_phone     text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_note      text := nullif(btrim(coalesce(p_note, '')), '');
  v_discount  bigint := coalesce(p_discount_cents, 0);
  v_sale      public.pos_sales;
  v_code      text;
  v_codes     text[] := '{}';
  v_unit      public.inventory_units;
  v_unit_ids  uuid[] := '{}';
  v_product   public.products;
  v_variant   public.product_variants;
  v_price     record;
  v_subtotal  bigint := 0;
  v_holder    record;
begin
  if v_uid is null then
    raise exception 'not_authenticated: sign in to make a sale' using errcode = '42501';
  end if;
  if not private.has_role('staff') then
    raise exception 'insufficient_privilege: staff role required' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'invalid_request: a request id is required' using errcode = '22023';
  end if;

  select * into v_sale from public.pos_sales where request_id = p_request_id;
  if found then
    return jsonb_build_object('id', v_sale.id, 'bill_number', v_sale.bill_number,
                              'total_cents', v_sale.total_cents, 'replayed', true);
  end if;

  if p_codes is null or cardinality(p_codes) = 0 or cardinality(p_codes) > 100 then
    raise exception 'invalid_items: scan between 1 and 100 items' using errcode = '22023';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'card', 'bank_transfer', 'other') then
    raise exception 'invalid_payment: %', coalesce(p_payment_method, '(missing)') using errcode = '22023';
  end if;
  if v_name is not null and length(v_name) > 120 then
    raise exception 'invalid_customer: the name is limited to 120 characters' using errcode = '22023';
  end if;
  if v_phone is not null and length(v_phone) > 30 then
    raise exception 'invalid_customer: the phone number is limited to 30 characters' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'invalid_note: the note is limited to 500 characters' using errcode = '22023';
  end if;
  if v_discount < 0 then
    raise exception 'invalid_discount: the discount cannot be negative' using errcode = '22023';
  end if;

  insert into public.pos_sales (bill_number, customer_name, customer_phone, payment_method,
                                subtotal_cents, discount_cents, total_cents, note, cashier_id, request_id)
  values ('POS-' || to_char(now() at time zone 'Asia/Colombo', 'YYMMDD') || '-'
            || lpad(nextval('private.pos_bill_number_seq')::text, 5, '0'),
          v_name, v_phone, p_payment_method, 0, 0, 0, v_note, v_uid, p_request_id)
  returning * into v_sale;

  -- Resolve every scan to a unit first (barcode, else IMEI / serial).
  foreach v_code in array p_codes loop
    v_code := private.normalize_serial(v_code);
    if v_code is null then
      raise exception 'invalid_items: an empty scan was sent' using errcode = '22023';
    end if;
    select * into v_unit from public.inventory_units where barcode = v_code;
    if not found then
      select * into v_unit from public.inventory_units where serial_number = v_code;
    end if;
    if v_unit.id is null then
      raise exception 'unit_not_found: no item with barcode or IMEI %', v_code using errcode = 'P0001';
    end if;
    if v_unit.status <> 'in_stock' then
      raise exception 'unit_not_available: % is %', v_unit.barcode,
        case v_unit.status when 'reserved' then 'reserved for an online order'
                           when 'sold' then 'already sold'
                           else 'written off' end
        using errcode = 'P0001';
    end if;
    if v_unit.id = any (v_unit_ids) then
      raise exception 'duplicate_item: % was scanned twice', v_unit.barcode using errcode = '22023';
    end if;
    v_unit_ids := v_unit_ids || v_unit.id;
    v_unit := null;
  end loop;

  -- Stock first (locks each product, in a fixed order), so a concurrent online
  -- order for the same item waits rather than reserving a unit being sold here.
  for v_holder in
    select u.product_id, u.variant_id, count(*)::integer as qty
      from public.inventory_units u
     where u.id = any (v_unit_ids)
     group by u.product_id, u.variant_id
     order by u.product_id, u.variant_id
  loop
    perform private.move_stock(v_holder.product_id, v_holder.variant_id, -v_holder.qty, 'sale',
                               'Counter bill ' || v_sale.bill_number, null, null, v_sale.id);
  end loop;

  -- Then each unit, re-read under lock: it must still be on the shelf.
  for v_unit in
    select * from public.inventory_units where id = any (v_unit_ids) order by barcode for update
  loop
    if v_unit.status <> 'in_stock' then
      raise exception 'unit_not_available: % is %', v_unit.barcode,
        case v_unit.status when 'reserved' then 'reserved for an online order'
                           when 'sold' then 'already sold'
                           else 'written off' end
        using errcode = 'P0001';
    end if;

    select * into v_product from public.products where id = v_unit.product_id;
    v_variant := null;
    if v_unit.variant_id is not null then
      select * into v_variant from public.product_variants where id = v_unit.variant_id;
    end if;

    select * into v_price from private.live_price(v_unit.product_id, v_unit.variant_id, 'retail');
    if v_price is null then
      select * into v_price from private.live_price(v_unit.product_id, null, 'retail');
    end if;
    if v_price is null then
      raise exception 'price_unavailable: % has no retail price yet', v_product.name using errcode = 'P0001';
    end if;

    update public.inventory_units
       set status = 'sold', pos_sale_id = v_sale.id, status_changed_at = now(), status_note = null
     where id = v_unit.id;

    insert into public.pos_sale_items (pos_sale_id, unit_id, product_id, variant_id, product_name_snapshot,
                                       variant_label_snapshot, barcode_snapshot, serial_snapshot,
                                       unit_price_cents, price_id)
    values (v_sale.id, v_unit.id, v_unit.product_id, v_unit.variant_id, v_product.name,
            v_variant.name, v_unit.barcode, v_unit.serial_number, v_price.price_cents, v_price.price_id);

    v_subtotal := v_subtotal + v_price.price_cents;
  end loop;

  if v_discount > v_subtotal then
    raise exception 'invalid_discount: the discount is larger than the bill' using errcode = '22023';
  end if;

  update public.pos_sales
     set subtotal_cents = v_subtotal, discount_cents = v_discount, total_cents = v_subtotal - v_discount
   where id = v_sale.id;

  return jsonb_build_object('id', v_sale.id, 'bill_number', v_sale.bill_number,
                            'total_cents', v_subtotal - v_discount, 'replayed', false);
end;
$$;

comment on function public.pos_create_sale(text[], text, bigint, text, text, text, uuid) is
  'Staff. In-store bill from scanned unit barcodes or IMEIs. Prices are the live retail prices; each unit is marked sold and stock falls through the ledger.';

revoke all on function public.pos_create_sale(text[], text, bigint, text, text, text, uuid) from public, anon, service_role;
grant execute on function public.pos_create_sale(text[], text, bigint, text, text, text, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 9. admin_write_off_units() and admin_return_pos_unit()
-- ----------------------------------------------------------------------------
create or replace function public.admin_write_off_units(
  p_unit_ids uuid[],
  p_reason   text,
  p_note     text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note   text := btrim(coalesce(p_note, ''));
  v_unit   public.inventory_units;
  v_holder record;
  v_count  integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated: sign in to write off stock' using errcode = '42501';
  end if;
  if not private.has_role('admin') then
    raise exception 'insufficient_privilege: admin or owner role required' using errcode = '42501';
  end if;
  if p_unit_ids is null or cardinality(p_unit_ids) = 0 or cardinality(p_unit_ids) > 500 then
    raise exception 'invalid_items: choose between 1 and 500 units' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in ('damage', 'correction') then
    raise exception 'invalid_reason: %', coalesce(p_reason, '(missing)') using errcode = '22023';
  end if;
  if length(v_note) < 3 or length(v_note) > 500 then
    raise exception 'invalid_note: a note of 3 to 500 characters is required' using errcode = '22023';
  end if;

  for v_holder in
    select u.product_id, u.variant_id, count(*)::integer as qty
      from public.inventory_units u
     where u.id = any (p_unit_ids)
     group by u.product_id, u.variant_id
     order by u.product_id, u.variant_id
  loop
    perform private.move_stock(v_holder.product_id, v_holder.variant_id, -v_holder.qty, p_reason,
                               'Write-off: ' || v_note, null, null, null);
  end loop;

  for v_unit in
    select * from public.inventory_units where id = any (p_unit_ids) order by barcode for update
  loop
    if v_unit.status <> 'in_stock' then
      raise exception 'unit_not_available: % is % and cannot be written off', v_unit.barcode, v_unit.status
        using errcode = 'P0001';
    end if;
    update public.inventory_units
       set status = 'written_off', status_changed_at = now(), status_note = v_note
     where id = v_unit.id;
    v_count := v_count + 1;
  end loop;

  if v_count <> cardinality(p_unit_ids) then
    raise exception 'unit_not_found: % of the chosen units do not exist', cardinality(p_unit_ids) - v_count
      using errcode = 'P0001';
  end if;

  return jsonb_build_object('written_off', v_count);
end;
$$;

revoke all on function public.admin_write_off_units(uuid[], text, text) from public, anon, service_role;
grant execute on function public.admin_write_off_units(uuid[], text, text) to authenticated;

-- A counter sale brought back: the unit returns to the shelf. The bill keeps
-- its line, marked returned. (Online orders are returned by cancelling or
-- refunding the order.)
create or replace function public.admin_return_pos_unit(
  p_unit_id uuid,
  p_note    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := btrim(coalesce(p_note, ''));
  v_unit public.inventory_units;
  v_bill text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated: sign in to record a return' using errcode = '42501';
  end if;
  if not private.has_role('admin') then
    raise exception 'insufficient_privilege: admin or owner role required' using errcode = '42501';
  end if;
  if length(v_note) < 3 or length(v_note) > 500 then
    raise exception 'invalid_note: a note of 3 to 500 characters is required' using errcode = '22023';
  end if;

  select * into v_unit from public.inventory_units where id = p_unit_id;
  if not found then
    raise exception 'unit_not_found: %', coalesce(p_unit_id::text, '(missing)') using errcode = 'P0001';
  end if;

  select s.bill_number into v_bill from public.pos_sales s where s.id = v_unit.pos_sale_id;

  perform private.move_stock(v_unit.product_id, v_unit.variant_id, 1, 'return',
                             'Returned from counter bill ' || coalesce(v_bill, '?') || ': ' || v_note,
                             null, null, v_unit.pos_sale_id);

  select * into v_unit from public.inventory_units where id = p_unit_id for update;
  if v_unit.status <> 'sold' or v_unit.pos_sale_id is null then
    raise exception 'unit_not_returnable: % was not sold at the counter', v_unit.barcode using errcode = 'P0001';
  end if;

  update public.pos_sale_items
     set returned_at = now(), return_note = v_note
   where pos_sale_id = v_unit.pos_sale_id and unit_id = v_unit.id;

  update public.inventory_units
     set status = 'in_stock', pos_sale_id = null, status_changed_at = now(),
         status_note = 'Returned: ' || v_note
   where id = v_unit.id;

  return jsonb_build_object('unit_id', v_unit.id, 'barcode', v_unit.barcode, 'status', 'in_stock');
end;
$$;

revoke all on function public.admin_return_pos_unit(uuid, text) from public, anon, service_role;
grant execute on function public.admin_return_pos_unit(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 10. Order status changes move stock
-- ----------------------------------------------------------------------------
-- Fires on every status change, from the admin panel (staff may change status)
-- or anywhere else. SECURITY DEFINER so the ledger can be written; it changes
-- only units, stock and orders.stock_state, never an amount.
create or replace function private.apply_order_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_active boolean := old.status not in ('cancelled', 'refunded');
  v_is_active  boolean := new.status not in ('cancelled', 'refunded');
  v_item       public.order_items;
  v_units      integer;
  v_skipped    integer := 0;
begin
  -- Cancelled / refunded: give the stock back.
  if v_was_active and not v_is_active and new.stock_state = 'reserved' then
    for v_item in
      select * from public.order_items where order_id = new.id order by product_id, variant_id, id
    loop
      if v_item.product_id is null then
        continue;  -- product deleted since; nothing to return it to
      end if;
      -- Product first, then units: the same lock order as every other path.
      perform 1 from public.products p where p.id = v_item.product_id for update;

      update public.inventory_units
         set status = 'in_stock', order_id = null, order_item_id = null, status_changed_at = now(),
             status_note = 'Returned to stock: order ' || new.order_number || ' ' || new.status
       where order_item_id = v_item.id and status in ('reserved', 'sold');
      get diagnostics v_units = row_count;

      if v_units > 0 then
        perform private.move_stock(v_item.product_id, v_item.variant_id, v_units, 'return',
                                   'Order ' || new.order_number || ' ' || new.status, new.id, null, null);
      elsif not private.is_unit_tracked(v_item.product_id) then
        perform private.move_stock(v_item.product_id, v_item.variant_id, v_item.quantity, 'return',
                                   'Order ' || new.order_number || ' ' || new.status, new.id, null, null);
      else
        -- Taken as a plain number before the item was barcode-tracked: there
        -- is no unit to put back, so the number is left alone.
        v_skipped := v_skipped + v_item.quantity;
      end if;
    end loop;

    update public.orders set stock_state = 'released' where id = new.id;

    if v_skipped > 0 then
      insert into public.order_events (order_id, from_status, to_status, actor_id, note)
      values (new.id, new.status, new.status, (select auth.uid()),
              v_skipped || ' item(s) were not returned to stock: they were sold before barcode tracking began. Receive them with a GRN if they are back on the shelf.');
    end if;

  -- Re-activated after a cancellation: take stock again (or refuse).
  elsif not v_was_active and v_is_active and new.stock_state = 'released' then
    for v_item in
      select * from public.order_items where order_id = new.id order by product_id, variant_id, id
    loop
      if v_item.product_id is null then
        raise exception 'product_unavailable: a product on order % no longer exists', new.order_number
          using errcode = 'P0001';
      end if;
      perform private.reserve_order_line(new.id, new.order_number, v_item.id,
                                         v_item.product_id, v_item.variant_id, v_item.quantity);
    end loop;
    update public.orders set stock_state = 'reserved' where id = new.id;
  end if;

  -- Shipped or delivered: the reserved units have left the shop.
  if new.status in ('shipped', 'delivered') then
    update public.inventory_units
       set status = 'sold', status_changed_at = now()
     where order_id = new.id and status = 'reserved';
  end if;

  return null;
end;
$$;

revoke all on function private.apply_order_stock() from public, anon, authenticated, service_role;

create trigger orders_apply_stock
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function private.apply_order_stock();


-- ----------------------------------------------------------------------------
-- 11. Stock summary for the admin inventory screen
-- ----------------------------------------------------------------------------
create or replace function public.admin_unit_stock_summary()
returns table (
  product_id   text,
  variant_id   uuid,
  in_stock     bigint,
  reserved     bigint,
  sold         bigint,
  written_off  bigint,
  oldest_received_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.product_id, u.variant_id,
         count(*) filter (where u.status = 'in_stock'),
         count(*) filter (where u.status = 'reserved'),
         count(*) filter (where u.status = 'sold'),
         count(*) filter (where u.status = 'written_off'),
         min(u.received_on) filter (where u.status = 'in_stock')
    from public.inventory_units u
   group by u.product_id, u.variant_id
$$;

comment on function public.admin_unit_stock_summary() is
  'Unit counts per product/variant. SECURITY INVOKER: RLS limits it to staff, everyone else gets no rows.';

revoke all on function public.admin_unit_stock_summary() from public, anon, service_role;
grant execute on function public.admin_unit_stock_summary() to authenticated;


-- ----------------------------------------------------------------------------
-- 12. place_order() - now takes stock at placement (FIFO units when tracked)
-- ----------------------------------------------------------------------------
-- Copied from 20261003120000 unchanged except: each order line takes its stock
-- through private.reserve_order_line(), and the order is marked
-- stock_state = 'reserved'. Pricing, warranty, condition and anti-tampering are
-- exactly as before. Signature and grants are unchanged.
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
  v_item_id    uuid;
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
    )
    returning id into v_item_id;

    -- Take the stock now: the number, and for a barcode-tracked item the
    -- oldest units of this exact variant (FIFO). Refused if they ran out.
    perform private.reserve_order_line(v_order_id, v_number, v_item_id, v_product.id, v_variant.id, v_qty);

    v_subtotal := v_subtotal + (v_base + v_warranty) * v_qty;
  end loop;

  update public.orders
     set subtotal_cents = v_subtotal, total_cents = v_subtotal, stock_state = 'reserved'
   where id = v_order_id;

  insert into public.order_events (order_id, from_status, to_status, actor_id, note)
  values (v_order_id, null, 'pending', v_uid, 'Order placed by customer');

  return jsonb_build_object('id', v_order_id, 'order_number', v_number, 'total_cents', v_subtotal);
end;
$$;

comment on function public.place_order(jsonb, text) is
  'Customer order placement. Prices, warranty add-on, condition and warranty plan are resolved server-side for the selected variant; stock is taken at placement (oldest barcode units first when the item is tracked). The client never supplies an amount.';


-- ----------------------------------------------------------------------------
-- 13. admin_set_stock() - refused for barcode-tracked items
-- ----------------------------------------------------------------------------
-- Copied from 20261023120000 unchanged except for the unit_tracked check in
-- step 5. Signature and grants are unchanged.
create or replace function public.admin_set_stock(
  p_product_id        text,
  p_variant_id        uuid,
  p_expected_quantity integer,
  p_new_quantity      integer,
  p_reason            text,
  p_note              text,
  p_request_id        uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_note       text := btrim(coalesce(p_note, ''));
  v_product    public.products;
  v_variant    public.product_variants;
  v_prev       public.inventory_movements;
  v_move       public.inventory_movements;
  v_before     integer;
  v_current    integer;
  v_delta      integer;
  v_constraint text;
begin
  -- 1. Authorisation, before anything is read.
  if v_uid is null then
    raise exception 'not_authenticated: sign in to adjust stock' using errcode = '42501';
  end if;
  if not private.has_role('admin') then
    raise exception 'insufficient_privilege: admin or owner role required' using errcode = '42501';
  end if;

  -- 2. Input that needs no database read.
  if p_request_id is null then
    raise exception 'invalid_request: a request id is required' using errcode = '22023';
  end if;
  if p_new_quantity is null or p_new_quantity < 0 or p_new_quantity > 100000 then
    raise exception 'invalid_quantity: stock must be a whole number from 0 to 100000' using errcode = '22023';
  end if;
  if p_expected_quantity is null or p_expected_quantity < 0 or p_expected_quantity > 100000 then
    raise exception 'invalid_quantity: the expected stock must be a whole number from 0 to 100000' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in
     ('restock', 'adjustment', 'damage', 'return', 'stock_count', 'correction', 'opening_balance') then
    raise exception 'invalid_reason: %', coalesce(p_reason, '(missing)') using errcode = '22023';
  end if;
  if length(v_note) < 3 or length(v_note) > 500 then
    raise exception 'invalid_note: a note of 3 to 500 characters is required' using errcode = '22023';
  end if;

  -- 3. Lock product first, then variant: one lock order everywhere.
  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'unknown_product: %', coalesce(p_product_id, '(missing)') using errcode = 'P0001';
  end if;

  if p_variant_id is not null then
    select * into v_variant from public.product_variants
     where id = p_variant_id and product_id = p_product_id
     for update;
    if not found then
      raise exception 'variant_product_mismatch: that variant does not belong to %', p_product_id using errcode = 'P0001';
    end if;
  end if;

  v_current := case when p_variant_id is null then v_product.stock else v_variant.stock end;

  -- 4. Replay. Read after the locks, so a concurrent identical request sees
  --    the committed row of the one that went first.
  select * into v_prev from public.inventory_movements where request_id = p_request_id;
  if found then
    if v_prev.actor_id is not distinct from v_uid
       and v_prev.product_id = p_product_id
       and v_prev.variant_id is not distinct from p_variant_id
       and v_prev.quantity_before = p_expected_quantity
       and v_prev.quantity_after = p_new_quantity
       and v_prev.reason = p_reason
       and v_prev.note is not distinct from v_note then
      return jsonb_build_object(
        'movement_id', v_prev.id, 'product_id', v_prev.product_id, 'variant_id', v_prev.variant_id,
        'quantity_before', v_prev.quantity_before, 'quantity_after', v_prev.quantity_after,
        'delta', v_prev.delta, 'reason', v_prev.reason, 'created_at', v_prev.created_at,
        'current_quantity', v_current, 'replayed', true);
    end if;
    raise exception 'request_id_reused: this request id was already used for a different adjustment'
      using errcode = 'P0001';
  end if;

  -- 5. State checks. A barcode-tracked item moves only with its units.
  if exists (select 1 from public.inventory_units u where u.product_id = p_product_id) then
    raise exception 'unit_tracked: % is tracked by barcode; receive stock with a GRN, sell or write off units instead', p_product_id
      using errcode = 'P0001',
            hint = 'Inventory -> GRN to add units; Inventory -> Units to write one off.';
  end if;

  if p_variant_id is not null and v_variant.stock is null then
    raise exception 'variant_inherits_product_stock: this variant shares its product''s stock; adjust the product'
      using errcode = 'P0001';
  end if;

  v_before := v_current;
  if v_before <> p_expected_quantity then
    raise exception 'stale_quantity: stock is now %, not %', v_before, p_expected_quantity using errcode = 'P0001';
  end if;

  v_delta := p_new_quantity - v_before;
  if v_delta = 0 then
    raise exception 'no_change: stock is already %', v_before using errcode = 'P0001';
  end if;

  if p_reason in ('restock', 'return') and v_delta < 0 then
    raise exception 'invalid_reason: % can only increase stock', p_reason using errcode = '22023';
  end if;
  if p_reason = 'damage' and v_delta > 0 then
    raise exception 'invalid_reason: damage can only decrease stock' using errcode = '22023';
  end if;
  if p_reason = 'opening_balance' and (
       v_before <> 0
       or exists (select 1 from public.inventory_movements m
                  where m.product_id = p_product_id and m.variant_id is not distinct from p_variant_id)) then
    raise exception 'invalid_reason: opening_balance is only for an item at zero with no stock history'
      using errcode = '22023';
  end if;

  -- 6. Ledger row first: it is what authorises the stock write in the guard.
  begin
    insert into public.inventory_movements
      (product_id, variant_id, delta, reason, actor_id, note, quantity_before, quantity_after, request_id)
    values
      (p_product_id, p_variant_id, v_delta, p_reason, v_uid, v_note, v_before, p_new_quantity, p_request_id)
    returning * into v_move;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'inventory_movements_request_id_key' then
      -- Taken by a concurrent request for another item.
      raise exception 'request_id_reused: this request id was already used for a different adjustment'
        using errcode = 'P0001';
    end if;
    raise;
  end;

  -- 7. The stock write. The guard verifies the row above.
  if p_variant_id is null then
    update public.products set stock = p_new_quantity where id = p_product_id;
  else
    update public.product_variants set stock = p_new_quantity where id = p_variant_id;
  end if;

  return jsonb_build_object(
    'movement_id', v_move.id, 'product_id', v_move.product_id, 'variant_id', v_move.variant_id,
    'quantity_before', v_move.quantity_before, 'quantity_after', v_move.quantity_after,
    'delta', v_move.delta, 'reason', v_move.reason, 'created_at', v_move.created_at,
    'current_quantity', p_new_quantity, 'replayed', false);
end;
$$;


-- ----------------------------------------------------------------------------
-- 14. Self-verification
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['grns', 'grn_lines', 'inventory_units', 'pos_sales', 'pos_sale_items'] loop
    if has_table_privilege('anon', 'public.' || t, 'SELECT')
       or has_table_privilege('authenticated', 'public.' || t, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE')
       or has_table_privilege('service_role', 'public.' || t, 'INSERT')
       or has_table_privilege('service_role', 'public.' || t, 'UPDATE') then
      raise exception 'verify: a client role can write % (or anon can read it)', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'verify: RLS is off on %', t;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.admin_post_grn(text, text, date, text, jsonb, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.pos_create_sale(text[], text, bigint, text, text, text, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.move_stock(text, uuid, integer, text, text, uuid, uuid, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.reserve_order_line(uuid, text, uuid, text, uuid, integer)', 'EXECUTE') then
    raise exception 'verify: function grants are wrong';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'orders_apply_stock' and not tgisinternal) then
    raise exception 'verify: orders_apply_stock trigger missing';
  end if;

  raise notice 'verified: GRN / unit / POS tables are staff-read-only, writes only through functions';
end
$$;


-- ----------------------------------------------------------------------------
-- Rollback (manual, if ever needed). Restore place_order from 20261003120000
-- and admin_set_stock from 20261023120000 first; units and GRNs are history and
-- should be exported before they are dropped.
--   drop trigger if exists orders_apply_stock on public.orders;
--   drop function if exists private.apply_order_stock();
--   drop function if exists public.admin_unit_stock_summary();
--   drop function if exists public.admin_return_pos_unit(uuid, text);
--   drop function if exists public.admin_write_off_units(uuid[], text, text);
--   drop function if exists public.pos_create_sale(text[], text, bigint, text, text, text, uuid);
--   drop function if exists public.pos_lookup_unit(text);
--   drop function if exists public.admin_post_grn(text, text, date, text, jsonb, uuid);
--   drop function if exists private.reserve_order_line(uuid, text, uuid, text, uuid, integer);
--   drop function if exists private.move_stock(text, uuid, integer, text, text, uuid, uuid, uuid);
--   drop function if exists private.is_unit_tracked(text);
--   drop function if exists private.normalize_serial(text);
--   drop function if exists private.imei_ok(text);
--   alter table public.inventory_movements drop column if exists grn_id, drop column if exists pos_sale_id;
--   alter table public.orders drop column if exists stock_state;
--   drop table if exists public.pos_sale_items, public.inventory_units, public.pos_sales,
--                        public.grn_lines, public.grns;
--   drop sequence if exists private.inventory_unit_barcode_seq, private.grn_number_seq,
--                           private.pos_bill_number_seq;
--   alter table public.categories drop column if exists requires_serial;
-- ----------------------------------------------------------------------------
