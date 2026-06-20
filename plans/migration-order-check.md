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

_To be filled in by the implementation agent._

### Critical Issues

_To be filled in by the implementation agent._
