-- Google OAuth sign-in populates raw_user_meta_data with an avatar URL under
-- either 'avatar_url' or 'picture' depending on the flow, neither of which the
-- original handle_new_user() copied (it only ever had email/full_name to work
-- with, from phone and email/password sign-in). profiles.avatar_url already
-- existed and was already customer-writable; this only adds a better default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
