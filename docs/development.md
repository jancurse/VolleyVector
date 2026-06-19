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

- Install Node.js 22+.
- Install **Docker** (Desktop or Engine). The local Supabase stack runs in Docker, and `npm run dev` starts it. The Supabase CLI itself is a dev dependency, so `npm install` provides it (run as `npx supabase`).
- Run `npm install` to install dependencies. This also generates `package-lock.json`, which is committed and used by CI.
- Install the recommended VSCode extensions: Prettier, ESLint, and markdownlint.
- Install the markdown formatting CLIs once per machine: `npm i -g markdownlint-cli2 markdown-table-prettify`.
- Install `pre-commit` and run `pre-commit install` to enable the markdown commit hooks.
- **Dev auto-login (optional).** Add credentials to `~/.config/volleycoach/dev.env` and the dev server signs itself in instead of showing the login screen:

    ```sh
    VITE_DEV_EMAIL=coach@volleycoach.test
    VITE_DEV_PASSWORD=password
    ```

    For `npm run dev` (the local stack) use one of the seeded accounts listed under [Local database](#local-database). For `npm run dev:prod` use a personal, low-privilege production account, never an admin. The file is read only in `serve`, so it never reaches production, and it stays out of the repo. Anyone with the file can sign in as that account, so keep it low-privilege.
- **Claude Code**: the repo enables tools that load automatically once you trust the project. Some need a binary installed once per machine:
    - `typescript-lsp` — TypeScript code intelligence. Needs the language server: `npm i -g typescript-language-server typescript` (global; reinstall after switching Node versions).
    - `playwright` — browser automation. Needs a browser: `npx playwright install chromium`.
    - `frontend-design` — frontend design guidance. No binary needed.

## Development

### Run in dev mode

Run `npm run dev` to start the Vite dev server at <http://localhost:5173> with hot module reloading. It runs against the local database (see below), bringing it up first if needed.

### Local database

The only non-production environment is a local Supabase stack: free, disposable, and Docker-based. It is configured in `supabase/config.toml`, built from the migrations under `supabase/migrations/`, and seeded by `supabase/seed.sql`. Develop and verify database changes here before they reach production. The stack is lean by design (database, auth, REST API, and Studio only), so several can run at once.

A fixed `project_id` means every branch and worktree shares one stack, held at main's schema. The developer manages no database lifecycle: pick a dev mode and the scripts handle the rest.

#### Dev modes

- **`npm run dev`** runs the app against the **shared** local database, starting it if it is not already up. This is the everyday mode. The shared database holds main's schema, so this is unaffected by the migrations on your branch.
- **`npm run dev:prod`** runs the app against the **production** database (the committed `.env` values). Use it sparingly, to reproduce something against real data.
- **`npm run dev:migrate`** runs the app against a **fresh, isolated, temporary** database built from the current branch's migrations, and tears it down on exit. Use it to try a migration before it merges. It picks its own ports and project id, so it never collides with the shared database or another `dev:migrate` run.
- **`npm run db:clean`** tears down any leftover temporary databases (a `dev:migrate` run that crashed before its own cleanup). It never touches the shared database.

Choosing `dev` vs `dev:migrate` is the whole rule: `dev` runs against main's schema, `dev:migrate` against the current branch's. There is nothing else to learn.

#### Seeded accounts

A fresh local database comes up with three sign-in accounts (password for all three: `password`):

| Email                     | Role                                  |
|---------------------------|---------------------------------------|
| `admin@volleycoach.test`  | global admin (god-mode across spaces) |
| `coach@volleycoach.test`  | coach of the demo team, owns a board  |
| `player@volleycoach.test` | player on the demo team (read-only)   |

It also seeds a demo team with sample boards and a note. The seed is local-only fixtures: a production migration push applies migrations only, never the seed.

#### Refreshing the shared database

`npm run dev` never changes an existing database's schema (migrations apply only when the database is first created), so the shared database stays at main's schema across branches. Refresh it from main when production has been updated: check out `main`, then run `npm run db:reset`, which rebuilds the shared database from the migrations and the seed. This is occasional maintenance, not a per-check step.

### Previewing board-creator drafts

The board-creator skill writes bundle JSON to the gitignored `drafts/` folder. The dev-only `#/preview` route renders those files for the iterate loop:

- **Draft preview…** in the library page-bar menu (or the hash itself) opens it; it hot-reloads as the skill rewrites a draft.
- Cards open the normal board view and editor.
- **Save & copy JSON** keeps the edit on the page (in memory only) and copies the bundle to paste back to the skill.
- **Import** creates what is on screen into the active space.
- None of it ships: the route is `import.meta.env.DEV`-gated.

### Testing

- `npm run test` runs the Vitest suite once. It is fast and Docker-free: it runs against an in-memory Supabase fake, and CI runs it on every PR.
- `npm run test:rls` runs the row-level-security regression test (`supabase/tests/rls_policies_test.sql`) against a local database. It brings the local stack up if needed, runs the SQL test inside the database container, and reports pass or fail. It needs Docker and is deliberately kept out of `npm run test` so the Vitest suite stays fast. It is the same check CI runs, so a local pass means a CI pass.

### Deployment and the database pipeline

The front end and the database reach production by two separate, CI-gated paths. Both wait for CI to pass on `main`, so nothing reaches production from feature work.

#### Front end

The app deploys to Cloudflare Pages at <https://volleycoach.pages.dev>. `.github/workflows/deploy.yml` publishes automatically once CI passes on `main`, so there is no manual deploy step, and production config lives in GitHub Actions variables and secrets rather than the repo.

#### Database migrations

Migrations never reach production during feature work. A deliberate, CI-gated push applies them when a change merges:

- **A PR that changes `supabase/migrations/` is flagged.** `.github/workflows/migration-guard.yml` adds a `database-migration` label and posts a comment, so the migration is reviewed before merge.
- **On merge, migrations are pushed to production automatically.** `.github/workflows/migrate-prod.yml` runs `supabase db push` after CI passes on `main`, mirroring the deploy pipeline's green-main gating. There is no manual approval button: the deliberate act is merging after seeing the warning. (GitHub Environments required reviewers, the native click-to-approve gate, are unavailable on a private free repo.)

The push needs the production credentials as repository **secrets**, set once under Settings → Secrets and variables → Actions:

- `SUPABASE_ACCESS_TOKEN`: a Supabase access token (Account → Access Tokens), which authenticates the CLI.
- `SUPABASE_DB_PASSWORD`: the production database password, which authorizes the push.

The project ref is public and hardcoded in the workflow. A manual `workflow_dispatch` run pushes the default branch on demand.

### Useful Commands

| Command                 | Description                                                                  |
|-------------------------|------------------------------------------------------------------------------|
| `npm run dev`           | Start Vite against the local database (port 5173), bringing it up if needed  |
| `npm run dev:prod`      | Start Vite against the production database                                   |
| `npm run dev:migrate`   | Start Vite against a temporary database built from the branch's migrations   |
| `npm run build`         | Type-check and build for production                                          |
| `npm run preview`       | Preview the production build locally                                         |
| `npm run db:reset`      | Rebuild the shared local database from migrations and seed (run from `main`) |
| `npm run db:clean`      | Tear down leftover temporary `dev:migrate` databases                         |
| `npm run format`        | Format `src`/`tests` with Prettier                                           |
| `npm run format:check`  | Check formatting without writing                                             |
| `npm run lint`          | Lint `src`/`tests` with ESLint                                               |
| `npm run lint:fix`      | Lint and auto-fix                                                            |
| `npm run typecheck`     | Type-check without emitting (`tsc --noEmit`)                                 |
| `npm run test`          | Run the test suite once                                                      |
| `npm run test:watch`    | Run tests in watch mode                                                      |
| `npm run test:ui`       | Run tests with the Vitest UI                                                 |
| `npm run test:coverage` | Run tests with a coverage report                                             |
| `npm run test:rls`      | Run the RLS policy test against a local database (needs Docker)              |
