---
name: supabase
description: Read before ANY Supabase work: reading or debugging production (read-only MCP), local database development (CLI), migrations, and Edge Functions. Covers the read/local/CI split, the local-first workflow, how changes reach production, and known failure modes.
---

# Working with Supabase

## The setup

- The backend is one Supabase project: VolleyCoach, project ref `xobsdirytehneeofjmrq`. It holds the schema (tables, RLS policies, triggers, RPCs), the auth users, and the Edge Functions. Every access rule is row-level security in the database. The client is never trusted.
- This is a small hobby project on the **free tier**, and that one project **is production**. There is no dev or staging instance. The only non-production environment is the **local Supabase stack** run by `npm run dev` (Docker-based, see @docs/development.md).
- Three access paths, split by job:
    - **Read production** through the **read-only Supabase MCP server**: schema, SELECTs, RLS debugging, logs. It cannot write.
    - **Develop locally** through the **Supabase CLI** (`npx supabase ...`): the local stack, authoring and verifying migrations, running the RLS test. The CLI is local-only. It never touches production.
    - **Write production** only through **CI on merge**: a deliberate, green-`main`-gated push. Migrations and Edge Functions both reach prod this way (below), never from a dev session.

Two hard rules frame everything below:

- **Never write to production from your machine.** No `db push`, no `functions deploy`, no `supabase link`/`login`. These are denied. Production changes land by merging a PR, and CI applies them.
- **Schema changes (DDL) are reviewed migration files, never SQL pasted into the dashboard.** Reads are yours to run via MCP. Never ask the user to paste query results back to you.

For a **simple data fix** (plain DML, like deleting a few rows), ask the user whether they want a one-off migration or an ad-hoc query. For an ad-hoc query, hand them the exact statement for the dashboard SQL editor, then verify the result with an MCP read. The MCP server stays read-only: never suggest enabling writes on it.

## Reading the database

- Use the **read-only MCP server** for all production reads: inspect schema, run SELECTs, debug RLS, read logs. It cannot write.
- For local reads, query the local stack directly (its URL and key are in @docs/development.md) or `docker exec supabase_db_volleycoach psql ...`.
- **If the MCP server is unavailable, stop and tell the user.** Do not work around it: no PostgREST probe, no linked CLI, no asking them to paste query results back. They will set MCP up for you or give you other instructions.

## Local development

The local stack is where database changes are built and verified. The dev modes and seeded accounts live in @docs/development.md. In short:

- `npm run dev` runs the app against the shared local stack (main's schema), starting it if it is down. It does not create the stack: if there is no shared database yet, create it from `main` with `npm run db:reset`.
- `npm run dev:migrate` runs it against a throwaway database built from the current branch's migrations. Use it to try a migration before it merges.
- `npm run test:rls` runs the RLS regression test against a local database. It is the same check CI runs.

These commands manage the stack for you. The plain local CLI commands (`supabase start`/`stop`/`status`, `migration new`, `db diff`, `gen`) are allowed. You rarely need to run them by hand.

## Migrations

Migrations are reviewed files in `supabase/migrations/`. They are authored and verified locally, then reach production through CI on merge. You never push them yourself.

1. **Create the file with `npx supabase migration new <name>`** so the version prefix is a real UTC timestamp. Never hand-pick "the next number": parallel sessions pick the same one and collide (see below).
2. Write the migration, then verify it locally with `npm run dev:migrate` and `npm run test:rls`.
3. Open a PR. `migration-guard.yml` flags it with a label and a comment, because merging applies it to production.
4. **On merge, `migrate-prod.yml` runs `supabase db push` against production** once CI is green. There is no manual push and no approval button: the deliberate act is merging after seeing the warning.
5. After it merges, **verify the change in the production schema** with an MCP read. Do not trust "Finished db push" or the history table alone.

Schema rules that recur:

- **Grant `service_role` in migrations, not only `authenticated`.** "Auto-expose new tables" is off, so grants are explicit. `service_role` bypasses RLS but still needs the table GRANT, or Edge Functions fail with `permission denied for table ...`.
- End schema-changing migrations with `notify pgrst, 'reload schema';` so PostgREST picks the change up immediately.

### Failure mode: duplicate version from a parallel session

Two branches that each add a migration can pick the same version number. Whichever merges first claims that version in the remote history. The second branch's same-numbered migration then **looks applied while its DDL never ran**.

- Avoid it: always use `migration new` for a real-timestamp version, never a hand-picked number.
- Detect it: after your migration merges, the schema change is missing (e.g. an MCP read returns `42703 column ... does not exist`). Compare your local files against the remote history via the MCP `list_migrations` tool.
- Fix it: rename your migration file to a new, later real-timestamp version so it applies as a fresh entry on the next push.

## Edge Functions

- Functions live in `supabase/functions/`. Edit them there. They reach production the same way migrations do: **`deploy-functions.yml` deploys them on merge** once CI is green, with `--no-verify-jwt`. Never run `functions deploy` yourself.
- A PR that changes `supabase/functions/` is flagged by `migration-guard.yml`, like a migration.
- Keep **Verify JWT off** and authorize the caller in code; functions read the secret key from the `SUPABASE_SECRET_KEYS` dict, not the legacy `SUPABASE_SERVICE_ROLE_KEY`.
- **Function secrets** (`supabase secrets set`) are user-only and rarely change. Walk the user through setting them in the dashboard or by CLI; never set them yourself.

## User-only steps

`supabase login` and `supabase link`, dashboard configuration, function-secret changes, and admin bootstrap are the user's. Production writes happen through CI on merge, never from your local CLI. Walk the user through any manual step with exact, ordered instructions and wait; never self-provision, log in, or link.
