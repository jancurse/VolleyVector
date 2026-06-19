# Safer DB workflow — review & test plan

## Purpose

A manual review plan for the safer-db-workflow feature. The changes are visual and functional (the dev workflow and the seeded local app), not code to self-verify, so **the user runs the checks**: the user executes the dev commands and eyeballs the app.

**The agent's job is to walk the user through this plan**, not to run it. Take it one item at a time, wait for the user's result before moving on, help read the output and troubleshoot failures, and tick items off as they pass. The agent does not run the dev commands or the app itself.

## Status

We only started the review before getting sidetracked fixing two dev-server issues, so almost everything below is still untested.

- Confirmed: `npm run dev` starts fast and runs against the local stack (not prod).
- Found and fixed this session (on worktree `24-worktree-dev-autologin`, commits `030189e`/`bb10cd8`), still to re-verify once merged:
    - `npm run dev` now announces its local Supabase target, so prod vs local is visible.
    - Auto-login is target-aware: seeded coach for the local stack, `dev.env` for `dev:prod`.

## What to review

### Dev commands

The user runs each; confirm the described behaviour.

- [ ] `npm run dev` — announces the local target, auto-logs in as the seeded coach, app loads against the local DB.
- [ ] `npm run dev:prod` — prints the PRODUCTION warning, auto-login uses the `dev.env` account.
- [ ] `npm run dev:migrate` — fresh temporary DB from the branch's migrations, auto-login works, torn down on exit with nothing left behind, no collision with a running `dev` stack.
- [ ] `npm run db:reset` — rebuilds the shared local DB from migrations and seed (run from `main`).
- [ ] `npm run db:clean` — removes a stray temporary DB, leaves the shared one intact.
- [ ] `npm run test:rls` — runs the RLS regression test and reports pass/fail.

### Seeded app content (eyeball in the browser, fresh local DB)

- [ ] Three logins work, password `password`: `admin@`, `coach@`, `player@volleycoach.test`.
- [ ] Demo Team space exists with the coach and player as members.
- [ ] Team library shows **Sample Position (Base Defence)** and **Sample Drill (Serve Receive & Sideout)**.
- [ ] **Coach's Scratch Board** is personal — visible only as the coach.
- [ ] **Team Playbook** note links the two team boards.
- [ ] Role behaviour: player read-only, coach edits team content, admin sees across spaces.

### CI & merge (verify on a real migration-bearing PR)

- [ ] A PR touching `supabase/migrations/` gets the `database-migration` label and a comment.
- [ ] The RLS job runs on every PR and fails the PR when the test fails.
- [ ] On merge to `main`, migrations push to prod only after CI passes, and never during feature work.
- [ ] Caveats to watch: the RLS job now also gates the front-end deploy, and `supabase db push` must run non-interactively in CI (unproven until the first migration PR).

## Open follow-ups (not part of testing, don't forget)

- [ ] Decide exactly what the local seed should contain (precise users, boards, note, and grants).
- [ ] Audit the Supabase CLI allow/forbid list and update the `supabase` skill (CLI vs MCP usage).
