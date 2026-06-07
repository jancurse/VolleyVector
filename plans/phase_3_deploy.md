# Phase 3: Deploy and Operate (Cloudflare Pages)

## Implementation Agent Instructions

- **Role**: A release engineer setting up static-site deployment and production operations for a React + TypeScript + Vite SPA on Cloudflare Pages, treating the deploy pipeline and production configuration as the operational boundary.
- **Task**: Deploy the front end from GitHub to Cloudflare Pages on `volleycoach.pages.dev`, wire its production Supabase configuration, and verify the full production flow end to end including share links and server-side access control.
- **Quality bar**:
    - Read @CLAUDE.md and @docs/style_guide.md and follow them to the letter. Make minimal changes and keep the code clean and easy to maintain.
    - **Do not self-provision the host.** The Cloudflare account, the Pages project, and any custom domain are the user's to create in Stage 0. Hand them the exact ordered steps and wait for confirmation and any values before doing anything that depends on the host.
    - **Consume Phase 2's outputs as they are; do not guess them.** Production env var names, the URL routes share links and guards use, and the Supabase auth configuration are all defined by Phase 2. Confirm them against the merged Phase 2 code rather than inventing names or shapes.
    - **Do not duplicate the keep-alive Action.** It is Phase 2's deliverable. Phase 3 only confirms it covers the production project.
    - **Respect the gating.** Stages or steps marked as gated on Phase 2 must not run until Phase 2 is merged to `main`. Do not stub or fake a backend to make progress.
    - Where this plan leaves an implementation choice open, default to modern, simple, secure-by-default practice and record what you chose in Implementation Notes.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @plans/project_overview.md
    - @docs/architecture.md
    - The Phase 2 plan (currently at @plans/temp_phase_2.md) for the backend, auth, routing, and env interface Phase 3 builds on
    - @.github/workflows/ci.yml and @vite.config.ts
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in this file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.` Do not implement follow-ups unless explicitly asked.

## Plan

### Context

Phase 3 is the "Deploy and operate" phase from @plans/project_overview.md: deploy the static front end from GitHub to a host, verify the full flow on a real device including a share link, and do a final pass auditing that access control holds server-side. The host is **Cloudflare Pages**, starting on the free `volleycoach.pages.dev` subdomain.

### Decisions

- **Host: Cloudflare Pages.** Chosen for its generous free tier and unified registrar + DNS + hosting + SSL, which suit a free-tier project meant to run without ongoing cost or attention.
- **URL: `volleycoach.pages.dev` to start.** No custom domain in this phase. A custom domain can be attached later without redoing the deploy; that work and its Supabase redirect-list update are a follow-up.
- **Build and deploy: GitHub Actions + Wrangler, gated on CI.** A GitHub Actions workflow builds and publishes to Cloudflare Pages (Direct Upload) via Wrangler, running only after the CI checks pass, so only green commits reach production. Cloudflare's native Git build integration is not used.
- **First deploy targets the post-Phase-2 app.** The deploy workflow is built in Stage 1, but its first live run happens after Phase 2 is merged to `main`. There is no interim deploy of the Phase 1 localStorage build.
- **CI on PRs, live deploys from `main` only.** CI runs on pull requests against `main` and stays the gate. The deploy workflow publishes live only from `main`. There are no automatic preview deployments; a preview can be run on demand by hand (Wrangler, or a manually triggered workflow) when a branch needs a live URL.
- **Production env: GitHub Actions repository variables.** The production build must read the Supabase project URL and anon key from GitHub Actions repository variables (reusing Phase 2's `VITE_*` names), not from committed files. Setting those variables is a required user action (Stage 0); until it is done the build has no Supabase config. Both values are public by design (RLS is the guard); the service-role key is never part of the client build. Keeping them as build-time CI config rather than committed keeps environment configuration out of the source and lets a separate production Supabase project be introduced later without a code change. This is separate from Phase 2's git-ignored local `.env`, which never reaches the CI build.
- **No server-side branch protection.** Branch protection and rulesets are unavailable on the free private repo, so direct pushes to `main` cannot be blocked server-side. The deploy-on-green-CI gate is the production safeguard. Enabling branch protection is a follow-up for when the repo is made public.
- **Keep-alive ownership.** The scheduled GitHub Action that keeps Supabase warm is Phase 2's. Phase 3 does not add its own; it only confirms the existing one covers production.

### Dependency on Phase 2

Phase 3 planning and the user-performed host setup are independent of Phase 2. Several build and verification steps consume Phase 2's output and are gated on it being merged to `main`.

- **Independent of Phase 2** (can proceed now): the Cloudflare account and Pages project (Stage 0), setting the Supabase URL and anon key as repository variables (the values and `VITE_*` names are already in hand from Phase 2's `.env.local`), the build configuration (`npm run build` → `dist`, Node 22), and the SPA fallback rule. These can be validated against the current `main` build.
- **Gated on Phase 2 merged to `main`**: a working production deploy that actually uses those variables (the Phase 2 client code that reads them must be on the deployed branch), adding the production URL to Supabase's auth redirect allow-list, the full-flow phone verification (login, share link, guards are Phase 2 surfaces), and the RLS audit (RLS is Phase 2's deliverable).

### Stages

- **Stage 0 — Host and CI setup (user gate, independent of Phase 2).**
    - A setup gate the user performs, and the agent's first action. The agent presents a precise ordered checklist, then waits. It does not create the account, project, or token, or set any secret or variable itself.
    - The user, in their own Cloudflare account: create the account, create a Pages project (Direct Upload) whose name yields `volleycoach.pages.dev`, and create a scoped API token with Pages edit permission.
    - The user adds the Cloudflare API token and account ID as GitHub Actions secrets so the deploy workflow can publish.
    - The user sets the Supabase project URL and anon key as GitHub Actions repository variables, using the exact `VITE_*` names from Phase 2's `.env.local`. The values are already in hand, so this does not wait for Phase 2 to merge.
- **Stage 1 — Production pipeline and front-end deploy.**
    - The SPA fallback so deep links resolve to `index.html` (specified now; fully validated once Phase 2's routes exist).
    - A GitHub Actions deploy workflow that runs after CI passes and publishes the build to `volleycoach.pages.dev` via Wrangler.
    - The deploy workflow references the Supabase repository variables (set by the user in Stage 0) so they are injected into the build.
- **Stage 2 — Production verification and operations.**
    - Add the production URL to Supabase's auth redirect/site-URL allow-list (user step, gated on Phase 2).
    - The production verification walkthrough, on desktop then phone (see the Production verification section).
    - The final RLS audit (see the RLS audit section).
    - Confirm Phase 2's keep-alive Action covers the production project.

### Production verification

A manual walkthrough the user runs against the live deployment before Phase 3 is considered done. The full flow runs on desktop first, then a phone pass covers what is device-dependent. RLS and route-guard behavior is enforced server-side and identical on any device, so it is verified once on desktop and need not be repeated rigorously on the phone.

- **Desktop — full flow.**
    - The app loads at `volleycoach.pages.dev` over HTTPS.
    - Login works, and an unauthenticated visitor is sent to the login screen (route guards hold).
    - Authoring works: a board renders, a sequence plays back, and a marker can be dragged and edited.
    - A share link opens exactly one board read-only, with no library or edit controls.
    - The access-control spot-check from the RLS audit: a player cannot write a team board, and an unshared personal board is invisible to another account.
- **Phone — device-dependent pass.**
    - The app loads at `volleycoach.pages.dev`.
    - Layout and the court render correctly, the SVG stays crisp, and a sequence plays back smoothly.
    - A share or deep link opens directly (SPA fallback) into the read-only viewer.
    - Authoring gets a touch sanity check rather than exhaustive coverage, since the editor is desktop-first.

### RLS audit

Phase 3 does not re-derive the access-control policies or rewrite their tests; Phase 2 owns those and proves them at the database level. The audit confirms those proven policies reached production and hold through the deployed app, with three checks:

1. **Production parity (read-only).** Confirm the production Supabase project has all of Phase 2's migrations applied, so production is not silently missing a policy the tested database has. This reads state only and changes no data.
2. **Behavioral RLS suite.** First check whether Phase 2 shipped reusable, parameterizable database-level RLS tests covering team isolation, player read-only, unshared-personal privacy, the author lock, and per-space enforcement. If they exist, run them against a fresh project provisioned from the same migrations, never the live production database, since the tests write and delete and would pollute real data. If they do not exist, create them as part of this audit.
3. **Live access-control spot-check.** Through the deployed app: confirm read-only is enforced for players and link visitors at the server, not merely hidden in the UI, and that a share link resolves exactly one board and exposes nothing else. This is part of the production verification walkthrough.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Phase 3 is mostly configuration and operations, so most verification is the Stage 2 checklist and the RLS audit rather than new unit tests. Use the `react-testing` skill for any frontend tests.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- The app is reachable at `volleycoach.pages.dev` and serves the current front end over HTTPS.
- A deep link (e.g. a share link) loads directly rather than 404ing, confirming the SPA fallback.
- The production build reads its Supabase configuration from GitHub Actions repository variables, not hard-coded values.
- The full flow works on desktop, and a phone pass confirms the court renders crisply, playback is smooth, and a share link opens read-only.
- The final RLS audit confirms read-only access, team isolation, and per-item sharing hold against the live project.
- Phase 2's keep-alive Action keeps the production project from pausing.

## Follow-ups

- [ ] Attach a custom domain to the Cloudflare Pages project and add it to Supabase's auth redirect allow-list, replacing the `volleycoach.pages.dev` default.
- [ ] Enable branch protection on `main` requiring the CI checks to pass, once the repo is made public or on a paid plan, to block direct pushes server-side.

## Implementation Notes

_In progress. Stage 0 is complete and the Phase-2-independent Stage 1 artifacts are built; the gated parts wait on Phase 2 merging to `main`._

### Status

- **Stage 0 — complete (user-performed).** The Cloudflare Pages project `volleycoach` was created via Direct Upload and is live at `volleycoach.pages.dev` (placeholder content). The GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and the repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, are all set.
- **Stage 1 — built, not yet active.** `public/_redirects` and `.github/workflows/deploy.yml` exist in the working tree, uncommitted and not yet on `main`. The deploy workflow only fires once it is on `main`, so no live deploy has happened.
- **Gated on Phase 2 merged to `main`.** The first live deploy, the Supabase auth redirect allow-list update, the desktop and phone verification walkthroughs, and the RLS audit.

### Decisions made

- **SPA fallback.** `public/_redirects` with `/*  /index.html  200`. Vite copies it to `dist/_redirects`, confirmed in a local `npm run build`.
- **Deploy trigger and gating.** `.github/workflows/deploy.yml` runs on `workflow_run` after the `CI` workflow completes successfully on `main` (guarded by `conclusion == 'success'`), plus `workflow_dispatch` for on-demand runs. It checks out `workflow_run.head_sha` so it deploys the exact commit CI passed.
- **Publish mechanism.** `cloudflare/wrangler-action@v3` running `pages deploy dist --project-name=volleycoach --branch=main`. Wrangler is intentionally not added to `package.json`; the deploy-only tooling lives in the action.
- **Production branch.** Direct Upload Pages projects do not expose a production-branch setting in the dashboard, so it could not be configured during setup. The workflow passes `--branch=main`; whether that produces a production deploy rather than a preview depends on the project's actual production branch, which must be verified before the first live deploy (see Critical Issues).
- **Env injection.** The build reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from GitHub Actions **repository variables** (`vars.*`), per the plan's decision; the Cloudflare API token and account ID come from **secrets**. The two `VITE_*` names were taken from Phase 2's git-ignored `.env`.

### Critical Issues

Two open items, both to resolve before the first live deploy:

- **`VITE_*` names unconfirmed against merged Phase 2.** They were taken from Phase 2's unmerged `.env`. Re-confirm them against the merged Phase 2 code before deploying.
- **Production branch unverified for the Direct Upload project.** Its production branch is not configurable in the dashboard. Confirm what it is (via the Cloudflare API or `wrangler pages deployment list`) and ensure the workflow's `--branch=main` targets production, adjusting the flag if the project's production branch differs, so the first deploy publishes to `volleycoach.pages.dev` rather than a preview URL.
