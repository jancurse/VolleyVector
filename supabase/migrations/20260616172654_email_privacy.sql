-- VolleyVector — email privacy and case-insensitive email uniqueness.
-- A non-admin client must never receive another user's email. RLS is row-level, so a teammate may read
-- another's profile row for the display name; email exposure is therefore controlled at the column
-- level here. The email column is dropped from the set an authenticated client may select, and admins
-- reach it through an admin-only RPC instead. Profile emails are also made case-insensitively unique,
-- so one address resolves to at most one account (the exact-email share path relies on this).

-- Resolve duplicates by hand first: which account keeps a shared address is a human decision, so fail
-- loudly with the offending addresses rather than letting the unique index build with a cryptic error.
do $$
declare
  dupes text;
begin
  select string_agg(e, ', ') into dupes
  from (
    select lower(email) as e
    from public.profiles
    where email is not null
    group by lower(email)
    having count(*) > 1
  ) d;

  if dupes is not null then
    raise exception 'Resolve duplicate profile emails before this migration: %', dupes;
  end if;
end;
$$;

create unique index profiles_email_lower_key on public.profiles (lower(email)) where email is not null;

-- Narrow the columns an authenticated client may read to every column except email. The
-- profiles_select policy still governs which rows (self, teammates, admin); this keeps email from
-- leaving the server for a normal client even on a row they may otherwise read.
revoke select on public.profiles from authenticated;
grant select (id, display_name, is_admin, created_at, deleted_at) on public.profiles to authenticated;

-- Admins still see email (the admin panel). A security-definer RPC returns the full profile list with
-- email, guarded by is_admin(), so email is exposed through an admin-only path rather than a column any
-- client could select. Like the other helpers it runs with an empty search_path and fully qualifies
-- every name.
create function public.admin_list_profiles()
returns table (id uuid, email text, display_name text, is_admin boolean, deleted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.email, p.display_name, p.is_admin, p.deleted_at
  from public.profiles p
  where public.is_admin();
$$;

grant execute on function public.admin_list_profiles() to authenticated;

notify pgrst, 'reload schema';
