-- ============================================================================
-- Apple Expert · P1 · inventory ledger and stock-write security
-- ----------------------------------------------------------------------------
-- Makes public.inventory_movements the trustworthy record of every legacy stock
-- change, and makes public.admin_set_stock() the only application path that can
-- change products.stock / product_variants.stock.
--
-- THE RULE ENFORCED HERE
--
--   A stock value may change only inside a transaction that has ALREADY written
--   a matching ledger row: same product, same variant (or none), same previous
--   and new quantity, same transaction id.
--
-- The guard does NOT trust a function because it is SECURITY DEFINER or owned
-- by postgres. Every SECURITY DEFINER function in this schema is owned by
-- postgres (place_order, admin_set_price, ...), so "current_user = postgres"
-- would let any of them, or any future one, move stock without an audit row.
-- Instead, admin_set_stock() writes the ledger row first and the guard checks
-- for it. Clients cannot insert ledger rows at all, so they cannot create the
-- row the guard needs.
--
-- TRUSTED OPERATOR SESSIONS (documented, not silent)
--   A session whose LOGIN role is a member of postgres (postgres,
--   supabase_admin, the CLI's login role) may insert and update stock without a
--   ledger row. Those identities own these tables and could disable or drop the
--   trigger anyway, so blocking them adds friction, not security; migrations
--   and the local seed need it. session_user is fixed at login and cannot be
--   changed by an API client, and API requests always log in as authenticator,
--   which is not a member of postgres (checked below, the migration aborts
--   otherwise). A session that has switched to anon / authenticated /
--   service_role is never treated as an operator. Deletion rules apply to
--   everyone, operators included. Editing stock in Studio or the SQL Editor
--   therefore bypasses the ledger; that is a procedural control.
--
-- DECISIONS (approved for P1)
--   * Only admin and owner may adjust stock (private.has_role('admin')).
--   * Every adjustment needs an approved reason and a 3-500 character note.
--   * Quantities are whole numbers from 0 to 100,000.
--   * A variant that inherits product stock (stock IS NULL) is adjusted through
--     its product. Switching a variant between inherited and independent stock
--     is refused in P1.
--   * Products and variants with positive stock or any ledger history cannot
--     be deleted. Retiring obsolete variants is P2.
--   * No stock value is changed by this migration. place_order(jsonb, text) is
--     not touched.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Pre-flight. Abort rather than guess if the database is not what the repo
--    describes.
-- ----------------------------------------------------------------------------
do $$
declare
  v_columns text;
begin
  -- The operator exemption is only safe while the API login role is not a
  -- member of postgres.
  if pg_catalog.pg_has_role('authenticator', 'postgres', 'MEMBER') then
    raise exception 'pre-flight: authenticator is a member of postgres; the stock guard operator exemption would be unsafe';
  end if;

  select string_agg(column_name, ',' order by column_name)
    into v_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'inventory_movements';

  if v_columns is distinct from 'actor_id,created_at,delta,id,note,order_id,product_id,reason,variant_id' then
    raise exception 'pre-flight: unexpected inventory_movements columns: %', v_columns;
  end if;

  raise notice 'pre-flight ok: inventory_movements has % existing rows',
    (select count(*) from public.inventory_movements);
end
$$;


-- ----------------------------------------------------------------------------
-- 1. Ledger: additive columns. Existing columns keep their meaning; delta is
--    still the signed change to stock on hand.
-- ----------------------------------------------------------------------------
alter table public.inventory_movements
  add column quantity_before integer
    constraint inventory_movements_quantity_before_check
    check (quantity_before is null or quantity_before >= 0),
  add column quantity_after integer
    constraint inventory_movements_quantity_after_check
    check (quantity_after is null or quantity_after >= 0),
  add column request_id uuid,
  -- The transaction that wrote the row. The stock guard matches on it, so a
  -- ledger row authorises a stock change only inside its own transaction.
  add column txid xid8 not null default pg_catalog.pg_current_xact_id(),
  -- Write order. created_at is the transaction start time, so it cannot order
  -- two rows written by one transaction; the guard needs that order.
  add column entry_seq bigint generated always as identity,
  add constraint inventory_movements_before_after_pair
    check ((quantity_before is null) = (quantity_after is null)),
  add constraint inventory_movements_delta_matches
    check (quantity_after is null or delta = quantity_after - quantity_before);

-- Idempotency: one ledger row per client request.
create unique index inventory_movements_request_id_key
  on public.inventory_movements (request_id)
  where request_id is not null;

-- One ledger row authorises exactly one stock transition per transaction.
create unique index inventory_movements_txn_transition_key
  on public.inventory_movements (txid, product_id, variant_id, quantity_before, quantity_after)
  nulls not distinct
  where quantity_after is not null;

create index inventory_movements_variant_idx
  on public.inventory_movements (variant_id, created_at desc)
  where variant_id is not null;

-- The guard's lookup: this transaction's latest row for one product/variant.
create index inventory_movements_txid_idx
  on public.inventory_movements (txid, product_id, entry_seq desc);

-- Reasons: every existing value is kept; three are added for adjustments.
-- The CHECK is located by its column rather than assumed by name.
do $$
declare
  v_name text;
begin
  select c.conname into v_name
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.conrelid = 'public.inventory_movements'::regclass
    and c.contype = 'c'
    and a.attname = 'reason';

  if v_name is null then
    raise exception 'pre-flight: no CHECK constraint found on inventory_movements.reason';
  end if;

  execute format('alter table public.inventory_movements drop constraint %I', v_name);
end
$$;

alter table public.inventory_movements
  add constraint inventory_movements_reason_check
  check (reason in ('seed', 'restock', 'sale', 'return', 'adjustment', 'damage', 'transfer',
                    'stock_count', 'correction', 'opening_balance'));

comment on table public.inventory_movements is
  'Stock ledger, append-only for every API role (anon, authenticated, service_role). Written only by SECURITY DEFINER functions (admin_set_stock in P1); every application change to products.stock / product_variants.stock has a matching row in the same transaction. The table owner and superusers are not restricted.';
comment on column public.inventory_movements.quantity_before is
  'Stock on record before this movement. Set by admin_set_stock; NULL only on legacy rows.';
comment on column public.inventory_movements.quantity_after is
  'Stock on record after this movement. delta = quantity_after - quantity_before.';
comment on column public.inventory_movements.request_id is
  'Client-generated id of the request that wrote this row. Unique, so a retried request is applied once.';
comment on column public.inventory_movements.txid is
  'Transaction that wrote the row. The stock guard accepts a stock change only when it matches the latest row for that item in the same transaction.';
comment on column public.inventory_movements.entry_seq is
  'Insertion order. Orders rows written within one transaction, which share created_at.';


-- ----------------------------------------------------------------------------
-- 2. The ledger is no longer client-writable. Staff keep read access; the
--    stock guard relies on it when an admin deletes a product or variant.
-- ----------------------------------------------------------------------------
drop policy if exists "inventory_movements staff insert" on public.inventory_movements;
drop policy if exists "inventory_movements admin all"    on public.inventory_movements;

revoke insert, update, delete, truncate on public.inventory_movements from anon, authenticated;

-- service_role (the secret API key) bypasses RLS and holds Supabase's default
-- ALL grant, so with it any API request could forge, rewrite or delete history.
-- It is NOLOGIN and not a member of postgres: it reaches the database only
-- through authenticator (the API), so revoking its write privileges closes
-- every API path. LIMITATION, not solved here: the table owner (postgres) and
-- superusers (supabase_admin) can still write or truncate the ledger and can
-- re-grant themselves anything; they are operator sessions, controlled by
-- credential custody, not by grants.
revoke insert, update, delete, truncate on public.inventory_movements from service_role;


-- ----------------------------------------------------------------------------
-- 3. Stock guards
-- ----------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user must be the caller's role (anon /
-- authenticated) for a direct API request, and the function owner only when the
-- change comes from inside a SECURITY DEFINER function. Neither case is trusted
-- by identity; both need the ledger row. Trigger functions are not called
-- through EXECUTE privileges, so no grant is needed for them to fire.
--
-- EXACTLY ONCE: the change must match the LATEST ledger row this transaction
-- wrote for that product/variant. After it is applied, stock equals that row's
-- quantity_after, so the same row can only match again if stock is moved back
-- without a ledger row - which only an operator session can do.
-- ----------------------------------------------------------------------------
create or replace function private.guard_product_stock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_operator boolean := pg_catalog.pg_has_role(session_user, 'postgres', 'MEMBER')
                        and current_user not in ('anon', 'authenticated', 'service_role');
  v_last     public.inventory_movements;
