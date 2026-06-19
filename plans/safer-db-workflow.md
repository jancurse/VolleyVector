# Safer Database Workflow

## Implementation Agent Instructions

- **Role**: Full-stack engineer fluent in Supabase local development, Postgres, GitHub Actions, and the Vite/npm toolchain.
- **Task**: Stand up a local Supabase development environment with three dev modes, move production migrations to a deliberate CI-gated push on merge, and run the existing RLS regression test in CI on every PR.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Load the `supabase` skill before any Supabase work. The project is production: never push or deploy to prod without the user's confirmation.
    - Keep the local stack lean — enable only the services the app actually needs locally — so several can run at once without exhausting the machine.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/development.md
    - @docs/architecture.md (the Backend and access control, and Deployment and operations sections)
    - @supabase/seed.sql, @supabase/tests/rls_policies_test.sql, and the migrations under `supabase/migrations/`
    - @.github/workflows/ci.yml and @.github/workflows/deploy.yml
    - @vite.config.ts, @src/supabase/client.ts, @.env, and the `scripts` block of @package.json
    - The `supabase` skill.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`.

## Plan

### Goals

- Develop and verify database changes against a non-production database before they reach prod.
- Run the existing RLS/migration regression test automatically on every PR, so a policy regression fails a PR instead of reaching prod.
- End the mid-feature, straight-to-prod migration path. Production is touched only by a deliberate, CI-gated push when a change merges.
- Keep the everyday developer experience to a single command per check.

### Non-goals

- A second hosted "dev" Supabase project. The local stack is the only non-prod environment for now.
- Expanding RLS test coverage beyond the existing test. Coverage grows over time, not here.
- Any change to the frontend deploy pipeline.

### Part 1 — Local Supabase stack

- Initialize the local-stack configuration (the `supabase/` project config) so `supabase start` works, building the database from the existing migrations and seed.
- The local stack is the non-prod environment: free, disposable, Docker-based.

### Dev modes (npm scripts)

- `npm run dev`: ensure the shared local database is running (start it if it is not — the start must be idempotent and fast when already up), then run Vite against it. Targets the shared local database, which holds main's schema. The developer manages no database lifecycle.
- `npm run dev:prod`: run Vite against the production database.
- `npm run dev:migrate`: spin up a fresh, isolated temporary database built from the current branch's migrations, run Vite against it, and tear that database down when the process exits. Fully programmatic — the developer runs one command and manages nothing. It must use its own ports/identifier so it never collides with the shared database or with another temporary database.
- `npm run db:clean`: tear down any leftover temporary databases (identified by a temp-name convention), leaving the shared database untouched. Needed only when a `dev:migrate` run crashed before its own cleanup ran.

Requirements and constraints:

- `npm run dev` must default to the local stack with no per-developer configuration. The local URL and the standard local development key (which are not secrets) are the defaults.
- The production build and deploy path is unchanged: prod reads its URL and key from GitHub Actions variables.
- `supabase start` does not change an existing database's schema (migrations apply only when the database is first created), so running `npm run dev` from any branch leaves the shared database at main's schema.
- Choosing `dev` vs `dev:migrate` is the whole rule a developer needs: `dev` runs against main's schema, `dev:migrate` runs against the current branch's schema. There is no further rule to learn.

### Shared local database lifecycle

- Created from main and held at main's schema.
- Refreshed from main manually — a reset that rebuilds it from migrations and seed — when production is updated. This is occasional maintenance, not a per-check step. Provide a documented command for it.

### Seed (local-only fixtures)

- The seed never reaches production: a prod migration push applies migrations only, never the seed. Rely on this.
- Extend the seed so every local database comes up immediately usable:
    - Three accounts — admin, coach, and player — each with a known development password that actually logs in.
    - A team with the coach and player as members.
    - A few boards with appropriate access grants.
    - One topic (note).
- Verify that nothing production still relies on lives only in the seed. Anything production needs belongs in a migration, not the seed.
- The exact seed contents are confirmed in the seed follow-up; treat the list above as the minimum.

### Part 2 — RLS regression test in CI

- Reuse the existing `supabase/tests/rls_policies_test.sql`, adapting only as needed to run it non-interactively against a freshly built local database.
- `npm run test:rls`: one local command that brings up a local database, applies migrations (and the seed where the test needs it), runs the SQL test, and reports pass or fail. It is the same thing CI runs, so a local pass means a CI pass.
- Keep this out of `npm run test`. The Vitest suite stays fast, Docker-free, and runs against the in-memory fake.
- Add a separate, Docker-enabled CI job that runs the RLS test on every PR (and on pushes to main), gating merges alongside the existing checks.

### Production migration pipeline

- Stop applying migrations to production during feature work.
- **PR-time warning**: a CI check detects when a PR adds or changes files under `supabase/migrations/` and surfaces it prominently (a label and a comment) so the migration is reviewed before merge.
- **Automatic push on merge**: a GitHub Action applies migrations to production after CI passes on main, mirroring the existing deploy pipeline's green-main gating. There is no manual approval button; the deliberate act is merging after seeing the warning.
- This requires the production database credential (access token or database password) stored as a GitHub secret.
- The native click-to-approve gate (GitHub Environments required reviewers) is not used, as it is unavailable on a private free repo. The PR warning plus the deliberate merge is the gate.

### Documentation

- Update `docs/development.md`:
    - The three dev modes and `db:clean`: what each targets, that `npm run dev` brings the local database up itself, and that the local stack needs Docker.
    - How to refresh the shared local database from main.
    - `npm run test:rls` and `npm run db:clean`.
- Update the deployment documentation (the deployment section of `docs/development.md` and the Deployment and operations section of `docs/architecture.md`): migrations now reach production via the CI-gated push on merge, never during feature work, and a PR that changes migrations is flagged.
- Update any remaining description of the database/migration workflow that still implies straight-to-prod (notably the Backend section of `docs/architecture.md`) to match the new flow.
- Keep the prose concise; it will grow somewhat to cover the added workflow.

### Testing

Add or update unit tests only as the changes require — this work is mostly tooling and CI rather than application code. The RLS test is the database-level regression test, run via `npm run test:rls` and the new CI job.

### Acceptance Criteria

- `npm run dev` brings up the local database if needed and runs the app against it, from any branch, with no extra commands and no per-developer configuration.
- `npm run dev:prod` runs against production; `npm run dev:migrate` runs against a fresh temporary database built from the branch's migrations and tears it down on exit; `npm run db:clean` removes stray temporary databases and leaves the shared one.
- A fresh local database comes up seeded with the three logins and sample content, and you can sign in as each.
- `npm run test:rls` runs the existing RLS test against a local database and reports pass or fail.
- A dedicated CI job runs the RLS test on every PR and fails the PR when the test fails.
- A PR that changes `supabase/migrations/` is flagged automatically with a label and a comment.
- On merge to main, migrations are applied to production automatically only after CI passes, and no migration is applied to production during feature work.
- The documentation reflects the local database workflow and the new production migration pipeline.
- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).

## Follow-ups

- Decide exactly what the local seed should contain.
    - Confirm the precise set of users, boards, and the topic, plus their access grants, so a seeded local database mirrors a realistic space rather than the bare minimum.
- Review the Supabase command allow/forbid list and the `supabase` skill.
    - Audit which Supabase CLI commands belong on the allow list versus the forbid list now that local development and migrations run locally.
    - Decide when to use the Supabase CLI versus the MCP server, and whether both are still needed.
    - Update the `supabase` skill to match those decisions.

## Implementation Notes

### Part 1 — Local stack

- `supabase/config.toml` is new and lean: only `db`, `api`, `auth`, and `studio` are enabled; `realtime`, `storage`, `edge_runtime`, `inbucket`, and `analytics` are off, so several stacks fit on one machine.
- `project_id = "volleycoach"` is fixed (not the working-directory default), so every branch and worktree shares one stack held at main's schema. The shared containers are named `supabase_<service>_volleycoach`.
- `major_version = 17` matches production. Confirmed by `supabase link`, which syncs the remote version into the config and left it at 17.
- This CLI version (2.105.0) emits the **new API key format** for the local stack, not the legacy anon JWT. The local publishable key `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` is a shared CLI default (identical on every machine, not a secret) and maps directly onto the client's `VITE_SUPABASE_PUBLISHABLE_KEY`. It is hardcoded in `scripts/lib.sh`.
- Env injection: `npm run dev`/`dev:migrate` set `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` on `process.env`, which Vite prioritizes over the committed `.env`. `dev:prod` and the production build read the committed `.env` unchanged, so the deploy path is untouched.

### Seed

- The old `seed.sql` targeted the dropped pre-access-model columns (`owner`, `scope`, `team_id`, `topic_id` on boards/topics) and would have failed against the current schema. It was rewritten for the access-list model: `created_by` plus `board_access`/`topic_access` grants.
- It creates three sign-in accounts (`admin`/`coach`/`player`@volleycoach.test, password `password`) via `auth.users` + `auth.identities` inserts with bcrypt, a "Demo Team" with the coach and player as members, two team boards and one personal board with grants, and one team note linking the team boards.
- **Seed-vs-production check:** nothing production relies on lives only in the seed. The one shared fixture production needs, the Inspiration showcase team, is created by a migration (`20260610212308_showcase_team.sql`), not the seed.

### Dev modes and scripts

- `scripts/` holds the orchestration (`lib.sh` shared constants/helpers, `dev.sh`, `dev-migrate.sh`, `db-clean.sh`, `test-rls.sh`); `package.json` wires `dev`, `dev:prod`, `dev:migrate`, `db:clean`, `db:reset`, `test:rls`.
- `dev` brings the shared stack up only if down (`supabase status` is the gate, ~0.5s when up). `dev:migrate` builds a throwaway stack with `supabase --workdir` over a generated config: it probes free ports, uses project id `volleycoach_mig_<apiport>` (so it never collides with the shared stack or another `dev:migrate`), symlinks the real migrations and seed, and tears down on exit via a trap. `db:clean` removes only Docker objects matching the `volleycoach_mig_` prefix.

### Part 2 — RLS test and CI

- `test:rls` runs `supabase/tests/rls_policies_test.sql` via `docker exec supabase_db_volleycoach psql` (no host `psql` needed). The test is transactional (`begin`/`rollback`), so it is non-destructive, and it needs no seed: the showcase team it depends on comes from a migration.
- `ci.yml` gains an `rls` job (Docker, runs on every PR and push to main). `migration-guard.yml` flags a PR that changes `supabase/migrations/` with a `database-migration` label and one comment. `migrate-prod.yml` runs `supabase db push` on green-`main` CI (`workflow_run`), mirroring `deploy.yml`; `deploy.yml` is unchanged (a non-goal).
- Two operational notes: this PR adds no migration, so `migration-guard` and `migrate-prod` do nothing on it; both are first exercised by a future migration-bearing PR (confirm there that `supabase db push` does not block on an interactive prompt in CI). And because `deploy.yml` triggers on the whole CI workflow, the new `rls` job now also gates the front-end deploy.

### Verification performed

- Fresh `supabase start` applied migrations + seed cleanly; all three accounts return HTTP 200 from the local auth endpoint; all seeded rows present with minted share tokens.
- `npm run test:rls` passes (`ALL RLS TESTS PASSED`).
- `dev:migrate` end-to-end: an isolated temp stack came up on free ports, admin login returned HTTP 200 (proving migrations + seed applied in isolation), and `stop --no-backup` tore it down; nothing left behind.
- `db:clean` removed stray `volleycoach_mig_*` container/volume/network while leaving `supabase_db_volleycoach` intact.
- `typecheck`, `lint`, `format:check`, `test` (516 passing), and `build` all pass.

### Permissions note

- During this task the user directed a rework of the Supabase rules in `.claude/settings.json`: prod mutations on `deny` (`db push`, `db reset --linked`, `migration up --linked`, `migration repair`, `functions deploy`, `secrets set/unset`), always-safe local commands on `allow` (`start`, `stop`, `status`, `migration new`, `migration up`, `db diff`, `gen`), no Supabase commands on `ask`, everything else unlisted for the permission mode to classify. The broader audit and skill update remain a follow-up.

### Critical Issues

- None.
