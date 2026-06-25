-- VolleyVector — in-app feedback (bug reports and feature requests).
-- A signed-in user reports a bug or requests a feature from the account menu. This table records the
-- report, the source of truth an admin works from. The row is written only by the server (the
-- submit-feedback Edge Function under the secret key), never by an ordinary client: there is no insert
-- grant or policy for authenticated. A best-effort notification email rides on top of the stored row, but
-- the row is what persists. The reporter is stored for follow-up; an admin resolves it to a display name.
-- Admins read the list and update each row (mark handled, or dismiss as a soft-delete), mirroring the
-- access_requests table and the deletion fields used across the schema.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references public.profiles (id) on delete set null,
  type text not null check (type in ('bug', 'feature')),
  message text not null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);

-- The admin list reads open reports newest-first; the partial index skips dismissed rows.
create index feedback_open_idx on public.feedback (created_at desc) where deleted_at is null;

-- The server writes the row; an admin reads and updates it. "Auto-expose new tables" is off, so the
-- service-role grant is explicit even though it bypasses RLS.
grant select, update on public.feedback to authenticated;
grant select, insert, update, delete on public.feedback to service_role;

alter table public.feedback enable row level security;

-- Only an admin may read or update a report. There is no insert or delete grant for authenticated, and no
-- policy for either, so a client can never write a report directly — only the Edge Function's secret key,
-- which bypasses RLS, inserts.
create policy feedback_select on public.feedback for select to authenticated using (public.is_admin());

create policy feedback_update on public.feedback for update to authenticated
using (public.is_admin())
with check (public.is_admin());

notify pgrst, 'reload schema';