begin
  if tg_op = 'DELETE' then
    -- Applies to everyone: stock must never disappear without a ledger row.
    if old.stock > 0 then
      raise exception 'stock_on_hand: % still has % in stock and cannot be deleted', old.id, old.stock
        using errcode = '42501',
              hint = 'Set its stock to 0 with Adjust stock in Apple Expert admin 1.1.0 or later, or unpublish it instead.';
    end if;
    if exists (select 1 from public.inventory_movements m where m.product_id = old.id) then
      raise exception 'inventory_history_exists: % has stock history and cannot be deleted', old.id
        using errcode = '42501', hint = 'Unpublish it instead.';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if v_operator or new.stock = 0 then
      return new;
    end if;
    raise exception 'stock_locked: new products start with zero stock'
      using errcode = '42501',
            hint = 'Record opening stock with Adjust stock in Apple Expert admin 1.1.0 or later.';
  end if;

  -- UPDATE OF stock. Re-sending the same value (installed admin builds do) is fine.
  if new.stock is not distinct from old.stock or v_operator then
    return new;
  end if;

  select * into v_last from public.inventory_movements m
   where m.txid = pg_catalog.pg_current_xact_id()
     and m.product_id = new.id
     and m.variant_id is null
   order by m.entry_seq desc
   limit 1;

  if found and v_last.quantity_before = old.stock and v_last.quantity_after = new.stock then
    return new;
  end if;

  raise exception 'stock_locked: stock can only be changed with Adjust stock'
    using errcode = '42501',
          hint = 'Update the Apple Expert admin app to 1.1.0 or later and use Adjust stock.';
