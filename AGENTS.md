# AGENTS.md

This file provides guidance to LLM agents when working with code in this repository.

**Keep this file short.** Compliance degrades as it grows, so write each rule as short as possible while remaining unambiguous, and add an example only when a rule is complicated.

## Repository Overview

VolleyCoach is a single-page React 19 + TypeScript + Vite app for building, browsing, organising, and animating volleyball tactics and drills. Boards and topics persist to a Supabase backend behind invite-only accounts; every access rule is enforced by row-level security, never by the client.

- **Content model.** One `Board` type backs everything: an ordered, non-empty list of steps over a shared set of marker identities. A one-step board is a **Position** (static). Two or more steps make a **Sequence** (animated). Boards are organised into a nestable tree of **Topics** and cut across by free-form **tags**.
- **Spaces and roles.** Every board and topic lives in one space: a team's shared library, or a user's private personal space. A global admin creates teams and invites; per team, a coach curates the library and a player views it read-only. A personal board can be shared into a team and opened read-only by a share-token link.
- **Spine decisions to respect** (do not relitigate). Marker coordinates are normalized 0–1, never pixels. Marker identity is stable across all steps, so playback interpolates by identity and movement arrows derive from step-to-step deltas. One `Court` component serves both static and animated modes. The court renders as SVG, not canvas.

### Module map

- `src/boards/`: the `Board` model, pure operations, the Supabase-backed store, the playback hook, and derived arrows.
- `src/court/`: the SVG `Court`, `Marker`, and `Arrows`, the normalized-coordinate geometry, the role/colour palette, and pointer dragging.
- `src/editor/`: the read-only `BoardView` and the draft `BoardEditor`, plus the marker palette, inspector, step strip, and description/tag editors.
- `src/library/`: the browse surface, board grid, cards, and type/tag filtering.
- `src/topics/`: the topic-tree model, operations, store, sidebar, and topic view/editor.
- `src/theme/` and `src/ui/`: the light/dark theme hook, and the shared Base UI + Tailwind control wrappers (buttons, inputs, and overlays) every surface renders through, plus the theme toggle and dev-only debug menu.
- `src/supabase/`, `src/auth/`, `src/workspace/`, `src/team/`, `src/sharing/`: the Supabase client and row mappers, the auth gate and login, the active-space and team membership state, team management (invites, roles), and the sharing flows (share dialog, copy/promote, the share-token route and read-only viewer).
- `src/App.tsx`: the top-level shell that owns navigation and wires the stores together.

See @docs/architecture.md for how these fit together and the detail behind each.

## Writing Code

- Always read the style guide before writing code: @docs/style_guide.md
- We use Prettier, ESLint, and the TypeScript compiler with a 120-character line length. Do not break lines manually. Run Prettier instead. Settings live in @package.json (Prettier), @eslint.config.js (ESLint), and @tsconfig.json (TypeScript).
- **Markdown: never hard-wrap a sentence to satisfy a character count.** A single sentence stays on one line and soft-wraps in the editor. You may break lines at sentence boundaries (or other clause/logical boundaries) for clarity — one sentence per line is fine — but do not split a sentence across lines just to hit a width limit. The 120-character limit is a code rule and does not apply to Markdown prose.
- Code should be concise and readable:
    - Use comments very sparingly. Only write comments to explain a complicated block of code or an unusual line. Do not restate every single line.
    - Do not create more variables than needed. Use inline expressions rather than creating a variable for a one-time use (unless very complicated).
    - Do not rename variables if you modify them unless the old one is still needed.

## Writing Markdown

- **Every sentence must carry concrete content.** Cut any sentence whose only job is to assert importance, relevance, or consequence without conveying the substance that backs the claim.
- **Write direct, plainly-structured prose. Do not pile clauses onto one sentence.** Prefer simple subject-verb-object sentences, and split a compound thought into separate sentences.
    - Use punctuation for the job each mark does: a colon to introduce what follows, a period to end a thought. Do not reach for an em dash where a colon or full stop is what you mean.
    - Heavy use of em dashes, semicolons, and stacked commas is the main tell of fragmented "AI" prose. If a sentence leans on several of them, rewrite it as two or three plain ones.
- **Use a real heading hierarchy.** Give a longer document `#` title, `##` section, `###` subsection, and deeper where the content earns it; nest as far as it helps.
    - Do not leave a flat stack of `##` headings with nothing beneath them. If everything sits at one level, the structure is doing no work — push detail down into subsections.
    - Avoid a pile of one- or two-line sections. A heading must earn its place; if several are tiny, merge them or demote them to bullets under a parent. (An occasional short section is fine — just not the default.)
    - Match depth to length: a short note needs no nesting, while a long one usually wants several levels.
