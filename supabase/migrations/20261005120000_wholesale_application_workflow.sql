-- ============================================================================
-- Apple Expert · wholesale application workflow (assistance + admin completion)
-- ----------------------------------------------------------------------------
-- EXTENDS public.wholesale_access_requests (migration 20260913140000). It does
-- not add a second application table, a second approval path or a new tier:
--
--   * Wholesale access is still profiles.customer_type = 'wholesale_vip', and
--     admin_set_customer_type() is still the ONLY code path that writes it.
--     admin_review_wholesale_request() keeps delegating to it on approval.
--   * The storefront, my_effective_prices, place_order() and every RLS policy
--     keep resolving the tier through private.current_customer_type(). Nothing
--     in an application row is ever read for authorisation or pricing.
--
-- STATUS MODEL
--
--   draft                 customer saved without submitting           (new)
--   pending               SUBMITTED, awaiting review                  (existing value, kept)
--   assistance_requested  customer asked staff to complete it         (new)
--   under_review          an admin has opened/edited it               (new)
--   approved | rejected   decisions, unchanged
--
-- DECISION (documented, not silent): the existing value 'pending' is kept as
-- the "submitted" state instead of being renamed to 'submitted'. Renaming would
-- break every installed APK build, whose request page and admin queue look for
-- 'pending'. The app labels it "Submitted"/"Pending" in the UI.
--
-- PROVENANCE: customer_values is a snapshot of exactly what the CUSTOMER
-- entered, taken when they save or submit. Admin edits change the live columns
-- only, so the admin UI can show "customer-provided" vs "admin-entered /
-- corrected" per field by comparing the two. No new audit infrastructure: the
-- project has none beyond per-table stamps, and admin_updated_by/_at follow the
-- existing reviewed_by/_at pattern.
--
-- APPROVAL STAMPS: approved_at/approved_by are NOT added. reviewed_at and
-- reviewed_by on an approved row already are those values, and the grant itself
-- stamps profiles.vip_approved_at / vip_approved_by.
--
-- REQUIRED FIELDS: approval still requires only a business name, as before.
-- Blank optional fields are flagged as "missing" in the admin UI but do not
-- block approval - which fields a wholesale customer MUST provide is a business
-- decision that has not been made, so it is not invented here.
--
-- INTERNAL NOTES live in their own table, because customers can SELECT * on
-- their own application rows (and installed builds do exactly that), so an
-- admin-only column on that table would leak to the applicant.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Status model
-- ----------------------------------------------------------------------------
alter table public.wholesale_access_requests
  drop constraint wholesale_access_requests_status_check;

alter table public.wholesale_access_requests
  add constraint wholesale_access_requests_status_check
  check (status in ('draft', 'pending', 'assistance_requested', 'under_review', 'approved', 'rejected'));

comment on column public.wholesale_access_requests.status is
  'draft | pending (= submitted) | assistance_requested | under_review | approved | rejected. Written only by the customer/admin RPCs; never read for authorisation.';

-- An assistance request may be sent before the customer knows their business
-- name. NOT NULL is kept (installed admin builds call .toLowerCase() on it), so
-- "not provided yet" is the empty string.
alter table public.wholesale_access_requests
  alter column business_name set default '';

-- ----------------------------------------------------------------------------
-- 2. New columns
-- ----------------------------------------------------------------------------
alter table public.wholesale_access_requests
  add column submitted_at            timestamptz,
  add column assistance_requested_at timestamptz,
  add column customer_values         jsonb,
  add column admin_updated_by        uuid references public.profiles (id) on delete set null,
  add column admin_updated_at        timestamptz;

comment on column public.wholesale_access_requests.customer_values is
  'Snapshot of the fields exactly as the customer entered them. Admin edits never change it.';
comment on column public.wholesale_access_requests.admin_updated_by is
  'Last administrator who entered or corrected application fields.';

-- Every existing row was written by its customer, so its live values ARE the
-- customer's values.
update public.wholesale_access_requests r
   set submitted_at    = r.created_at,
       customer_values = jsonb_build_object(
         'business_name',         nullif(r.business_name, ''),
         'business_registration', r.business_registration,
         'contact_phone',         r.contact_phone,
         'business_type',         r.business_type,
         'monthly_volume',        r.monthly_volume,
         'message',               r.message);

