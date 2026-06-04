# Phase 1 Completion Documentation

## Implementation Agent Instructions

- **Role**: A technical writer who reads the VolleyCoach codebase and documents what it currently does.
- **Task**: Update `README.md` and `AGENTS.md`, and add one new developer-documentation file under `docs/`, to reflect the Phase 1 app as it exists now.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter (especially the Markdown rules: real heading hierarchy, content-bearing sentences, heavy use of bullets, no hard-wrapping a sentence to a width).
    - **Document only current behaviour.** Describe what the app *is* and *does* today. Never describe history or change: no "we changed to…", "now uses…", "previously…", "the old tactic/drill split", "was renamed", or "Stage N added…". A reader must not be able to tell what came before.
    - Keep all three documents concise. They orient a reader; details live in the code and in `docs/architecture.md`.
    - Do not invent or aspirationally describe features. If it is not in `src/`, it is not current behaviour (planned Phase 2–3 work may be named as *planned*, clearly separated).
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @plans/project_overview.md
    - The other plans in `plans/` and their follow-ups (`phase_1.md`, `unify-boards.md`, `topics.md`, `debug-menu-and-board-export.md`) — the record of what was built, for context on intent, not as an outline to mirror.
    - The current source, to ground every claim: `src/boards/`, `src/court/`, `src/editor/`, `src/library/`, `src/topics/`, `src/ui/`, `src/theme/`, `src/App.tsx`.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.` Do not implement follow-ups unless explicitly asked.

## Plan

### Context and ground rules

Scope: document the **Phase 1 app as it exists in `src/` today** — a client-only React 19 + TypeScript + Vite SPA with all state in `localStorage` and no backend, auth, sharing, or deployment (those are Phases 2–3). `plans/project_overview.md` carries the product scope, the spine decisions, and the roadmap — read it for context.

The docs you produce (`README.md`, `AGENTS.md`, `docs/`) are the **permanent home** for this documentation and must stand on their own. The feature plans (`unify-boards.md`, `topics.md`, `debug-menu-and-board-export.md`) are scaffolding and get deleted, so capture anything durable from them directly in the docs. The docs must never mention `plans/`, temp files, or the planning process, and never depend on a plan for something a reader needs — they read as documentation of the app, not of how it was built.

**Decide the content yourself, from the plans and the code.** Read the feature and phase plans (and their follow-ups) alongside the source, then judge what a reader of each document actually needs. This plan deliberately gives no feature list and no section outline, so the docs reflect the app rather than a stale summary. Ground every claim in `src/`; if it is not there, it is not current behaviour.

**Weight coverage by importance to a reader, not by how much a plan wrote.** A feature's space in the docs is set by how much it matters, not by the length of the plan that introduced it — do not mirror the plans' granularity. A whole plan can collapse to a line: a developer-only debug menu or a copy-to-clipboard export is a line each at most, while the systems that define the app (the model, the court and coordinates, the editor, the animation) earn real sections. You decide where each feature lands on that scale.

Where to look (`src/`): `boards/` (model, ops, storage, stores, playback, arrows), `court/` (SVG court, marker, arrows, geometry, roles, drag, motion), `editor/` (board view/editor, marker palette/inspector, step strip, description & tag editors), `library/` (browse, grid, card, items, selection), `topics/` (model, ops, storage, store, sidebar, view/editor, picker), `ui/` (theme toggle, debug menu), `theme/` (theme hook). Entry: `main.tsx` → `App.tsx`.

### Deliverable 1 — `README.md`

Audience: anyone landing on the repo. A brief landing page — resist padding; depth lives in `docs/architecture.md`. Follow the Markdown writing guidance in `AGENTS.md`.

- Bring **Status** to current reality: what a coach can do in dev today, persisted to `localStorage`, with backend, auth, sharing, and deployment still to come (Phases 2–3).
- Replace any planned-features framing with the app's **current** features in today's vocabulary, derived from the code — then a short, clearly separated **Planned (Phases 2–3)** note. The planned note is a few bullets, not a second feature catalogue.
- Keep the **Stack** and **Development** sections; state the stack actually in use for the client, with anything not yet wired up flagged as planned.

### Deliverable 2 — `AGENTS.md`

Audience: an LLM agent getting oriented fast. Honour the file's own "keep this short" rule — add only what an agent needs to navigate, then point onward to the new developer doc for detail.

- Bring the **Repository Overview** to the current shape, concisely: the content model, the spine decisions it must respect, how content is organised, and that persistence is `localStorage`-only with no backend yet. State these at the level an agent needs to navigate; do not catalogue every feature.
- Add a short **module map** so an agent knows where each concern lives.
- Add one pointer to the new developer doc as the place for detail.
- Do **not** touch the existing Writing/Running/Tools/Working-Practices sections.

### Deliverable 3 — new developer documentation (`docs/architecture.md`)

Audience: a developer working on the client. Cover every **important** current feature and explain how the architecture fits together — thorough on what matters, but kept manageable: a clear orientation before someone reads code, not a line-by-line catalogue.

- **Derive the structure from the code, not from this plan.** Read the source, decide which features and systems are important enough to document, and organise them into whatever sections the material actually warrants. This plan prescribes no section list on purpose — a prescribed outline would smuggle in errors and stale framing instead of reflecting the code.
- Use a real heading hierarchy (`#` title, `##` sections, `###` subsections where earned) and heavy bullets, per the Markdown rules in `AGENTS.md`.
- Document only current behaviour, and only what is **important**. Skip internal mechanics and incidental details a reader does not need: a trivial default, a single constant, or an implementation guard does not earn a sentence.
- Make it self-contained — the architecture reference, not a link hub. It is not the place for contributor tooling (`docs/development.md`) or code conventions (`docs/style_guide.md`), and it must not lean on `plans/` at all; the architecture doc stands alone. Capture the durable architecture content it needs — the spine decisions among it — in the doc itself, not behind a link.