- **Use bullets and sub-bullets heavily** to organise detail inside a section, instead of adding more headings or writing dense paragraphs.
- **Don't run markdownlint by hand.** A hook auto-formats Markdown after you write or edit a `.md` file: it runs `markdownlint-cli2 --fix` and aligns tables.

## Running Code

All commands run from the project root. See @docs/development.md for the full list.

- `npm run dev` starts the Vite dev server
- `npm run build` type-checks and builds for production
- `npm run format`, `npm run lint`, and `npm run typecheck` format, lint, and type-check `src`/`tests`
- `npm run test` runs the test suite

Use the diagnostics skill after code changes to ensure formatting, linting, and type checking all pass. Use the react-testing skill when writing or modifying tests. Do not disable warnings (`// eslint-disable`, `// @ts-ignore`, `// @ts-expect-error`, etc.) without user permission.

## Tools

The repo enables the following Claude Code tools (binaries to install are in @docs/development.md):

- **`typescript-lsp`** — use the LSP tool for code intelligence (go-to-definition, find references, hover) instead of grepping for symbols.
- **`playwright`** — drive the running dev server in a browser to verify the UI visually (screenshots, interaction); look and motion are core to this product, so check changes on screen, not just in tests.
- **`frontend-design`** — invoke this skill when building or restyling UI to keep the visual language deliberate.

## Working Practices

### Behaviour

- Follow instructions exactly as stated. Do not make assumptions.
- Make minimal changes required to complete your task. Do not make any changes beyond the instructions.
- **Stay on track**: answer the question that was asked. Do not jump to implementing or summarising instead. If you lose track of the task, say so and ask rather than flailing.
- **Never silently substitute**: if you cannot complete a specific instruction (a file is missing, a tool fails), stop and say so. Do not quietly do something different and present it as the original request.
- **Flag reversals explicitly**: when you change your mind about a recommendation, say so plainly and explain why, rather than sliding into a new direction as if it were a continuation.
- Report results factually without positive spin. If errors or issues remain unresolved, state them clearly.

### Problem Solving

- Analyse the specific situation before giving advice. Do not give generic answers or troubleshooting steps.
- If you cannot find a perfect solution meeting all requirements, clearly state this. Do not present an alternative as the solution. Make clear where it falls short.
- If you are unsure what to do or have low confidence in your solution, ask for clarification instead of proposing a poor solution.

### Git and Shell

- Do not run git write operations (commit, amend, push, rebase, reset, tag, branch changes) unless the user explicitly asks; otherwise leave changes in the working tree for review.
- Avoid Bash command patterns that block auto-approval: a `$` anywhere in a command (treated as shell expansion regardless of quoting), or backslash-escaped spaces in paths (use double-quoted paths instead).

### Workspaces and worktrees

- Each feature has its own folder. Inside it, the feature branch's checkout and its worktrees sit side by side, each in its own sibling folder.
- Work in the feature branch's checkout or a worktree, never on `main`.
- **When you create a worktree, use the EnterWorktree tool**, not `git` by hand. It runs a custom hook that creates the worktree in a parallel folder and adds it to VS Code.
- **Name every branch `<issue_number>-<name>`.** Both feature branches and sub-worktree branches start with the issue number, e.g. `3-product-dev`.
- **Stay in your workspace.** You belong to exactly one workspace, either the feature branch's primary checkout or a worktree. Edit only its files. Never edit, move, copy into, or delete files in another workspace or branch, and never reach around a guard that blocks this (with Bash file ops, by disabling the guard, or otherwise).
- **Read your own workspace first.** Reach into the feature branch or another worktree only when you genuinely need context missing from yours, and then only to read.
- **Integrate with git, not by copying.** A worktree reaches the feature branch through a git merge. Never copy files between workspaces to share results.
- **Wrong place? Stop and ask.** If you suspect you are in the wrong location, for example branched off `main` instead of the feature branch, stop, tell the user, and ask for help. Do not work around it.

## Backend (Supabase)

- **The user runs all Supabase actions** (SQL migrations, admin bootstrap, Edge Function deploys). Hand over exact steps and wait. Never self-provision, log in, or install deploy tooling.
- **Grant `service_role` in migrations, not only `authenticated`.** "Auto-expose new tables" is off, so grants are explicit. `service_role` bypasses RLS but still needs the table GRANT, or Edge Functions using the secret key fail with `permission denied for table ...`.
- **Edge Functions use the new secret key**, read from the `SUPABASE_SECRET_KEYS` dict, not the legacy `SUPABASE_SERVICE_ROLE_KEY`. Keep "Verify JWT" off and authorize the caller in code.

## Package Management

- Use `npm`. Install with `npm install <package>` (runtime) or `npm install -D <package>` (dev tooling).
- Commit `package-lock.json`. CI runs `npm ci` against it.