-- ----------------------------------------------------------------------------
-- 3. One OPEN application per customer
-- ----------------------------------------------------------------------------
-- Same index name as before, so installed builds that recognise it in the error
-- text keep showing "You already have an application under review."
drop index public.wholesale_access_requests_one_pending_uq;
create unique index wholesale_access_requests_one_pending_uq
  on public.wholesale_access_requests (profile_id)
  where status in ('draft', 'pending', 'assistance_requested', 'under_review');

-- ----------------------------------------------------------------------------
-- 4. Legacy direct-insert path (installed builds)
-- ----------------------------------------------------------------------------
-- Older builds still INSERT directly (customer-fillable columns only; status
-- takes its 'pending' default). Stamp those rows like the RPC would.
create or replace function private.wholesale_request_fill_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.submitted_at is null and new.status <> 'draft' then
    new.submitted_at := now();
  end if;
  if new.customer_values is null then
    new.customer_values := jsonb_build_object(
      'business_name',         nullif(new.business_name, ''),
      'business_registration', new.business_registration,
      'contact_phone',         new.contact_phone,
      'business_type',         new.business_type,
      'monthly_volume',        new.monthly_volume,
      'message',               new.message);
  end if;
  return new;
end;
$$;

create trigger wholesale_access_requests_fill_defaults
  before insert on public.wholesale_access_requests
  for each row execute function private.wholesale_request_fill_defaults();