### Testing

No code changes, so no unit tests. Verify instead that:

- The Markdown conforms to the writing rules in `AGENTS.md` and passes markdownlint (`.markdownlint.yaml`), the repo's Markdown tool. The Prettier scripts are scoped to `src`/`tests`, so they don't touch the docs — there's nothing to run there.
- Every factual claim in the three documents is checked against `src/` (no aspirational or historical statements).
- Internal links resolve.

### Acceptance Criteria

- `README.md` reflects the current working-in-dev status and a current Features list, with planned Phase 2–3 work clearly separated.
- `AGENTS.md`'s Repository Overview concisely states the current architecture and a module map, with a pointer to the new developer doc; the rest of the file is unchanged.
- A new `docs/architecture.md` documents the current app's important features and how they fit, concise, with a real heading hierarchy and a structure the writer derived from the code.
- No document describes history or change; all three describe only current behaviour.
- No document pads with trivia — internal mechanics, single constants, literal storage keys, or incidental defaults that a reader does not need.
- All internal links resolve.

## Follow-ups

*None.*

## Implementation Notes

### What was produced

- **`README.md`** — rewritten as a landing page: a current-reality **Status** (Phase 1, all state in `localStorage`, no backend/accounts/sharing/deployment), a current **Features** list in today's vocabulary (court editor, Positions/Sequences, playback with derived arrows, markdown, Topics, library filtering, themes), a clearly separated **Planned (Phases 2–3)** note, an in-use **Stack**, and a **Development** pointer.
- **`AGENTS.md`** — only the **Repository Overview** changed: a concise current-shape summary (one `Board` type → Position/Sequence, Topics tree, tags, `localStorage`-only), the spine decisions to respect, and a new **Module map**. The Writing/Running/Tools/Working-Practices sections were left untouched.
- **`docs/architecture.md`** — new, self-contained developer reference. Structure was derived from the code: spine decisions, the data model (with a small types block), the court and coordinate system, authoring, motion and playback, organising boards (topics/tags/browse), and the app shell.

### Key decisions

- **The structure was derived from the source, not from this plan.** Every claim was grounded in `src/`; importance set the weight (the model, court, editor, and animation earn sections; the dev-only debug menu and Copy-JSON export are a line each).
- **The three docs reference no `plans/` at all** (per the ground rules). The durable spine decisions were captured directly in `docs/architecture.md`, which now stands alone.
    - Consequently, AGENTS.md's Repository Overview now `@`-points to `docs/architecture.md` for detail (replacing the former `@plans/project_overview.md` pointer), and README points to `docs/architecture.md` instead of the plan.
- **Current behaviour only** — no document describes history or change, and `Tactic`/`Drill` never appear as code types (only `Board`, with derived `Position`/`Sequence`); the phrase "tactics and drills" is used solely for the product domain.

### Method and verification

- Built from a fan-out survey of each `src/` subsystem, then an adversarial fact-check pass (9 checkers cross-reading each doc area against the source for inaccurate, ungrounded, historical, aspirational, or broken-link claims).
- The fact-check surfaced two medium precision issues in `docs/architecture.md`, both corrected: the new-marker numbering rule was overstated as "roles that come in pairs", and the marker's inner-group entrance was called a "lift" when it is a scale-in. The ball description's absolute "(no white)" was also softened, since the ball carries a faint white sheen highlight.
- `markdownlint` (the repo's `.markdownlint.yaml`) passes on all three files; the Prettier scripts are scoped to `src`/`tests` and do not touch docs. All internal links and `@`-paths resolve (`docs/architecture.md`, `docs/development.md`, `docs/style_guide.md`, `package.json`, `eslint.config.js`, `tsconfig.json`).

### Critical Issues

- **Removing the `@plans/project_overview.md` pointer from `AGENTS.md` ends its auto-inclusion in agent context.** The ground rules forbid the permanent docs from referencing `plans/`, so the Repository Overview now points to `docs/architecture.md` instead. `plans/project_overview.md` still exists as the product/roadmap record, but it is no longer pulled into context automatically — its durable architecture content (the spine decisions) was copied into `docs/architecture.md` to compensate.
