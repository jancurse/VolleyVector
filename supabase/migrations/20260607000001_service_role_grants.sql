-- VolleyCoach — service_role grants.
--
-- The Data API has "automatically expose new tables" off, so the init migration granted table
-- privileges deliberately, and only to `authenticated`. That left `service_role` — the role the invite
-- Edge Function acts as through its secret key — with no privileges on these tables, so its reads
-- failed with "permission denied for table profiles". service_role bypasses RLS but still needs the
-- underlying grant to touch a table at all, so we grant it full access to the app tables here. This is
-- the trusted server role; RLS does not constrain it, matching what the admin god-mode policies assume.

grant usage on schema public to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.teams to service_role;
grant select, insert, update, delete on public.memberships to service_role;
grant select, insert, update, delete on public.boards to service_role;
grant select, insert, update, delete on public.topics to service_role;
