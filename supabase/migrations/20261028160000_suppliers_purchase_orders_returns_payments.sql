-- ============================================================================
-- Apple Expert · Purchase & Returns: suppliers, purchase orders, supplier
-- returns and supplier payments
-- ----------------------------------------------------------------------------
-- Builds on 20261028120000 (GRN, barcoded units, POS).
--
--   suppliers               who the shop buys from
--   purchase_orders (+lines) what was ordered from a supplier
--   grns                    gain supplier_id / purchase_order_id: receiving
--                           goods against a PO counts them off the PO
--   supplier_returns (+items) barcoded units sent back to the supplier;
--                           each unit leaves stock through the ledger
--   supplier_payments       money paid to a supplier
--
-- WHAT THE SHOP OWES A SUPPLIER (admin_supplier_balances)
--   opening balance
--   + cost of every GRN received from them
--   - supplier returns settled as CREDIT (deducted from what is owed)
--   - payments (voided payments excluded)
--   A CASH return is money the supplier handed back; it is listed, but it does
--   not change what is owed.
--
-- DECISIONS (documented, not silent)
--   * Every write goes through a SECURITY DEFINER function; the tables are
--     read-only for browser sessions. Admin and owner write. Staff can read
--     suppliers, purchase orders and returns; payments and balances are
--     admin/owner only (they are the shop's money).
--   * Suppliers are never deleted, only deactivated, so history keeps its name.
--   * A PO line can never be received beyond what was ordered. Extra goods
--     are received on a separate GRN without a PO.
--   * A PO with nothing received is CANCELLED when closed; one that is partly
--     received is CLOSED (the rest will not come).
--   * A supplier return takes units that are on the shelf (in_stock). A unit
--     that came in on a GRN from a different supplier is refused; units from
--     GRNs recorded before suppliers existed (no supplier_id) are accepted.
--   * Payments are never edited or deleted. A mistake is VOIDED with a note;
--     the row stays for the record.
--   * Every create is safe to retry: the same request id returns the first
--     result.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Pre-flight
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.inventory_units') is null
     or to_regprocedure('public.admin_post_grn(text, text, date, text, jsonb, uuid)') is null then
    raise exception 'pre-flight: GRN tables are missing; apply 20261028120000 first';
  end if;
  if to_regclass('public.suppliers') is not null then
    raise exception 'pre-flight: public.suppliers already exists; this migration has already been applied';
  end if;
end
$$;


-- ----------------------------------------------------------------------------
-- 1. Sequences
-- ----------------------------------------------------------------------------
create sequence private.supplier_code_seq;
create sequence private.purchase_order_number_seq;
create sequence private.supplier_return_number_seq;
create sequence private.supplier_payment_number_seq;

revoke all on sequence private.supplier_code_seq, private.purchase_order_number_seq,
                       private.supplier_return_number_seq, private.supplier_payment_number_seq
  from public;


-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create table public.suppliers (
  id                     uuid primary key default gen_random_uuid(),
  supplier_code          text not null unique,
  name                   text not null check (length(btrim(name)) between 2 and 120),
  contact_person         text check (contact_person is null or length(contact_person) <= 120),
  phone                  text check (phone is null or length(phone) <= 30),
  email                  text check (email is null or length(email) <= 254),
  address                text check (address is null or length(address) <= 500),
  note                   text check (note is null or length(note) <= 500),
  opening_balance_cents  bigint not null default 0 check (opening_balance_cents >= 0),
  is_active              boolean not null default true,
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index suppliers_name_key on public.suppliers (lower(btrim(name)));

comment on table public.suppliers is
  'Who the shop buys from. Written only by admin_save_supplier(); deactivated, never deleted.';

create table public.purchase_orders (
  id             uuid primary key default gen_random_uuid(),
  po_number      text not null unique,
  supplier_id    uuid not null references public.suppliers (id) on delete restrict,
  order_date     date not null,
  expected_date  date,
  status         text not null default 'open'
                 check (status in ('open', 'partially_received', 'received', 'closed', 'cancelled')),
  note           text check (note is null or length(note) <= 500),
  total_cents    bigint not null default 0 check (total_cents >= 0),
  close_note     text check (close_note is null or length(close_note) <= 500),
  closed_at      timestamptz,
  created_by     uuid references public.profiles (id) on delete set null,
  request_id     uuid not null unique,
  created_at     timestamptz not null default now(),
  constraint purchase_orders_dates check (expected_date is null or expected_date >= order_date)
);

create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id, order_date desc);
create index purchase_orders_created_idx on public.purchase_orders (order_date desc, created_at desc);

create table public.purchase_order_lines (
  id                      uuid primary key default gen_random_uuid(),
  purchase_order_id       uuid not null references public.purchase_orders (id) on delete restrict,
  line_no                 smallint not null check (line_no > 0),
  product_id              text not null references public.products (id) on delete restrict,
  variant_id              uuid,
  product_name_snapshot   text not null,
  variant_label_snapshot  text,
  quantity                integer not null check (quantity between 1 and 2000),
  received_quantity       integer not null default 0,
  unit_cost_cents         bigint not null default 0 check (unit_cost_cents >= 0),
  constraint purchase_order_lines_variant_fk
    foreign key (variant_id, product_id)
    references public.product_variants (id, product_id) on delete restrict,
  constraint purchase_order_lines_received_range check (received_quantity between 0 and quantity),
  constraint purchase_order_lines_line_no_uq unique (purchase_order_id, line_no)
);

create index purchase_order_lines_po_idx on public.purchase_order_lines (purchase_order_id);

alter table public.grns
  add column supplier_id       uuid references public.suppliers (id) on delete restrict,
  add column purchase_order_id uuid references public.purchase_orders (id) on delete restrict;

create index grns_supplier_idx on public.grns (supplier_id) where supplier_id is not null;
create index grns_po_idx on public.grns (purchase_order_id) where purchase_order_id is not null;

create table public.supplier_returns (
  id             uuid primary key default gen_random_uuid(),
  return_number  text not null unique,
  supplier_id    uuid not null references public.suppliers (id) on delete restrict,
  return_date    date not null,
  return_type    text not null check (return_type in ('cash', 'credit')),
  total_cents    bigint not null default 0 check (total_cents >= 0),
  total_units    integer not null default 0 check (total_units >= 0),
  note           text check (note is null or length(note) <= 500),
  created_by     uuid references public.profiles (id) on delete set null,
  request_id     uuid not null unique,
  created_at     timestamptz not null default now()
);

create index supplier_returns_supplier_idx on public.supplier_returns (supplier_id, return_date desc);
create index supplier_returns_created_idx on public.supplier_returns (return_date desc, created_at desc);

create table public.supplier_return_items (
  id                      uuid primary key default gen_random_uuid(),
  supplier_return_id      uuid not null references public.supplier_returns (id) on delete restrict,
  unit_id                 uuid not null unique references public.inventory_units (id) on delete restrict,
  product_id              text references public.products (id) on delete set null,
  variant_id              uuid references public.product_variants (id) on delete set null,
  product_name_snapshot   text not null,
  variant_label_snapshot  text,
  barcode_snapshot        text not null,
  serial_snapshot         text,
  grn_id                  uuid references public.grns (id) on delete restrict,
  unit_cost_cents         bigint not null check (unit_cost_cents >= 0)
);

create index supplier_return_items_return_idx on public.supplier_return_items (supplier_return_id);

create table public.supplier_payments (
  id              uuid primary key default gen_random_uuid(),
  payment_number  text not null unique,
  supplier_id     uuid not null references public.suppliers (id) on delete restrict,
  paid_on         date not null,
  amount_cents    bigint not null check (amount_cents > 0),
  method          text not null check (method in ('cash', 'bank_transfer', 'cheque', 'card', 'other')),
  reference       text check (reference is null or length(reference) <= 60),
  note            text check (note is null or length(note) <= 500),
  voided_at       timestamptz,
  voided_by       uuid references public.profiles (id) on delete set null,
  void_note       text check (void_note is null or length(void_note) <= 500),
  created_by      uuid references public.profiles (id) on delete set null,
  request_id      uuid not null unique,
  created_at      timestamptz not null default now(),
  constraint supplier_payments_void_complete check ((voided_at is null) = (void_note is null))
);

create index supplier_payments_supplier_idx on public.supplier_payments (supplier_id, paid_on desc);
create index supplier_payments_created_idx on public.supplier_payments (paid_on desc, created_at desc);

-- Units: a new final status for items sent back to the supplier.
alter table public.inventory_units
  add column supplier_return_id uuid references public.supplier_returns (id) on delete restrict;

do $$
declare
  v_name text;
begin
  select c.conname into v_name
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.conrelid = 'public.inventory_units'::regclass
    and c.contype = 'c'
    and a.attname = 'status'
    and cardinality(c.conkey) = 1;
  if v_name is null then
    raise exception 'pre-flight: no CHECK constraint found on inventory_units.status';
  end if;
  execute format('alter table public.inventory_units drop constraint %I', v_name);
end
$$;

alter table public.inventory_units
  add constraint inventory_units_status_check
  check (status in ('in_stock', 'reserved', 'sold', 'written_off', 'returned_to_supplier'));

-- Ledger: a reason for stock that went back to a supplier.
alter table public.inventory_movements drop constraint inventory_movements_reason_check;
alter table public.inventory_movements
  add constraint inventory_movements_reason_check
  check (reason in ('seed', 'restock', 'sale', 'return', 'adjustment', 'damage', 'transfer',
                    'stock_count', 'correction', 'opening_balance', 'supplier_return'));


-- ----------------------------------------------------------------------------
-- 3. Row level security
-- ----------------------------------------------------------------------------
alter table public.suppliers             enable row level security;
alter table public.purchase_orders       enable row level security;
alter table public.purchase_order_lines  enable row level security;
alter table public.supplier_returns      enable row level security;
alter table public.supplier_return_items enable row level security;
alter table public.supplier_payments     enable row level security;

create policy "suppliers staff read"             on public.suppliers             for select to authenticated using (private.has_role('staff'));
create policy "purchase_orders staff read"       on public.purchase_orders       for select to authenticated using (private.has_role('staff'));
create policy "purchase_order_lines staff read"  on public.purchase_order_lines  for select to authenticated using (private.has_role('staff'));
create policy "supplier_returns staff read"      on public.supplier_returns      for select to authenticated using (private.has_role('staff'));
create policy "supplier_return_items staff read" on public.supplier_return_items for select to authenticated using (private.has_role('staff'));
create policy "supplier_payments admin read"     on public.supplier_payments     for select to authenticated using (private.has_role('admin'));

revoke all on public.suppliers, public.purchase_orders, public.purchase_order_lines,
              public.supplier_returns, public.supplier_return_items, public.supplier_payments
  from anon;
revoke insert, update, delete, truncate
  on public.suppliers, public.purchase_orders, public.purchase_order_lines,
     public.supplier_returns, public.supplier_return_items, public.supplier_payments
  from authenticated, service_role;
grant select on public.suppliers, public.purchase_orders, public.purchase_order_lines,
                public.supplier_returns, public.supplier_return_items, public.supplier_payments
  to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Helpers
-- ----------------------------------------------------------------------------
create or replace function private.require_admin(p_action text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated: sign in to %', p_action using errcode = '42501';
  end if;
  if not private.has_role('admin') then
    raise exception 'insufficient_privilege: admin or owner role required' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- A business date: not in the future (Sri Lanka time), not over a year back.
create or replace function private.check_business_date(p_date date, p_label text)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Colombo')::date;
begin
  if p_date is null or p_date > v_today or p_date < v_today - 366 then
    raise exception 'invalid_date: the % must be within the last year and not in the future', p_label
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.require_admin(text) from public, anon, authenticated, service_role;
revoke all on function private.check_business_date(date, text) from public, anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 5. Suppliers
-- ----------------------------------------------------------------------------
-- p_id NULL creates a supplier; otherwise updates that one.
create or replace function public.admin_save_supplier(
  p_id                    uuid,
  p_name                  text,
  p_contact_person        text,
  p_phone                 text,
  p_email                 text,
  p_address               text,
  p_note                  text,
  p_opening_balance_cents bigint,
  p_is_active             boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_admin('save a supplier');
  v_name     text := btrim(coalesce(p_name, ''));
  v_contact  text := nullif(btrim(coalesce(p_contact_person, '')), '');
  v_phone    text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email    text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_address  text := nullif(btrim(coalesce(p_address, '')), '');
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_opening  bigint := coalesce(p_opening_balance_cents, 0);
  v_row      public.suppliers;
begin
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'invalid_supplier: a supplier name of 2 to 120 characters is required' using errcode = '22023';
  end if;
  if v_contact is not null and length(v_contact) > 120 then
    raise exception 'invalid_supplier: the contact person is limited to 120 characters' using errcode = '22023';
  end if;
  if v_phone is not null and (length(v_phone) > 30 or v_phone !~ '^[0-9+() -]+$') then
    raise exception 'invalid_phone: enter the phone number with digits only (up to 30 characters)' using errcode = '22023';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_email: % is not a valid email address', v_email using errcode = '22023';
  end if;
  if v_address is not null and length(v_address) > 500 then
    raise exception 'invalid_supplier: the address is limited to 500 characters' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'invalid_note: the note is limited to 500 characters' using errcode = '22023';
  end if;
  if v_opening < 0 or v_opening > 100000000000 then
    raise exception 'invalid_amount: the opening balance must be from 0 to Rs. 1,000,000,000' using errcode = '22023';
  end if;

  if exists (select 1 from public.suppliers s
              where lower(btrim(s.name)) = lower(v_name) and s.id is distinct from p_id) then
    raise exception 'duplicate_supplier: a supplier named % already exists', v_name using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.suppliers (supplier_code, name, contact_person, phone, email, address, note,
                                  opening_balance_cents, is_active, created_by)
    values ('SUP-' || lpad(nextval('private.supplier_code_seq')::text, 4, '0'),
            v_name, v_contact, v_phone, v_email, v_address, v_note, v_opening,
            coalesce(p_is_active, true), v_uid)
    returning * into v_row;
  else
    update public.suppliers
       set name = v_name, contact_person = v_contact, phone = v_phone, email = v_email,
           address = v_address, note = v_note, opening_balance_cents = v_opening,
           is_active = coalesce(p_is_active, is_active), updated_at = now()
     where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'unknown_supplier: %', p_id using errcode = 'P0001';
    end if;
  end if;

  return jsonb_build_object('id', v_row.id, 'supplier_code', v_row.supplier_code, 'name', v_row.name);
end;
$$;

revoke all on function public.admin_save_supplier(uuid, text, text, text, text, text, text, bigint, boolean)
  from public, anon, service_role;
grant execute on function public.admin_save_supplier(uuid, text, text, text, text, text, text, bigint, boolean)
  to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Purchase orders
-- ----------------------------------------------------------------------------
-- p_lines: [{ "product_id": text, "variant_id": uuid|null, "quantity": int,
--             "unit_cost_cents": int }, ...]
create or replace function public.admin_create_purchase_order(
  p_supplier_id   uuid,
  p_order_date    date,
  p_expected_date date,
  p_note          text,
  p_lines         jsonb,
  p_request_id    uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_admin('create a purchase order');
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_supplier public.suppliers;
  v_po       public.purchase_orders;
  v_line     jsonb;
  v_line_no  integer := 0;
  v_product  public.products;
  v_variant  public.product_variants;
  v_qty      integer;
  v_cost     bigint;
  v_total    bigint := 0;
begin
  if p_request_id is null then
    raise exception 'invalid_request: a request id is required' using errcode = '22023';
  end if;

  select * into v_po from public.purchase_orders where request_id = p_request_id;
  if found then
    return jsonb_build_object('id', v_po.id, 'po_number', v_po.po_number, 'replayed', true);
  end if;

  select * into v_supplier from public.suppliers where id = p_supplier_id;
  if not found then
    raise exception 'unknown_supplier: choose a supplier' using errcode = 'P0001';
  end if;
  if not v_supplier.is_active then
    raise exception 'supplier_inactive: % is deactivated', v_supplier.name using errcode = 'P0001';
  end if;
  perform private.check_business_date(p_order_date, 'order date');
  if p_expected_date is not null and (p_expected_date < p_order_date or p_expected_date > p_order_date + 366) then
    raise exception 'invalid_date: the expected date must be on or after the order date, within a year' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'invalid_note: the note is limited to 500 characters' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception 'invalid_lines: between 1 and 100 lines are required' using errcode = '22023';
  end if;

  insert into public.purchase_orders (po_number, supplier_id, order_date, expected_date, note, created_by, request_id)
  values ('PO-' || lpad(nextval('private.purchase_order_number_seq')::text, 6, '0'),
          v_supplier.id, p_order_date, p_expected_date, v_note, v_uid, p_request_id)
  returning * into v_po;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;
    if jsonb_typeof(v_line) <> 'object' then
      raise exception 'invalid_lines: line % must be an object', v_line_no using errcode = '22023';
    end if;
    if coalesce(jsonb_typeof(v_line -> 'quantity'), '') <> 'number'
       or (v_line ->> 'quantity') !~ '^[0-9]+$'
       or (v_line ->> 'quantity')::integer not between 1 and 2000 then
      raise exception 'invalid_quantity: line % quantity must be a whole number from 1 to 2000', v_line_no
        using errcode = '22023';
    end if;
    v_qty := (v_line ->> 'quantity')::integer;
    v_cost := 0;
    if v_line ? 'unit_cost_cents' and jsonb_typeof(v_line -> 'unit_cost_cents') <> 'null' then
      if jsonb_typeof(v_line -> 'unit_cost_cents') <> 'number'
         or (v_line ->> 'unit_cost_cents') !~ '^[0-9]+$'
         or (v_line ->> 'unit_cost_cents')::numeric > 100000000000 then
        raise exception 'invalid_cost: line % unit cost must be a whole number of cents', v_line_no using errcode = '22023';
      end if;
      v_cost := (v_line ->> 'unit_cost_cents')::bigint;
    end if;

    select * into v_product from public.products where id = v_line ->> 'product_id';
    if not found then
      raise exception 'unknown_product: %', coalesce(v_line ->> 'product_id', '(missing)') using errcode = 'P0001';
    end if;

    v_variant := null;
    if nullif(v_line ->> 'variant_id', '') is not null then
      if (v_line ->> 'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'invalid_variant: line % has a malformed variant id', v_line_no using errcode = '22023';
      end if;
      select * into v_variant from public.product_variants
       where id = (v_line ->> 'variant_id')::uuid and product_id = v_product.id;
      if v_variant.id is null then
        raise exception 'variant_product_mismatch: that variant does not belong to %', v_product.id using errcode = 'P0001';
      end if;
    elsif exists (select 1 from public.product_variants where product_id = v_product.id) then
      raise exception 'variant_required: choose the variant (colour / storage) for %', v_product.name using errcode = 'P0001';
    end if;

    insert into public.purchase_order_lines (purchase_order_id, line_no, product_id, variant_id,
                                             product_name_snapshot, variant_label_snapshot, quantity, unit_cost_cents)
    values (v_po.id, v_line_no, v_product.id, v_variant.id, v_product.name, v_variant.name, v_qty, v_cost);

    v_total := v_total + v_qty * v_cost;
  end loop;

  update public.purchase_orders set total_cents = v_total where id = v_po.id;

  return jsonb_build_object('id', v_po.id, 'po_number', v_po.po_number, 'replayed', false);
end;
$$;

revoke all on function public.admin_create_purchase_order(uuid, date, date, text, jsonb, uuid) from public, anon, service_role;
grant execute on function public.admin_create_purchase_order(uuid, date, date, text, jsonb, uuid) to authenticated;

-- Nothing received -> cancelled. Partly received -> closed (the rest will not come).
create or replace function public.admin_close_purchase_order(
  p_purchase_order_id uuid,
  p_note              text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_admin('close a purchase order');
  v_note     text := btrim(coalesce(p_note, ''));
  v_po       public.purchase_orders;
  v_received integer;
  v_status   text;
begin
  if length(v_note) < 3 or length(v_note) > 500 then
    raise exception 'invalid_note: a note of 3 to 500 characters is required' using errcode = '22023';
  end if;

  select * into v_po from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then
    raise exception 'unknown_purchase_order: %', coalesce(p_purchase_order_id::text, '(missing)') using errcode = 'P0001';
  end if;
  if v_po.status not in ('open', 'partially_received') then
    raise exception 'purchase_order_finished: % is already %', v_po.po_number, replace(v_po.status, '_', ' ')
      using errcode = 'P0001';
  end if;

  select coalesce(sum(received_quantity), 0) into v_received
    from public.purchase_order_lines where purchase_order_id = v_po.id;
  v_status := case when v_received = 0 then 'cancelled' else 'closed' end;

  update public.purchase_orders
     set status = v_status, close_note = v_note, closed_at = now()
   where id = v_po.id;

  return jsonb_build_object('id', v_po.id, 'po_number', v_po.po_number, 'status', v_status);
end;
$$;

revoke all on function public.admin_close_purchase_order(uuid, text) from public, anon, service_role;
grant execute on function public.admin_close_purchase_order(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. Receive goods from a supplier (optionally against a PO)
-- ----------------------------------------------------------------------------
-- Same p_lines as admin_post_grn(). Posts the GRN through admin_post_grn()
-- (every unit, barcode and ledger rule unchanged), then links it to the
-- supplier and PO and counts the received quantities off the PO - all in one
-- transaction.
create or replace function public.admin_receive_goods(
  p_supplier_id       uuid,
  p_purchase_order_id uuid,
  p_supplier_invoice  text,
  p_received_on       date,
  p_note              text,
  p_lines             jsonb,
  p_request_id        uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := private.require_admin('receive stock');
  v_supplier  public.suppliers;
  v_po        public.purchase_orders;
  v_existing  public.grns;
  v_result    jsonb;
  v_grn_id    uuid;
  v_want      record;
  v_left      integer;
  v_take      integer;
  v_pol       public.purchase_order_lines;
  v_open      integer;
begin
  if p_request_id is null then
    raise exception 'invalid_request: a request id is required' using errcode = '22023';
  end if;

  -- Replay before anything else, so a retry never counts a PO twice.
  select * into v_existing from public.grns where request_id = p_request_id;
  if found then
    return jsonb_build_object('id', v_existing.id, 'grn_number', v_existing.grn_number,
                              'total_units', v_existing.total_units, 'replayed', true);
  end if;

  select * into v_supplier from public.suppliers where id = p_supplier_id;
  if not found then
    raise exception 'unknown_supplier: choose a supplier' using errcode = 'P0001';
  end if;
  if not v_supplier.is_active then
    raise exception 'supplier_inactive: % is deactivated', v_supplier.name using errcode = 'P0001';
  end if;

  if p_purchase_order_id is not null then
    select * into v_po from public.purchase_orders where id = p_purchase_order_id for update;
    if not found then
      raise exception 'unknown_purchase_order: %', p_purchase_order_id using errcode = 'P0001';
    end if;
    if v_po.supplier_id <> v_supplier.id then
      raise exception 'purchase_order_mismatch: % was ordered from a different supplier', v_po.po_number using errcode = 'P0001';
    end if;
    if v_po.status not in ('open', 'partially_received') then
      raise exception 'purchase_order_finished: % is already %', v_po.po_number, replace(v_po.status, '_', ' ')
        using errcode = 'P0001';
    end if;
  end if;

  v_result := public.admin_post_grn(v_supplier.name, p_supplier_invoice, p_received_on, p_note, p_lines, p_request_id);
  v_grn_id := (v_result ->> 'id')::uuid;

  update public.grns set supplier_id = v_supplier.id, purchase_order_id = p_purchase_order_id where id = v_grn_id;

  if p_purchase_order_id is not null then
    -- Received per item (product + variant), counted off the PO lines in order.
    for v_want in
      select l.product_id, l.variant_id, sum(l.quantity)::integer as qty, min(l.product_name_snapshot) as name,
             min(l.variant_label_snapshot) as vname
        from public.grn_lines l
       where l.grn_id = v_grn_id
       group by l.product_id, l.variant_id
    loop
      v_left := v_want.qty;
      for v_pol in
        select * from public.purchase_order_lines
         where purchase_order_id = v_po.id
           and product_id = v_want.product_id
           and variant_id is not distinct from v_want.variant_id
         order by line_no
         for update
      loop
        exit when v_left = 0;
        v_take := least(v_left, v_pol.quantity - v_pol.received_quantity);
        if v_take > 0 then
          update public.purchase_order_lines set received_quantity = received_quantity + v_take where id = v_pol.id;
          v_left := v_left - v_take;
        end if;
      end loop;
      if v_left > 0 then
        raise exception 'exceeds_purchase_order: % % is % more than is still due on %. Receive the extra on a separate GRN without a PO.',
          v_want.name, coalesce('(' || v_want.vname || ')', ''), v_left, v_po.po_number
          using errcode = 'P0001';
      end if;
    end loop;

    select count(*) into v_open from public.purchase_order_lines
     where purchase_order_id = v_po.id and received_quantity < quantity;
    update public.purchase_orders
       set status = case when v_open = 0 then 'received' else 'partially_received' end
     where id = v_po.id;
  end if;

  return v_result;
end;
$$;

comment on function public.admin_receive_goods(uuid, uuid, text, date, text, jsonb, uuid) is
  'Admin/owner. Posts a GRN for a supplier (optionally against a purchase order) and counts the received items off the PO.';

revoke all on function public.admin_receive_goods(uuid, uuid, text, date, text, jsonb, uuid) from public, anon, service_role;
grant execute on function public.admin_receive_goods(uuid, uuid, text, date, text, jsonb, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 8. Supplier returns
-- ----------------------------------------------------------------------------
-- p_codes: unit barcodes (AE...) or IMEI / serial numbers, 1 to 500.
create or replace function public.admin_create_supplier_return(
  p_supplier_id uuid,
  p_return_date date,
  p_return_type text,
  p_codes       text[],
  p_note        text,
  p_request_id  uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_admin('record a supplier return');
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_supplier public.suppliers;
  v_ret      public.supplier_returns;
  v_code     text;
  v_unit     public.inventory_units;
  v_ids      uuid[] := '{}';
  v_grn      public.grns;
  v_holder   record;
  v_total    bigint := 0;
  v_count    integer := 0;
begin
  if p_request_id is null then
    raise exception 'invalid_request: a request id is required' using errcode = '22023';
  end if;

  select * into v_ret from public.supplier_returns where request_id = p_request_id;
  if found then
    return jsonb_build_object('id', v_ret.id, 'return_number', v_ret.return_number,
                              'total_cents', v_ret.total_cents, 'total_units', v_ret.total_units, 'replayed', true);
  end if;

  select * into v_supplier from public.suppliers where id = p_supplier_id;
  if not found then
    raise exception 'unknown_supplier: choose a supplier' using errcode = 'P0001';
  end if;
  perform private.check_business_date(p_return_date, 'return date');
  if p_return_type is null or p_return_type not in ('cash', 'credit') then
    raise exception 'invalid_return_type: choose cash or credit' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'invalid_note: the note is limited to 500 characters' using errcode = '22023';
  end if;
  if p_codes is null or cardinality(p_codes) = 0 or cardinality(p_codes) > 500 then
    raise exception 'invalid_items: scan between 1 and 500 items' using errcode = '22023';
  end if;

  -- Resolve every code to one unit, once.
  foreach v_code in array p_codes
  loop
    v_code := private.normalize_serial(v_code);
    if v_code is null then
      continue;
    end if;
    select * into v_unit from public.inventory_units where barcode = v_code;
    if not found then
      select * into v_unit from public.inventory_units where serial_number = v_code;
    end if;
    if v_unit.id is null then
      raise exception 'unit_not_found: no item with barcode or IMEI %', v_code using errcode = 'P0001';
    end if;
    if v_unit.id = any (v_ids) then
      raise exception 'duplicate_item: % is scanned twice', v_unit.barcode using errcode = '23505';
    end if;
    select * into v_grn from public.grns where id = v_unit.grn_id;
    if v_grn.supplier_id is not null and v_grn.supplier_id <> v_supplier.id then
      raise exception 'wrong_supplier: % was received from % (%), not from %',
        v_unit.barcode, v_grn.supplier_name, v_grn.grn_number, v_supplier.name using errcode = 'P0001';
    end if;
    v_ids := v_ids || v_unit.id;
    v_unit := null;
  end loop;

  if cardinality(v_ids) = 0 then
    raise exception 'invalid_items: scan between 1 and 500 items' using errcode = '22023';
  end if;

  insert into public.supplier_returns (return_number, supplier_id, return_date, return_type, note, created_by, request_id)
  values ('SR-' || lpad(nextval('private.supplier_return_number_seq')::text, 6, '0'),
          v_supplier.id, p_return_date, p_return_type, v_note, v_uid, p_request_id)
  returning * into v_ret;

  -- Stock first (locks each product, the same lock order as every other path).
  for v_holder in
    select u.product_id, u.variant_id, count(*)::integer as qty
      from public.inventory_units u
     where u.id = any (v_ids)
     group by u.product_id, u.variant_id
     order by u.product_id, u.variant_id
  loop
    perform private.move_stock(v_holder.product_id, v_holder.variant_id, -v_holder.qty, 'supplier_return',
                               'Supplier return ' || v_ret.return_number || ' to ' || v_supplier.name,
                               null, null, null);
  end loop;

  for v_unit in
    select * from public.inventory_units where id = any (v_ids) order by barcode for update
  loop
    if v_unit.status <> 'in_stock' then
      raise exception 'unit_not_available: % is % and cannot be returned to the supplier',
        v_unit.barcode, replace(v_unit.status, '_', ' ') using errcode = 'P0001';
    end if;

    insert into public.supplier_return_items (supplier_return_id, unit_id, product_id, variant_id,
                                              product_name_snapshot, variant_label_snapshot,
                                              barcode_snapshot, serial_snapshot, grn_id, unit_cost_cents)
    select v_ret.id, v_unit.id, v_unit.product_id, v_unit.variant_id, p.name, v.name,
           v_unit.barcode, v_unit.serial_number, v_unit.grn_id, v_unit.unit_cost_cents
      from public.products p
      left join public.product_variants v on v.id = v_unit.variant_id
     where p.id = v_unit.product_id;

    update public.inventory_units
       set status = 'returned_to_supplier', supplier_return_id = v_ret.id, status_changed_at = now(),
           status_note = 'Returned to ' || v_supplier.name || ' (' || v_ret.return_number || ')'
     where id = v_unit.id;

    v_total := v_total + v_unit.unit_cost_cents;
    v_count := v_count + 1;
  end loop;

  update public.supplier_returns set total_cents = v_total, total_units = v_count where id = v_ret.id;

  return jsonb_build_object('id', v_ret.id, 'return_number', v_ret.return_number,
                            'total_cents', v_total, 'total_units', v_count, 'replayed', false);
end;
$$;

comment on function public.admin_create_supplier_return(uuid, date, text, text[], text, uuid) is
  'Admin/owner. Sends barcoded shelf units back to a supplier; stock falls through the ledger.';

revoke all on function public.admin_create_supplier_return(uuid, date, text, text[], text, uuid) from public, anon, service_role;
grant execute on function public.admin_create_supplier_return(uuid, date, text, text[], text, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 9. Supplier payments
-- ----------------------------------------------------------------------------
create or replace function public.admin_record_supplier_payment(
  p_supplier_id  uuid,
  p_paid_on      date,
  p_amount_cents bigint,
  p_method       text,
  p_reference    text,
  p_note         text,
  p_request_id   uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_admin('record a supplier payment');
  v_ref      text := nullif(btrim(coalesce(p_reference, '')), '');
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_supplier public.suppliers;
  v_pay      public.supplier_payments;
begin
  if p_request_id is null then
    raise exception 'invalid_request: a request id is required' using errcode = '22023';
  end if;

  select * into v_pay from public.supplier_payments where request_id = p_request_id;
  if found then
    return jsonb_build_object('id', v_pay.id, 'payment_number', v_pay.payment_number, 'replayed', true);
  end if;

  select * into v_supplier from public.suppliers where id = p_supplier_id;
  if not found then
    raise exception 'unknown_supplier: choose a supplier' using errcode = 'P0001';
  end if;
  perform private.check_business_date(p_paid_on, 'payment date');
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000000 then
    raise exception 'invalid_amount: the amount must be more than zero' using errcode = '22023';
  end if;
  if p_method is null or p_method not in ('cash', 'bank_transfer', 'cheque', 'card', 'other') then
    raise exception 'invalid_method: choose how it was paid' using errcode = '22023';
  end if;
  if p_method = 'cheque' and v_ref is null then
    raise exception 'reference_required: enter the cheque number' using errcode = '22023';
  end if;
  if v_ref is not null and length(v_ref) > 60 then
    raise exception 'invalid_reference: the reference is limited to 60 characters' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'invalid_note: the note is limited to 500 characters' using errcode = '22023';
  end if;

  insert into public.supplier_payments (payment_number, supplier_id, paid_on, amount_cents, method,
                                        reference, note, created_by, request_id)
  values ('SP-' || lpad(nextval('private.supplier_payment_number_seq')::text, 6, '0'),
          v_supplier.id, p_paid_on, p_amount_cents, p_method, v_ref, v_note, v_uid, p_request_id)
  returning * into v_pay;

  return jsonb_build_object('id', v_pay.id, 'payment_number', v_pay.payment_number, 'replayed', false);
end;
$$;

revoke all on function public.admin_record_supplier_payment(uuid, date, bigint, text, text, text, uuid) from public, anon, service_role;
grant execute on function public.admin_record_supplier_payment(uuid, date, bigint, text, text, text, uuid) to authenticated;

create or replace function public.admin_void_supplier_payment(
  p_payment_id uuid,
  p_note       text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_admin('void a supplier payment');
  v_note text := btrim(coalesce(p_note, ''));
  v_pay  public.supplier_payments;
begin
  if length(v_note) < 3 or length(v_note) > 500 then
    raise exception 'invalid_note: a note of 3 to 500 characters is required' using errcode = '22023';
  end if;
  select * into v_pay from public.supplier_payments where id = p_payment_id for update;
  if not found then
    raise exception 'unknown_payment: %', coalesce(p_payment_id::text, '(missing)') using errcode = 'P0001';
  end if;
  if v_pay.voided_at is not null then
    raise exception 'payment_voided: % is already voided', v_pay.payment_number using errcode = 'P0001';
  end if;
  update public.supplier_payments
     set voided_at = now(), voided_by = v_uid, void_note = v_note
   where id = v_pay.id;
  return jsonb_build_object('id', v_pay.id, 'payment_number', v_pay.payment_number, 'voided', true);
end;
$$;

revoke all on function public.admin_void_supplier_payment(uuid, text) from public, anon, service_role;
grant execute on function public.admin_void_supplier_payment(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 10. What the shop owes each supplier
-- ----------------------------------------------------------------------------
create or replace function public.admin_supplier_balances()
returns table (
  supplier_id          uuid,
  opening_cents        bigint,
  purchases_cents      bigint,
  credit_returns_cents bigint,
  cash_returns_cents   bigint,
  payments_cents       bigint,
  balance_cents        bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin('view supplier balances');
  return query
  select s.id,
         s.opening_balance_cents,
         coalesce(g.total, 0)::bigint,
         coalesce(r.credit, 0)::bigint,
         coalesce(r.cash, 0)::bigint,
         coalesce(p.total, 0)::bigint,
         (s.opening_balance_cents + coalesce(g.total, 0) - coalesce(r.credit, 0) - coalesce(p.total, 0))::bigint
    from public.suppliers s
    left join (select gr.supplier_id, sum(gr.total_cost_cents) as total
                 from public.grns gr where gr.supplier_id is not null group by gr.supplier_id) g
      on g.supplier_id = s.id
    left join (select sr.supplier_id,
                      sum(sr.total_cents) filter (where sr.return_type = 'credit') as credit,
                      sum(sr.total_cents) filter (where sr.return_type = 'cash') as cash
                 from public.supplier_returns sr group by sr.supplier_id) r
      on r.supplier_id = s.id
    left join (select sp.supplier_id, sum(sp.amount_cents) as total
                 from public.supplier_payments sp where sp.voided_at is null group by sp.supplier_id) p
      on p.supplier_id = s.id;
end;
$$;

comment on function public.admin_supplier_balances() is
  'Admin/owner. Opening + GRN cost - credit returns - payments, per supplier. Cash returns are listed but do not change what is owed.';

revoke all on function public.admin_supplier_balances() from public, anon, service_role;
grant execute on function public.admin_supplier_balances() to authenticated;


-- ----------------------------------------------------------------------------
-- 11. Self-verification
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['suppliers', 'purchase_orders', 'purchase_order_lines',
                           'supplier_returns', 'supplier_return_items', 'supplier_payments'] loop
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

  if has_function_privilege('anon', 'public.admin_receive_goods(uuid, uuid, text, date, text, jsonb, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_create_supplier_return(uuid, date, text, text[], text, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_record_supplier_payment(uuid, date, bigint, text, text, text, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.require_admin(text)', 'EXECUTE') then
    raise exception 'verify: function grants are wrong';
  end if;

  raise notice 'verified: purchase & returns tables are read-only for clients, writes only through functions';
end
$$;
