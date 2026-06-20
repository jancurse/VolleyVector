# Resilient Edge Function deploy

## Implementation Agent Instructions

- **Role**: CI/CD engineer comfortable with GitHub Actions and Bash.
- **Task**: Make the Edge Function deploy retry each function and attempt every function regardless of another's failure, failing the job at the end if any function is still broken.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Keep the existing deploy semantics intact: deploy every function (no per-commit diffing), `--no-verify-jwt`, the same project ref and auth.
    - The deploy step must exit non-zero when any function ultimately fails, so the job is marked failed.
- **Required reading**:
    - @CLAUDE.md
    - @.github/workflows/deploy-functions.yml
    - @docs/architecture.md (the "Edge Functions" deployment section)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there (one feature per top-level bullet, its tasks as sub-bullets). Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`, so the user can review what you deferred. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goal

A transient failure deploying one function (e.g. an esm.sh timeout) must not skip the functions after it or leave production half-deployed. The deploy should retry each function and try all of them, then fail loudly only if something is genuinely broken.

### Requirements

- **Retry each function.** Attempt each function's `supabase functions deploy` up to 4 times, with exponential backoff (2s, 4s, 8s) between attempts, before treating it as failed.
- **Attempt every function regardless of another's failure.** A function that fails all its retries does not abort the loop; the remaining functions are still attempted.
- **Fail the job at the end if any function is still broken.** After the loop, the step exits non-zero (and names which functions failed) if one or more never succeeded. If all succeed, the step exits zero.
- **Preserve current behaviour otherwise.** Still loop over every `supabase/functions/*/` directory, still pass `--no-verify-jwt --project-ref xobsdirytehneeofjmrq`, same auth via `SUPABASE_ACCESS_TOKEN`, same trigger/gating/concurrency.
- **Keep output legible.** Log each attempt and a clear final summary of which functions succeeded and which failed, so a maintainer reading the run can see what happened.

### Constraints

- Change is confined to `.github/workflows/deploy-functions.yml` (the deploy step's Bash and any surrounding comment that describes it). No other files.
- Keep the existing explanatory comment block accurate: update it to reflect retry-and-continue behaviour rather than the current straight loop.

### Testing

No automated test harness exists for this workflow. Verify by reasoning through the Bash and, if practical, a local dry run of the loop logic (e.g. with the deploy command stubbed) to confirm: a function failing all retries does not stop later functions, and the step's final exit code is non-zero iff at least one function failed.

### Acceptance Criteria

- The deploy step retries a failing function before giving up.
- A function failing all retries does not prevent later functions from being attempted.
- The step (and job) exits non-zero when any function ultimately fails, and zero when all succeed.
- The final log clearly lists which functions failed.
- Diagnostics pass for any changed files (use the `diagnostics` skill).

## Follow-ups

_None._

## Implementation Notes

### Critical Issues
