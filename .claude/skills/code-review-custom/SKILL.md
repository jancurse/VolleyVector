---
name: code-review-custom
description: Review changed code for correctness, reuse, quality, and efficiency, then report findings
---

# Code Review Skill

Review code for correctness, cleanliness, and codebase fit. The user will specify what to review: a commit, staged changes, a branch diff, specific files, or existing code.

## Process

A step reading **dispatch an agent: <prompt>** is delegated: give that agent the prompt and the matching contract from [Agent output contracts](#agent-output-contracts), and use its result as returned. Run every other step yourself.

1. **Decide the scope and gather the diff** from the user context.
2. **Read the diff and the surrounding code** — the full changed files and related modules. Do not review the diff in isolation.
3. **Find candidates**: evaluate every checklist item except Diagnostics and Documentation (each owned by a standing agent in step 4), and collect candidate findings. Do not categorize or write them up.
4. **In one message, dispatch all of these agents at once** — never dispatch one and wait for it before the next:
    - a visual agent, only when the change touches the UI: load the playwright skill, then start the app and confirm the change on screen;
    - a diagnostics agent: run the diagnostics skill (not raw tool calls) on every changed file;
    - a documentation agent: check that behaviour, data-model, and module-structure changes are reflected in README.md, AGENTS.md, and docs/architecture.md, in proportion to the change;
    - one agent per candidate: read the relevant code, trace concrete scenarios, and judge whether the candidate is real.
5. **Collect every agent's result.**
6. **Report**: concatenate the confirmed findings into the format below.

## Agent output contracts

Each agent returns its result in report voice. Each type has a fixed contract.

### Candidate agent

Returns a verdict of **confirmed** or **dismissed**.

- **Confirmed**: a severity (ISSUE, SUGGESTION, or NOTE), a `file:line`, a one-line finding, and the evidence.
- **Dismissed**: the reasoning, and nothing for the report.

Example:

> CONFIRMED — ISSUE — `src/notes/operations.ts:142` — `appendBoardToBlocks` mutates the passed-in blocks array instead of returning a new one. Evidence: the optimistic update in `useNotes` reuses the same reference, so the prior render's state is altered before the commit resolves.

### Visual agent

Returns one of:

- **Confirmed regression**: an ISSUE with the responsible `file:line`, a one-line finding, and what was seen on screen.
- **Clean**: nothing for the report.
- **Could not run**: one NOTE stating why.

Example:

> NOTE — visual check skipped: the dev server stopped at the login gate (no dev-login secret), so the change could not be confirmed on screen.

### Diagnostics agent

Returns one of:

- **Clean**: nothing for the report.
- **Failure**: one ISSUE per failure, each with its `file:line` and the tool's message as evidence.

Example:

> ISSUE — `src/notes/store.ts:88` — TypeScript: `Property 'order' is missing in type`. `npm run typecheck` fails on this line.

### Documentation agent

Returns one of:

- **In sync**: nothing for the report.
- **Gap**: one finding per gap — a severity (ISSUE, SUGGESTION, or NOTE), a `file:line`, a one-line finding, and the evidence.

Example:

> ISSUE — `docs/architecture.md:118` — the new appears-in add action is undocumented; the notes section omits it. Evidence: `src/notes/AppearsIn.tsx` adds a curator add-action with no matching doc update.

## Checklist

- **Style & conventions**: complies with the style guide (@docs/style_guide.md) and AGENTS.md rules.
- **Cleanliness**: no dead code, unused imports, debugging artifacts, unnecessary variables, or speculative abstractions.
- **Simplification**: can any logic be simplified, with fewer branches, less indirection, or consolidated repetition?
- **Codebase fit**: no duplication of existing functionality. Search for similar patterns before approving new ones. Consistent naming and patterns with surrounding code.
- **Correctness**: the logic does what it's meant to, handling the expected inputs and the edge cases without bugs.
- **Security**: changes preserve confidentiality, integrity, and availability. Secrets stay out of client code, untrusted input is handled safely, and access is enforced server-side rather than trusted to the client. Personal data (emails and the like) never reaches a non-admin client: check both what RLS policies and RPCs return and what the client selects.
- **Testing**: sufficient tests for new/changed behaviour, following the react-testing skill rules. If tests are missing or inadequate, specify what should be tested.
- **Documentation**: behaviour, data-model, or module-structure changes are reflected in the docs (README.md, AGENTS.md, docs/architecture.md). New documentation is proportional to the change, never over-explaining a small feature to the point of drowning surrounding content.
- **Plans removed before merge**: A plan under `./plans/` is intentionally tracked on the feature branch for PR reference, but it must be deleted in a separate commit before the squash merge so it never reaches `main`. A plan still present in the branch under review is an ISSUE: flag it to be removed before merging.
- **Diagnostics**: all changed files pass formatting, linting, and type checking.

## Rigor

- **Read the full diff and review all changes thoroughly.** Do not skim.
- **Do not pad the report.** Fewer well-founded findings are better than many speculative ones. An empty SUGGESTIONS section is perfectly fine.
- **The verdict must be consistent with the findings.** Do not list findings then contradict them.
- **Every finding in the final report must have been verified by a subagent**, including ones you notice while writing the report or running diagnostics. If a finding was not verified by a subagent, either dispatch one for it now or drop it.

## Report Format

Report every subagent-confirmed finding, grouped by the severity the subagent assigned. Omit empty categories. Do not drop, downgrade, or upgrade a subagent-confirmed finding based on your own judgment.

- **ISSUES** (must fix): bugs, style violations, missing tests, duplicated functionality, security concerns.
- **SUGGESTIONS** (should consider): simplification, naming, structural improvements.
- **NOTES** (informational): observations, questions for the author.

End with a one-line verdict, determined mechanically by the report contents:

- **CHANGES REQUIRED**: one or more ISSUES.
- **CHANGES SUGGESTED**: zero ISSUES but one or more SUGGESTIONS. NOTES alone do not trigger this.
- **APPROVE**: zero ISSUES and zero SUGGESTIONS. NOTES are allowed.

Do not soften the verdict. If the report contains a SUGGESTION, the verdict is CHANGES SUGGESTED, never APPROVE with "minor polish" or similar hedging.
