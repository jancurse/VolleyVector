-- VolleyVector — landing-page access requests (express interest).
-- The app is invite-only, so a logged-out visitor with no invite cannot sign up. This table records the
-- interest they submit from the landing page, the source of truth an admin works from. The row is written
-- only by the server (the request-access Edge Function under the secret key), never by an ordinary client:
-- there is no insert grant or policy for authenticated. A best-effort notification email rides on top of
-- the stored row, but the row is what persists. Admins read the list and update each row (mark handled, or
-- dismiss as a soft-delete), mirroring the deletion fields used across the schema.

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);

-- The admin list reads open requests newest-first; the partial index skips dismissed rows.
create index access_requests_open_idx on public.access_requests (created_at desc) where deleted_at is null;

-- The server writes the row; an admin reads and updates it. "Auto-expose new tables" is off, so the
-- service-role grant is explicit even though it bypasses RLS.
grant select, update on public.access_requests to authenticated;
grant select, insert, update, delete on public.access_requests to service_role;

alter table public.access_requests enable row level security;

-- Only an admin may read or update a request. There is no insert or delete grant for authenticated, and no
-- policy for either, so a client can never write a request directly — only the Edge Function's secret key,
-- which bypasses RLS, inserts.
create policy access_requests_select on public.access_requests for select to authenticated
using (public.is_admin());

create policy access_requests_update on public.access_requests for update to authenticated
using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