end;
$$;

create or replace function private.guard_variant_stock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_operator boolean := pg_catalog.pg_has_role(session_user, 'postgres', 'MEMBER')
                        and current_user not in ('anon', 'authenticated', 'service_role');
  v_last     public.inventory_movements;
begin
  if tg_op = 'DELETE' then
    if old.stock is not null and old.stock > 0 then
      raise exception 'stock_on_hand: this variant still has % in stock and cannot be deleted', old.stock
        using errcode = '42501',
              hint = 'Set its stock to 0 with Adjust stock in Apple Expert admin 1.1.0 or later.';
    end if;
    if exists (select 1 from public.inventory_movements m where m.variant_id = old.id) then
      raise exception 'inventory_history_exists: this variant has stock history and cannot be deleted'
        using errcode = '42501', hint = 'Leave it at zero stock; retiring variants arrives in a later update.';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if v_operator or new.stock is null then
      return new;
    end if;
    raise exception 'stock_locked: new variants share their product''s stock'
      using errcode = '42501',
            hint = 'Leave variant stock blank; adjust the product''s stock instead.';
  end if;

  -- Moving a variant to another product would carry its own stock (and its
  -- history) across products without a ledger row.
  if new.product_id is distinct from old.product_id and not v_operator
     and (old.stock is not null
          or exists (select 1 from public.inventory_movements m where m.variant_id = old.id)) then
    raise exception 'stock_locked: a variant with its own stock or stock history cannot move to another product'
      using errcode = '42501';
  end if;

  if new.stock is not distinct from old.stock or v_operator then
    return new;
  end if;

  if (old.stock is null) <> (new.stock is null) then
    raise exception 'stock_mode_locked: a variant cannot switch between shared and its own stock'
      using errcode = '42501',
            hint = 'This changes after a physical stock count in a later update.';
  end if;

  select * into v_last from public.inventory_movements m
   where m.txid = pg_catalog.pg_current_xact_id()
     and m.product_id = new.product_id
     and m.variant_id = new.id
   order by m.entry_seq desc
   limit 1;

  if found and v_last.quantity_before = old.stock and v_last.quantity_after = new.stock then
    return new;
  end if;

  raise exception 'stock_locked: stock can only be changed with Adjust stock'
    using errcode = '42501',
          hint = 'Update the Apple Expert admin app to 1.1.0 or later and use Adjust stock.';
end;
$$;

-- Supabase's default privileges also grant EXECUTE on new functions to
-- service_role, so it is named explicitly here and below.
revoke all on function private.guard_product_stock() from public, anon, authenticated, service_role;
revoke all on function private.guard_variant_stock() from public, anon, authenticated, service_role;

create trigger products_guard_stock
  before insert or update of stock or delete on public.products
  for each row execute function private.guard_product_stock();

create trigger product_variants_guard_stock
  before insert or update of stock, product_id or delete on public.product_variants
  for each row execute function private.guard_variant_stock();


-- ----------------------------------------------------------------------------
-- 4. admin_set_stock() - the only application path that changes stock
-- ----------------------------------------------------------------------------
-- Order matters:
--   authorise -> validate input -> lock product, then variant -> replay a
--   completed request -> stale / no-change checks -> ledger row -> stock.
-- A completed request is replayed BEFORE the staleness check, so a retry after
-- a lost response returns the original result instead of stale_quantity.
-- Every parameter is required: a defaulted parameter would make a later
-- overload ambiguous to PostgREST.
-- ----------------------------------------------------------------------------
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

  -- 5. State checks.
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

comment on function public.admin_set_stock(text, uuid, integer, integer, text, text, uuid) is
  'Admin/owner stock adjustment. Locks the row, replays a completed request id, rejects stale values, writes the ledger row and then the stock in one transaction.';

