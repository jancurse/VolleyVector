# Migration ordering CI check

## Implementation Agent Instructions

- **Role**: CI/DevOps engineer fluent in GitHub Actions and the Supabase migration model.
- **Task**: Add a blocking PR check that fails when a newly added migration would apply out of order or duplicate an existing version.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @.github/workflows/ci.yml — where the blocking PR jobs live (`check`, `rls`).
    - @.github/workflows/migration-guard.yml — the existing non-blocking PR flag for migration changes.
    - @docs/development.md — "Database migrations" pipeline section.
    - The `supabase` skill's migration section.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goal

Turn out-of-order and duplicate migration versions into a visible PR failure, instead of a silent skip or a blocked push at merge time. A migration's version is the numeric timestamp prefix of its filename in `supabase/migrations/`.

### The rule

The check runs on pull requests targeting `main`. It is a no-op unless the PR adds files under `supabase/migrations/`. For each migration file the PR adds, it fails the check when either:

- the file's version is less than or equal to the highest version already on `main`, or
- the file's version duplicates a version already on `main` or another migration added in the same PR.

On failure it reports the offending filename(s) and the highest version currently on `main`, so the fix (rebase on `main`, rename the migration to a fresh later timestamp) is obvious from the log.

### Placement

A new blocking job in `.github/workflows/ci.yml`, alongside `check` and `rls`, so it gates merge like the other CI jobs. It compares the PR's added migration files against `origin/main`. It does not change `migration-guard.yml` (which stays the non-blocking label/comment) or `migrate-prod.yml`.

### Non-goals

- No change to how migrations are pushed to production (`migrate-prod.yml` stays a bare `db push`).
- No automatic renaming or re-timestamping of migrations.
- No change to the local dev or `db push` flags.

### Testing

Verify both outcomes against the real check: a branch adding a migration with a version below `main`'s latest (and one duplicating an existing version) fails it; a branch adding a correctly later-versioned migration passes; a branch with no migration changes is a no-op. If the comparison logic is factored into a script rather than inline workflow steps, cover it with a small test for the same cases.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- A PR that adds an out-of-order migration (version ≤ `main`'s latest) fails the new check.
- A PR that adds a duplicate version (matching `main` or another file in the PR) fails the new check.
- A PR that adds a correctly later-versioned migration passes.
- A PR that touches no migration files passes without running the comparison.
- The failure message names the offending file(s) and `main`'s highest version.

## Follow-ups

_None._

## Implementation Notes

### What was built

- `scripts/check-migration-order.ts` — the guard. It lists the migrations on `origin/main` and the migrations the PR adds (`git diff --diff-filter=A --no-renames origin/main...HEAD`), then runs a pure `checkMigrationOrder(existing, added)`. With nothing added it prints "nothing to check" and exits 0. Otherwise it fails (exit 1) any added file whose version is not strictly after `main`'s highest, or that duplicates the version of another file added in the same PR, printing each offender and `main`'s highest version. Versions compare as numbers (`BigInt`), so a hand-picked short prefix reads as earlier than a 14-digit timestamp rather than sorting after it lexically.
- `tests/scripts/check-migration-order.test.ts` — 11 Vitest cases over the pure `checkMigrationOrder`/`migrationVersion`: correct-later passes, out-of-order (below and equal) fails, duplicate-of-existing fails, within-PR duplicate (both later than `main`) fails, no-added is a no-op, numeric (not lexical) comparison, and the no-`main`-history case.
- `.github/workflows/ci.yml` — a new blocking `migrations` job beside `check` and `rls`, gated `if: github.event_name == 'pull_request'`, checked out with `fetch-depth: 0` (so `origin/main` is present), running `node scripts/check-migration-order.ts`. `migration-guard.yml` and `migrate-prod.yml` are untouched.

### Design choices

- **A single `.ts` script run directly by Node, not `.mjs` or inline bash.** Node 22 (the runner's `node-version: "22"`, ≥ 22.18) runs `.ts` via built-in type stripping, so the workflow step needs no install or build step. Authoring it in TypeScript lets the Vitest test import the pure functions as a normal `.ts` (clean `tsc`), where a `.mjs` import trips TS7016. The script lives in `scripts/` (outside the `src`/`tests` Prettier/ESLint globs, like `board-creator`'s `validate.mjs`); the test pulls it into the TS program, so a type error in the script still fails the build.
- **Git plumbing in the script, the verdict in a pure tested function.** The workflow step stays a one-liner, and the subtle part (the ≤/duplicate rule) is unit-tested without a git fixture.
- **Compare against `origin/main` with a three-dot diff.** `origin/main...HEAD` diffs from the merge base, so on a PR it yields exactly the migrations the branch adds. `--no-renames` keeps a re-timestamped migration visible as an Added file so its new version is still checked.

### Verification

- `npm run format`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test` (566 tests, including the 11 new) all pass.
- The real script was run against throwaway detached worktrees off `origin/main`: no-op (HEAD == `origin/main`) exits 0; an added migration below `main`'s highest and one duplicating an existing version both fail with the right message and a non-zero exit; two added migrations sharing a later version both fail as within-PR duplicates; a correctly later-versioned migration passes. On this branch the script also passes for real (it adds `20260618120000`, after `main`'s highest `20260617155801`).

### Critical Issues

_None._
