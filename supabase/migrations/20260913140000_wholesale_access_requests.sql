-- ============================================================================
-- Apple Expert · 16 · wholesale access requests
-- ----------------------------------------------------------------------------
-- WHAT THIS IS FOR
--
-- The customer entry screen lets a shopper choose the "Wholesale" EXPERIENCE.
-- That choice is a UI preference and nothing more: it does not, and must never,
-- change public.profiles.customer_type. A shopper who picks Wholesale and has
-- no VIP grant lands on a request form, which writes a row here for an
-- administrator to review.
--
-- THE GRANT ITSELF STILL HAPPENS EXACTLY ONE WAY
--
-- admin_set_customer_type() remains the only code path that can write
-- customer_type. The review function below does not update profiles itself - it
-- CALLS that function, so the existing role check, audit stamping and column
-- revokes all still apply unchanged.
-- ============================================================================

create table public.wholesale_access_requests (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles (id) on delete cascade,

  -- What the shopper tells us. None of this is trusted for authorisation; it is
  -- the evidence an administrator reads before deciding.
  business_name         text not null,
  business_registration text,
  contact_phone         text,
  business_type         text,
  monthly_volume        text,
  message               text,

  status                text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected')),

  reviewed_by           uuid references public.profiles (id) on delete set null,
  reviewed_at           timestamptz,
  review_note           text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger wholesale_access_requests_set_updated_at
  before update on public.wholesale_access_requests
  for each row execute function public.set_updated_at();

-- One open request per customer. A partial unique index, so a customer whose
-- request was rejected may apply again while an open one cannot be duplicated.
create unique index wholesale_access_requests_one_pending_uq
  on public.wholesale_access_requests (profile_id)
  where status = 'pending';

create index wholesale_access_requests_review_idx
  on public.wholesale_access_requests (status, created_at desc);

comment on table public.wholesale_access_requests is
  'Customer applications for Wholesale VIP pricing. Reviewing one never writes customer_type directly - admin_review_wholesale_request() calls admin_set_customer_type().';
comment on column public.wholesale_access_requests.status is
  'pending | approved | rejected. Writable only by admin_review_wholesale_request().';

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------
alter table public.wholesale_access_requests enable row level security;

create policy "wholesale_requests own read" on public.wholesale_access_requests
  for select to authenticated using (profile_id = (select auth.uid()));

create policy "wholesale_requests own insert" on public.wholesale_access_requests
  for insert to authenticated with check (profile_id = (select auth.uid()));

create policy "wholesale_requests staff read" on public.wholesale_access_requests
  for select to authenticated using (private.has_role('staff'));

-- DELIBERATELY NO update or delete policy for ANY role, admins included. The
-- review RPC is SECURITY DEFINER and therefore bypasses RLS after checking the
-- caller's role itself, which is the same shape as admin_set_price() and
-- admin_set_customer_type(). A decision is never rewritten from a browser.

-- ----------------------------------------------------------------------------
-- Column privileges (defence in depth)
-- ----------------------------------------------------------------------------
-- Supabase grants ALL on new public tables to anon/authenticated by default, so
-- the table-level grants must be revoked FIRST and the customer-fillable
-- columns granted back explicitly - the same ordering trap documented in
-- migration 12. Without this a customer could INSERT their own row with
-- status = 'approved' and reviewed_by set, which would not grant them VIP
-- pricing but would absolutely mislead the administrator reading the queue.
revoke insert, update, delete on public.wholesale_access_requests
  from anon, authenticated;

grant insert (
  profile_id, business_name, business_registration,
  contact_phone, business_type, monthly_volume, message
) on public.wholesale_access_requests to authenticated;

-- ----------------------------------------------------------------------------
-- admin_review_wholesale_request()
-- ----------------------------------------------------------------------------
-- Approving is one atomic step: the row is stamped AND the grant is made. Two
-- separate admin actions would eventually leave approved customers still paying
-- retail, which is the failure this function exists to prevent.
--
-- auth.uid() reads a request-level setting, not the function owner, so calling
-- admin_set_customer_type() from inside here still evaluates the REAL caller's
-- role. Nesting does not launder privilege.
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

  -- 1. Authorisation. Staff may READ the queue but not decide it.
  if not private.has_role('admin') then
    raise exception 'insufficient_privilege: admin or owner role required'
      using errcode = '42501';
  end if;

  -- 2. A review is a decision; 'pending' is not one.
  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid_status: % (expected approved or rejected)', p_status
      using errcode = '22023';
  end if;

  -- 3. Decide the request. The status predicate makes this idempotent: a
  --    double-submit from a slow connection cannot re-decide a closed request.
  update public.wholesale_access_requests r
     set status      = p_status,
         reviewed_by = v_actor,
         reviewed_at = now(),
         review_note = nullif(btrim(coalesce(p_note, '')), '')
   where r.id = p_request_id
     and r.status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'not_pending: request % does not exist or was already reviewed', p_request_id
      using errcode = '23505';
  end if;

  -- 4. Approval grants VIP through the EXISTING mechanism, never by writing
  --    profiles.customer_type here. Rejection changes no pricing at all.
  if p_status = 'approved' then
    perform public.admin_set_customer_type(v_row.profile_id, 'wholesale_vip');
  end if;

  return v_row;
end;
$$;

comment on function public.admin_review_wholesale_request(uuid, text, text) is
  'Admin-only decision on a wholesale access request. Approving delegates the grant to admin_set_customer_type().';

revoke all on function public.admin_review_wholesale_request(uuid, text, text)
  from public, anon;
grant execute on function public.admin_review_wholesale_request(uuid, text, text)
  to authenticated, service_role;
