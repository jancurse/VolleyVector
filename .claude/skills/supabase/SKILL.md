---
name: supabase
description: Read before ANY Supabase work — CLI commands, database migrations, schema changes, Edge Function deploys, or reading/debugging the database (schema, RLS, logs). Covers login and linking, the safe migration workflow, verification, and known failure modes.
---

# Working with Supabase

## The setup

- The backend is one Supabase project: VolleyCoach, project ref `xobsdirytehneeofjmrq`. It holds the schema (tables, RLS policies, triggers, RPCs), the auth users, and the Edge Functions. Every access rule is row-level security in the database; the client is never trusted.
- This is a small hobby project on the **free tier**, and that one project **is production** — there is no dev or staging instance. Whatever you touch, real users see, so be deliberate with every write.
- Two tools are available:
    - The **Supabase MCP server**, scoped read-only to the project. Use it for all reads: schema, SELECTs, RLS debugging, logs.
    - The **Supabase CLI** (`npx supabase ...`) for everything that writes: applying migrations and deploying Edge Functions.

Two hard rules frame everything below:

- Never run `db push` or `functions deploy` without the user's explicit go-ahead.
- Never ask the user to paste SQL into the dashboard or paste query results back to you. Migrations are reviewed files; reads are yours to run.

## Reading the database

- Prefer the **read-only Supabase MCP server** when it is available in the session: inspect schema, run SELECTs, debug RLS, read logs. It cannot write.
- Without MCP, read via the CLI: `npx supabase db dump --schema <schema>` (add `--data-only` for rows, e.g. of `supabase_migrations` to see the remote history with names and statements).
- A last-resort probe is PostgREST with the publishable key from `.env`. RLS applies, so expect `permission denied` for most tables as `anon`; the error code still distinguishes a missing column (`42703`) from a missing grant (`42501`), which makes it a usable schema probe.

## Login and linking

- **Login is user-only and machine-wide. Linking is per-workspace** (it writes `supabase/.temp/`), so a fresh worktree is typically not linked even though login is done.
- Check both at once with `npx supabase projects list`:
    - An auth error means not logged in. Ask the user to run `npx supabase login` themselves and wait.
    - The project list printing but with an empty LINKED column (or a "Cannot find project ref" warning) means logged in but not linked.
- Link it yourself; no password is needed: `npx supabase link --project-ref xobsdirytehneeofjmrq`

## Migrations

Migrations are reviewed files in `supabase/migrations/`, applied with the CLI.

- **Create migrations with `npx supabase migration new <name>`** so the version prefix is a real UTC timestamp. Never hand-pick "the next number in the folder": parallel sessions pick the same one and collide (see the failure mode below).
- The standard sequence, in order:
    1. `npx supabase migration list` — compare local and remote versions and investigate any mismatch before going further.
    2. `npx supabase db push --dry-run` — confirm that exactly the intended migrations (and nothing else) would apply.
    3. Get the user's explicit confirmation, then `npx supabase db push`.
    4. **Verify the change in the actual schema** (MCP query, or the PostgREST probe above). Do not trust "Finished db push" or the history table alone.
- Schema rules that recur:
    - **Grant `service_role` in migrations, not only `authenticated`.** "Auto-expose new tables" is off, so grants are explicit. `service_role` bypasses RLS but still needs the table GRANT, or Edge Functions fail with `permission denied for table ...`.
    - End schema-changing migrations with `notify pgrst, 'reload schema';` so PostgREST picks the change up immediately.

### Failure mode: duplicate version from a parallel session

Parallel worktrees that each add a migration can pick the same version number. The remote history then contains that version from whichever session pushed first, and your same-numbered migration **silently appears applied while its DDL never ran**. Recognise and fix it like this:

- Symptom: `migration list` shows your version as applied on both sides, but the schema change is missing (e.g. PostgREST returns `42703 column ... does not exist`).
- Diagnose: dump the remote history (`npx supabase db dump --schema supabase_migrations --data-only`) and read the `statements` of the colliding version. If they are not yours, you have a collision.
- Fix: rename your migration file to a new, later real-timestamp version. If `db push` then refuses because a remote version has no local file, that file belongs to the other session's branch: ask the user to provide it (do not reach into another workspace yourself), then dry-run and push again.

## Edge Functions

- Deploy with `npx supabase functions deploy <name>`, with user confirmation (production).
- Functions read the secret key from the `SUPABASE_SECRET_KEYS` dict, not the legacy `SUPABASE_SERVICE_ROLE_KEY`. Keep "Verify JWT" off and authorize the caller in code.

## User-only steps

`supabase login`, dashboard configuration, and admin bootstrap are the user's. Walk them through exact, ordered steps and wait; never self-provision or log in for them.