-- ----------------------------------------------------------------------------
-- 5. Internal admin notes (never visible to the applicant)
-- ----------------------------------------------------------------------------
create table public.wholesale_access_request_notes (
  request_id  uuid primary key
              references public.wholesale_access_requests (id) on delete cascade,
  admin_notes text not null,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

comment on table public.wholesale_access_request_notes is
  'Internal staff notes on a wholesale application. Staff read only; written only by admin_update_wholesale_request().';

alter table public.wholesale_access_request_notes enable row level security;

create policy "wholesale_request_notes staff read" on public.wholesale_access_request_notes
  for select to authenticated using (private.has_role('staff'));

revoke all on public.wholesale_access_request_notes from anon;
revoke insert, update, delete, truncate on public.wholesale_access_request_notes from authenticated;

-- ----------------------------------------------------------------------------
-- 6. Field normalisation shared by both RPCs
-- ----------------------------------------------------------------------------
-- Only these six keys are ever read from client JSON. Anything else - status,
-- profile_id, customer_type, reviewed_by - is ignored, not merely refused.
create or replace function private.wholesale_field(p_fields jsonb, p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(coalesce(p_fields ->> p_key, '')), '');
$$;

-- ----------------------------------------------------------------------------
-- 7. customer_save_wholesale_application()
-- ----------------------------------------------------------------------------
--   p_action = 'draft'      save without submitting           -> draft
--              'submit'     submit for review (needs a name)  -> pending
--              'assistance' ask staff to complete it          -> assistance_requested
--
-- The caller is always auth.uid(); no profile id is accepted. A submitted
-- application is not editable by the customer (unchanged rule) - the one
-- customer transition after submitting is pending -> assistance_requested.
-- Nothing here touches profiles or pricing.
-- ----------------------------------------------------------------------------
create or replace function public.customer_save_wholesale_application(
  p_fields jsonb,
  p_action text
)
returns public.wholesale_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_open   public.wholesale_access_requests;
  v_row    public.wholesale_access_requests;
  v_status text;
  v_name   text;
  v_values jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if p_action not in ('draft', 'submit', 'assistance') then
    raise exception 'invalid_action: % (expected draft, submit or assistance)', p_action
      using errcode = '22023';
  end if;

  -- An account the database already prices as Wholesale VIP has nothing to apply for.
  if private.current_customer_type() = 'wholesale_vip' then
    raise exception 'already_wholesale: this account already has wholesale access'
      using errcode = '22023';
  end if;

  v_status := case p_action
                when 'draft'  then 'draft'
                when 'submit' then 'pending'
                else 'assistance_requested'
              end;

  v_name := private.wholesale_field(p_fields, 'business_name');
  if p_action = 'submit' and v_name is null then
    raise exception 'business_name_required: a business name is needed to submit'
      using errcode = '23502';
  end if;

  v_values := jsonb_build_object(
    'business_name',         v_name,
    'business_registration', private.wholesale_field(p_fields, 'business_registration'),
    'contact_phone',         private.wholesale_field(p_fields, 'contact_phone'),
    'business_type',         private.wholesale_field(p_fields, 'business_type'),
    'monthly_volume',        private.wholesale_field(p_fields, 'monthly_volume'),
    'message',               private.wholesale_field(p_fields, 'message'));

  select * into v_open
    from public.wholesale_access_requests r
   where r.profile_id = v_uid
     and r.status in ('draft', 'pending', 'assistance_requested', 'under_review')
   for update;

  if v_open.id is null then
    insert into public.wholesale_access_requests (
      profile_id, business_name, business_registration, contact_phone,
      business_type, monthly_volume, message, status,
      submitted_at, assistance_requested_at, customer_values)
    values (
      v_uid, coalesce(v_name, ''),
      v_values ->> 'business_registration', v_values ->> 'contact_phone',
      v_values ->> 'business_type', v_values ->> 'monthly_volume', v_values ->> 'message',
      v_status,
      case when v_status = 'draft' then null else now() end,
      case when v_status = 'assistance_requested' then now() end,
      v_values)
    returning * into v_row;
    return v_row;
  end if;

  if v_open.status = 'draft' then
    update public.wholesale_access_requests r
       set business_name           = coalesce(v_name, ''),
           business_registration   = v_values ->> 'business_registration',
           contact_phone           = v_values ->> 'contact_phone',
           business_type           = v_values ->> 'business_type',
           monthly_volume          = v_values ->> 'monthly_volume',
           message                 = v_values ->> 'message',
           status                  = v_status,
           submitted_at            = case when v_status = 'draft' then null else now() end,
           assistance_requested_at = case when v_status = 'assistance_requested' then now() end,
           customer_values         = v_values
     where r.id = v_open.id
    returning * into v_row;
    return v_row;
  end if;

  -- Submitted but not yet picked up: the customer may still ask for help.
  -- The submitted fields are left exactly as they were.
  if v_open.status = 'pending' and p_action = 'assistance' then
    update public.wholesale_access_requests r
       set status = 'assistance_requested',
           assistance_requested_at = now()
     where r.id = v_open.id
    returning * into v_row;
    return v_row;
  end if;

  raise exception 'application_locked: your application (%) is already with our team', v_open.status
    using errcode = '55000';
end;
$$;

comment on function public.customer_save_wholesale_application(jsonb, text) is
  'Customer-side save/submit/request-assistance for the caller''s own wholesale application. Never grants access.';

revoke all on function public.customer_save_wholesale_application(jsonb, text) from public, anon;
grant execute on function public.customer_save_wholesale_application(jsonb, text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. admin_update_wholesale_request()
-- ----------------------------------------------------------------------------
-- Lets an admin complete or correct an OPEN application on the customer's
-- behalf, and keep internal notes on any application.
--
--   p_fields      full set of the six fields, or NULL to leave them alone
--   p_admin_notes internal note; NULL = unchanged, '' = cleared
--
-- Editing moves a submitted / assistance-requested application to
-- under_review. It never decides the application and never touches pricing.
-- Same role as deciding (admin/owner): staff may read the queue, not change it.
-- ----------------------------------------------------------------------------
create or replace function public.admin_update_wholesale_request(
  p_request_id  uuid,
  p_fields      jsonb default null,
  p_admin_notes text  default null
)
returns public.wholesale_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row   public.wholesale_access_requests;
  v_name  text;
  v_note  text;
begin
  if not private.has_role('admin') then
    raise exception 'insufficient_privilege: admin or owner role required'
      using errcode = '42501';
  end if;

  select * into v_row
    from public.wholesale_access_requests r
   where r.id = p_request_id
   for update;

  if v_row.id is null then
    raise exception 'unknown_request: %', p_request_id using errcode = '23503';
  end if;

  if p_fields is not null then
    if v_row.status not in ('pending', 'assistance_requested', 'under_review') then
      raise exception 'not_open: a % application cannot be edited', v_row.status
        using errcode = '55000';
    end if;

    v_name := private.wholesale_field(p_fields, 'business_name');

    update public.wholesale_access_requests r
       set business_name         = coalesce(v_name, ''),
           business_registration = private.wholesale_field(p_fields, 'business_registration'),
           contact_phone         = private.wholesale_field(p_fields, 'contact_phone'),
           business_type         = private.wholesale_field(p_fields, 'business_type'),
           monthly_volume        = private.wholesale_field(p_fields, 'monthly_volume'),
           message               = private.wholesale_field(p_fields, 'message'),
           status                = 'under_review',
           admin_updated_by      = v_actor,
           admin_updated_at      = now()
     where r.id = p_request_id
    returning * into v_row;
  end if;

  if p_admin_notes is not null then
    v_note := nullif(btrim(p_admin_notes), '');
    if v_note is null then
      delete from public.wholesale_access_request_notes n where n.request_id = p_request_id;
    else
      insert into public.wholesale_access_request_notes (request_id, admin_notes, updated_by, updated_at)
      values (p_request_id, v_note, v_actor, now())
      on conflict (request_id) do update
        set admin_notes = excluded.admin_notes,
            updated_by  = excluded.updated_by,
            updated_at  = excluded.updated_at;
    end if;
  end if;

  return v_row;
end;
$$;

comment on function public.admin_update_wholesale_request(uuid, jsonb, text) is
  'Admin-only: complete/correct an open wholesale application and keep internal notes. Never decides or grants.';

revoke all on function public.admin_update_wholesale_request(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_update_wholesale_request(uuid, jsonb, text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. admin_review_wholesale_request() - same signature, wider open set
-- ----------------------------------------------------------------------------
-- Changes from the original: any OPEN submitted status may be decided (not only
-- 'pending'), a draft may not, and approval requires a business name. Approval
-- still grants VIP solely through admin_set_customer_type().
-- ----------------------------------------------------------------------------
create or replace function public.admin_review_wholesale_request(
  p_request_id uuid,
  p_status     text,
  p_note       text default null
)
returns public.wholesale_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row   public.wholesale_access_requests;
begin
  v_actor := (select auth.uid());

  if not private.has_role('admin') then
    raise exception 'insufficient_privilege: admin or owner role required'
      using errcode = '42501';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid_status: % (expected approved or rejected)', p_status
      using errcode = '22023';
  end if;

  if p_status = 'approved' and exists (
    select 1 from public.wholesale_access_requests r
     where r.id = p_request_id and btrim(r.business_name) = ''
  ) then
    raise exception 'incomplete_application: add the business name before approving'
      using errcode = '23502';
  end if;

  -- The status predicate keeps this idempotent: a closed (or draft)
  -- application cannot be decided, or re-decided by a double submit.
  update public.wholesale_access_requests r
     set status      = p_status,
         reviewed_by = v_actor,
         reviewed_at = now(),
         review_note = nullif(btrim(coalesce(p_note, '')), '')
   where r.id = p_request_id
     and r.status in ('pending', 'assistance_requested', 'under_review')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'not_pending: request % does not exist, is a draft, or was already reviewed', p_request_id
      using errcode = '23505';
  end if;

  if p_status = 'approved' then
    perform public.admin_set_customer_type(v_row.profile_id, 'wholesale_vip');
  end if;

  return v_row;
end;
$$;

comment on function public.admin_review_wholesale_request(uuid, text, text) is
  'Admin-only decision on a submitted wholesale application. Approving delegates the grant to admin_set_customer_type().';

revoke all on function public.admin_review_wholesale_request(uuid, text, text)
  from public, anon;
grant execute on function public.admin_review_wholesale_request(uuid, text, text)
  to authenticated, service_role;
