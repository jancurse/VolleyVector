-- Record each account's acceptance of the Terms & Privacy notice, captured at signup. The columns sit on
-- the profile; `accept_terms` stamps the caller's own row with the server clock and the version accepted.

alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column terms_version text;

-- A SECURITY DEFINER stamp so the time is the server's, not a value the client could forge, and so no
-- column-level update grant on profiles is needed. It only ever touches the caller's own row.
create or replace function public.accept_terms(version text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
    set terms_accepted_at = now(), terms_version = version
    where id = auth.uid();
$$;

grant execute on function public.accept_terms(text) to authenticated;

notify pgrst, 'reload schema';