revoke all on function public.admin_set_stock(text, uuid, integer, integer, text, text, uuid) from public, anon, service_role;
grant execute on function public.admin_set_stock(text, uuid, integer, integer, text, text, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Anonymous callers keep no write privileges on the two stock tables.
--    RLS already refused every such write (no policy targets anon); this
--    removes the grants a future permissive policy would silently re-open.
--    authenticated keeps INSERT/UPDATE/DELETE: product and variant editing use
--    them, the "admin all" policies decide who may, and the guards above
--    decide what may happen to stock.
-- ----------------------------------------------------------------------------
revoke insert, update, delete on public.products, public.product_variants from anon;


-- ----------------------------------------------------------------------------
-- 6. Self-verification. Fails the migration if any of the above did not hold.
-- ----------------------------------------------------------------------------
do $$
begin
  if has_table_privilege('authenticated', 'public.inventory_movements', 'INSERT')
     or has_table_privilege('authenticated', 'public.inventory_movements', 'UPDATE')
     or has_table_privilege('authenticated', 'public.inventory_movements', 'DELETE')
     or has_table_privilege('anon', 'public.inventory_movements', 'INSERT') then
    raise exception 'verify: a client role can still write inventory_movements';
  end if;

  if has_table_privilege('service_role', 'public.inventory_movements', 'INSERT')
     or has_table_privilege('service_role', 'public.inventory_movements', 'UPDATE')
     or has_table_privilege('service_role', 'public.inventory_movements', 'DELETE')
     or has_table_privilege('service_role', 'public.inventory_movements', 'TRUNCATE')
     or has_function_privilege('service_role', 'public.admin_set_stock(text, uuid, integer, integer, text, text, uuid)', 'EXECUTE') then
    raise exception 'verify: service_role can still write inventory_movements or call admin_set_stock';
  end if;
  if not has_table_privilege('service_role', 'public.inventory_movements', 'SELECT') then
    raise exception 'verify: service_role lost SELECT on inventory_movements';
  end if;

  if has_table_privilege('anon', 'public.products', 'INSERT')
     or has_table_privilege('anon', 'public.products', 'UPDATE')
     or has_table_privilege('anon', 'public.products', 'DELETE')
     or has_table_privilege('anon', 'public.product_variants', 'INSERT')
     or has_table_privilege('anon', 'public.product_variants', 'UPDATE')
     or has_table_privilege('anon', 'public.product_variants', 'DELETE') then
    raise exception 'verify: anon can still write products or product_variants';
  end if;

  if not has_table_privilege('authenticated', 'public.products', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.product_variants', 'INSERT') then
    raise exception 'verify: authenticated lost catalog editing privileges';
  end if;

  if has_function_privilege('anon', 'public.admin_set_stock(text, uuid, integer, integer, text, text, uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_set_stock(text, uuid, integer, integer, text, text, uuid)', 'EXECUTE') then
    raise exception 'verify: admin_set_stock execute grants are wrong';
  end if;

  if (select count(*) from pg_catalog.pg_trigger
      where not tgisinternal and tgname in ('products_guard_stock', 'product_variants_guard_stock')) <> 2 then
    raise exception 'verify: stock guard triggers missing';
  end if;

  if pg_catalog.pg_has_role('authenticator', 'postgres', 'MEMBER') then
    raise exception 'verify: authenticator is a member of postgres';
  end if;

  raise notice 'verified: ledger read-only for anon, authenticated and service_role; stock guards installed; admin_set_stock granted to authenticated only';
end
$$;


-- ----------------------------------------------------------------------------
-- Rollback (manual, if ever needed). Ledger rows are never deleted.
--   revoke all on function public.admin_set_stock(text, uuid, integer, integer, text, text, uuid) from authenticated;
--   drop function if exists public.admin_set_stock(text, uuid, integer, integer, text, text, uuid);
--   drop trigger if exists products_guard_stock on public.products;
--   drop trigger if exists product_variants_guard_stock on public.product_variants;
--   drop function if exists private.guard_product_stock();
--   drop function if exists private.guard_variant_stock();
--   grant insert on public.inventory_movements to authenticated;
--   grant insert, update, delete, truncate on public.inventory_movements to service_role;
--   create policy "inventory_movements staff insert" on public.inventory_movements
--     for insert to authenticated with check (private.has_role('staff'));
--   create policy "inventory_movements admin all" on public.inventory_movements
--     for all to authenticated using (private.has_role('admin')) with check (private.has_role('admin'));
--   -- Optional and not recommended: grant insert, update, delete on public.products, public.product_variants to anon;
--   -- The new columns, indexes and widened reason CHECK can stay; they are
--   -- nullable/defaulted and harmless. Drop them only if no row uses them.
-- ----------------------------------------------------------------------------
