# Developer guide

## Tooling

| Tool                    | Purpose                             | Config                                      |
|-------------------------|-------------------------------------|---------------------------------------------|
| Prettier                | Formatting at 120-char width        | `package.json`                              |
| ESLint                  | Linting                             | `eslint.config.js`                          |
| TypeScript              | Type checking (`npm run typecheck`) | `tsconfig.json`                             |
| Vitest                  | Testing with React Testing Library  | `vite.config.ts`, setup in `tests/setup.ts` |
| markdownlint-cli2       | Markdown lint + auto-fix            | `.markdownlint.yaml`                        |
| markdown-table-prettify | Markdown table alignment            | —                                           |

- These tools run automatically in three places: on editor save (markdownlint via the VSCode extension), on Claude Code write (the PostToolUse hook), and on commit (the pre-commit hook). You do not run them by hand.
- These two CLIs are npm-global, not project dependencies, so the hooks work in a fresh worktree before `npm install`. Consider moving them to local `devDependencies` if the global tooling becomes a friction point.

## Initial Setup

- We use Node (the runtime) and nvm (its version manager):
    - Install Node (currently 24, pinned in `.nvmrc`) from [nodejs.org](https://nodejs.org).
    - Recommended: have nvm switch to the pinned version automatically in this project, e.g. with its [auto-switch hook](https://github.com/nvm-sh/nvm#deeper-shell-integration) in `~/.bashrc` on Ubuntu.
- Install **Docker** (Docker Engine on Linux, Docker Desktop on macOS/Windows). The local Supabase stack runs in it, and its daemon must be running. On Linux it auto-starts on boot.
- Run `npm install` to install dependencies, including the Supabase CLI (run as `npx supabase`). This also generates `package-lock.json`, which is committed and used by CI.
- Create the shared local database from `main`: `npm run db:reset`. It builds the stack from the migrations and seed (the first run downloads Docker images). After this, `npm run dev` just starts it.
- Install the recommended VSCode extensions: Prettier, ESLint, and markdownlint.
- Install the markdown formatting CLIs once per machine: `npm i -g markdownlint-cli2 markdown-table-prettify`.
- Install `pre-commit` and run `pre-commit install` to enable the markdown commit hooks.
- **Dev sign-in.** The dev server auto-logs-in as a default account so it comes up past the login screen, and the gate (reached by signing out) shows a quick-sign-in button per configured account to switch between them. Which accounts are offered follows the database it targets:
    - Against the local stack (`npm run dev` and `npm run dev:migrate`) it offers the three seeded accounts (Coach, Player, Admin), auto-logging-in as the coach, with no setup.
    - Against production (`npm run dev:prod`) it reads accounts from `~/.config/volleyvector/dev.env`, if present, auto-logging-in as the first. Each account is a labelled email/password pair; the unlabelled legacy pair reads as "Dev Coach":

        ```sh
        VITE_DEV_EMAIL=coach@example.com
        VITE_DEV_PASSWORD=your-password
        VITE_DEV_PLAYER_EMAIL=player@example.com
        VITE_DEV_PLAYER_PASSWORD=your-password
        ```

        Use personal, low-privilege production accounts, never an admin. The file is read only in `serve`, so it never reaches production, and it stays out of the repo. Anyone with the file can sign in as those accounts, so keep them low-privilege.
- **Claude Code**: the repo enables tools that load automatically once you trust the project. Some need a binary installed once per machine:
    - `typescript-lsp` — TypeScript code intelligence. Needs the language server: `npm i -g typescript-language-server typescript` (global; reinstall after switching Node versions).
    - `playwright` — browser automation. Needs a browser: `npx playwright install chromium`.
    - `frontend-design` — frontend design guidance. No binary needed.

## Development

### Local database

For development we run Supabase locally instead of against production. It runs in Docker and is built from `supabase/config.toml`, the migrations in `supabase/migrations/`, and the `supabase/seed.sql` fixtures. It enables only Postgres, auth, the REST API, and Studio.

One database is shared and built from the latest `main` branch, and `npm run dev` uses it by default. You can also spin up as many temporary databases as you need, for example to try a branch's migrations before they merge (see [Dev modes](#dev-modes)).

#### Create and maintain

`npm run db:reset` builds the shared database from the current checkout's migrations and seed. Run it on the latest `main` to create it the first time, and again whenever new migrations merge.

#### Seeded accounts

A fresh local database comes up with three sign-in accounts (password for all three: `password`):

| Email                      | Role                                  |
|----------------------------|---------------------------------------|
| `admin@volleyvector.test`  | global admin (god-mode across spaces) |
| `coach@volleyvector.test`  | coach of the demo team                |
| `player@volleyvector.test` | player on the demo team (read-only)   |

It also seeds a Demo Team (coach and player). The coach owns two sample boards (in their own space and the team library), a note linking them, and a personal scratch board; the admin owns a 5-1 rotation board and a Rotations note in the Inspiration showcase, which every account can browse and copy. The seed is local-only fixtures: a production migration push applies migrations only, never the seed.

### Dev modes

`npm run dev` starts the Vite dev server at <http://localhost:5173> with hot reloading. The modes differ only in which database they target:

- **`npm run dev`**: the shared local database (main's schema), starting the stack if it is down. The everyday mode. It errors if the shared database has never been created. Run `npm run db:reset` from `main` first.
- **`npm run dev:prod`**: the production database (the committed `.env` values). Use sparingly, to reproduce something against real data.
- **`npm run dev:migrate`**: a fresh, isolated, temporary database built from the current branch's migrations, torn down on exit. Use it to try a migration before it merges. It picks its own ports and id, so it never collides with the shared stack or another `dev:migrate`.
- **`npm run db:clean`**: tear down a leftover temporary database (a `dev:migrate` that crashed before cleanup). Never touches the shared database.

`dev` runs against main's schema, `dev:migrate` against the current branch's. That is the whole rule.

### Previewing board-creator drafts

The board-creator skill writes bundle JSON to the gitignored `drafts/` folder. The dev-only `#/preview` route renders those files for the iterate loop:

- **Draft preview…** in the library page-bar menu (or the hash itself) opens it; it hot-reloads as the skill rewrites a draft.
- Cards open the normal board view and editor.
- **Save & copy JSON** keeps the edit on the page (in memory only) and copies the bundle to paste back to the skill.
- **Import** creates what is on screen into the active space.
- None of it ships: the route is `import.meta.env.DEV`-gated.

### Testing

- `npm run test` runs the Vitest suite once. It is fast and Docker-free: it runs against an in-memory Supabase fake, and CI runs it on every PR.
- `npm run test:rls` runs the row-level-security regression test (`supabase/tests/rls_policies_test.sql`). It builds a fresh, isolated database from the current branch's migrations and seed (the `dev:migrate` stack), runs the SQL test inside it, tears it down, and reports pass or fail. Building from the branch (not the shared stack, which holds main's schema) is the point: it verifies this branch's policies, functions, and migrations before they merge. It needs Docker and is deliberately kept out of `npm run test` so the Vitest suite stays fast. It is the same check CI runs, so a local pass means a CI pass.

### Deployment and the database pipeline

The front end and the database reach production by two separate, CI-gated paths. Both wait for CI to pass on `main`, so nothing reaches production from feature work.

#### Front end

The app deploys to the Cloudflare Pages project `volleyvector`, served at <https://volleyvector.app>; the old <https://volleycoach.pages.dev> 301-redirects to it. `.github/workflows/deploy.yml` publishes automatically once CI passes on `main`, so there is no manual deploy step, and production config lives in GitHub Actions variables and secrets rather than the repo.

#### Database migrations

Migrations never reach production during feature work. A deliberate, CI-gated push applies them when a change merges:

- **A PR that changes `supabase/migrations/` is flagged.** `.github/workflows/migration-guard.yml` adds a `database-migration` label and posts a comment, so the migration is reviewed before merge.
- **On merge, migrations are pushed to production automatically.** `.github/workflows/migrate-prod.yml` runs `supabase db push` after CI passes on `main`, mirroring the deploy pipeline's green-main gating. There is no manual approval button: the deliberate act is merging after seeing the warning. (GitHub Environments required reviewers, the native click-to-approve gate, are unavailable on a private free repo.)

The push needs the production credentials as repository **secrets**, set once under Settings → Secrets and variables → Actions:

- `SUPABASE_ACCESS_TOKEN`: a Supabase access token (Account → Access Tokens), which authenticates the CLI.
- `SUPABASE_DB_PASSWORD`: the production database password, which authorizes the push.

The project ref is public and hardcoded in the workflow. A manual `workflow_dispatch` run pushes the default branch on demand.

#### Edge Functions

Edge Functions deploy to production by the same green-`main` gate as migrations, never from a dev session:

- **A PR that changes `supabase/functions/` is flagged** by `.github/workflows/migration-guard.yml`, the same guard that flags migrations.
- **On merge, all functions are deployed automatically.** `.github/workflows/deploy-functions.yml` runs `supabase functions deploy --no-verify-jwt` for every function after CI passes on `main`, like the migration push. It deploys all of them rather than diffing the merged commit, which would miss a function change made in an earlier commit of a rebase-merged PR; re-uploading an unchanged function is a harmless no-op. It authenticates with the `SUPABASE_ACCESS_TOKEN` secret alone; a function deploy needs no database password.
- **Function secrets are a manual, user-only step.** They change rarely: set them in the dashboard or via `supabase secrets set` by hand, never in CI.

### Useful Commands

| Command                     | Description                                                                           |
|-----------------------------|---------------------------------------------------------------------------------------|
| `npm run dev`               | Start Vite against the local database (port 5173), bringing it up if needed           |
| `npm run dev:prod`          | Start Vite against the production database                                            |
| `npm run dev:migrate`       | Start Vite against a temporary database built from the branch's migrations            |
| `npm run build`             | Type-check and build for production                                                   |
| `npm run preview`           | Preview the production build locally                                                  |
| `npm run generate:showcase` | Regenerate the README's dark landing-showcase GIF (needs a running dev server)        |
| `npm run db:reset`          | Create or rebuild the shared local database from migrations and seed (from `main`)    |
| `npm run db:clean`          | Tear down leftover temporary `dev:migrate` databases                                  |
| `npm run format`            | Format `src`/`tests` with Prettier                                                    |
| `npm run format:check`      | Check formatting without writing                                                      |
| `npm run lint`              | Lint `src`/`tests` with ESLint                                                        |
| `npm run lint:fix`          | Lint and auto-fix                                                                     |
| `npm run typecheck`         | Type-check without emitting (`tsc --noEmit`)                                          |
| `npm run test`              | Run the test suite once                                                               |
| `npm run test:watch`        | Run tests in watch mode                                                               |
| `npm run test:ui`           | Run tests with the Vitest UI                                                          |
| `npm run test:coverage`     | Run tests with a coverage report                                                      |
| `npm run test:rls`          | Run the RLS policy test against a fresh database built from the branch (needs Docker) |
