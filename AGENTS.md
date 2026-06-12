# AGENTS.md

This file provides guidance to LLM agents when working with code in this repository.

**Keep this file short.** Compliance degrades as it grows, so write each rule as short as possible while remaining unambiguous, and add an example only when a rule is complicated.

## Repository Overview

VolleyCoach is a single-page React 19 + TypeScript + Vite app for building, browsing, organising, and animating volleyball tactics and drills. Boards and notes persist to a Supabase backend behind invite-only accounts; every access rule is enforced by row-level security, never by the client.

- **Content model.** One `Board` type backs everything: an ordered, non-empty list of steps over a shared set of marker identities. A one-step board is a **Position** (static). Two or more steps make a **Sequence** (animated). Boards carry free-form **tags** for filtering. **Notes** are nestable written documents (think Obsidian) whose blocks embed boards by id: a note references any boards it likes, any number of notes may reference the same board, and a board referenced by no note simply lives in All Boards. A note is a document, not a folder or a tag — boards are never "filed into" notes.
- **Spaces and roles.** Every board and note lives in one space: a team's shared library, or a user's private personal space. A global admin creates teams and invites; per team, a coach curates the library and a player views it read-only. One flagged team is the **Inspiration** showcase, an example library every user may browse and copy from. A personal board can be shared into a team and opened read-only by a share-token link.
- **Spine decisions to respect** (do not relitigate). Marker coordinates are normalized 0–1, never pixels. Marker identity is stable across all steps, so playback interpolates by identity and movement arrows derive from step-to-step deltas. One `Court` component serves both static and animated modes. The court renders as SVG, not canvas.

### Module map

- `src/boards/`: the `Board` model, pure operations, the Supabase-backed store, the playback hook, and derived arrows.
- `src/court/`: the SVG `Court`, `Marker`, and `Arrows`, the drawn-annotation layer and its gestures, the normalized-coordinate geometry, the role/colour palette, and pointer dragging.
- `src/editor/`: the read-only `BoardView` and the draft `BoardEditor`, plus the marker palette, the marker and annotation inspectors, the annotation toolbar, step strip, the rotation panel and board, and description/tag editors.
- `src/bundle/`: the portable JSON bundle format (types, serialize, parse), the export menu, the import and replace-from-JSON dialogs, and the dev-only draft preview.
- `src/print/`: the chrome-free print surface that renders a board or note as a paper handout.
- `src/library/`: the browse surface, board grid, cards, and type/tag filtering.
- `src/notes/`: the note-tree model, operations, store, sidebar, the note view/editor, and the board view's appears-in backlinks. (Server-side, notes live in the legacy-named `topics` table.)
- `src/theme/` and `src/ui/`: the light/dark theme hook, and the shared Base UI + Tailwind control wrappers (buttons, inputs, and overlays) every surface renders through, plus the theme toggle.
- `src/supabase/`, `src/auth/`, `src/account/`, `src/workspace/`, `src/team/`, `src/admin/`, `src/invites/`, `src/sharing/`: the Supabase client and row mappers, the auth gate and login, the account panel and display-name setup, the active-space and team membership state, team management (roles, invite links), admin management (teams, accounts, deleted-content recovery), the invite-link flow (preview, accept, set-password), and the sharing flows (share dialog, copy/promote, the share-token route and read-only viewer).
- `src/App.tsx`: the top-level shell that owns navigation and wires the stores together.

See @docs/architecture.md for how these fit together and the detail behind each.

## Writing Code

- Always read the style guide before writing code: @docs/style_guide.md
- We use Prettier, ESLint, and the TypeScript compiler with a 120-character line length. Do not break lines manually. Run Prettier instead. Settings live in @package.json (Prettier), @eslint.config.js (ESLint), and @tsconfig.json (TypeScript).
- **Icons: use Lucide (`lucide-react`).** Base UI ships no icons. Render a Lucide component for every UI glyph (`<ChevronRight size={14} />`); never hand-draw an inline `<svg>` icon. The only exceptions are the domain art in `src/court/` (the volleyball, net, and court lines) and the app brand mark in the header (mirrored by `public/favicon.svg`).
- **Keep the board-creator skill in lockstep.** Any change to the bundle format (`src/bundle/types.ts`), the board or annotation model, or the court's geometry, roles, or colours must update `.claude/skills/board-creator/` in the same change (`format.md`, `court.md`, `examples/`, `scripts/validate.mjs`), bumping `FORMAT_VERSION` when the bundle shape changes.
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

- `npm run dev` starts the Vite dev server. Run it bare, never with `--port`: Vite auto-picks a free port, and a non-standard port is not in the Supabase auth redirect allow-list.
- `npm run build` type-checks and builds for production
- `npm run format`, `npm run lint`, and `npm run typecheck` format, lint, and type-check `src`/`tests`
- `npm run test` runs the test suite

Use the diagnostics skill after code changes to ensure formatting, linting, and type checking all pass. Use the react-testing skill when writing or modifying tests. Do not disable warnings (`// eslint-disable`, `// @ts-ignore`, `// @ts-expect-error`, etc.) without user permission.

## Tools

The repo enables the following Claude Code tools (binaries to install are in @docs/development.md):

- **`typescript-lsp`** — use the LSP tool for code intelligence (go-to-definition, find references, hover) instead of grepping for symbols.
- **`playwright`** — browser automation against the dev server, for verifying UI changes on screen. **The `playwright` skill is mandatory**: load it before driving the browser, and before planning or prescribing any browser check â it decides when a visual check pays off, and the default is no browser at all.
- **`frontend-design`** — invoke this skill when building or restyling UI to keep the visual language deliberate.
- **`supabase`** — two tools serve the backend:
    - The **Supabase MCP server** (read-only) for inspecting schema, running SELECTs, debugging RLS, and reading logs; the **Supabase CLI** for applying migrations and deploying Edge Functions.
    - The **`supabase` skill is mandatory**: load it before any Supabase work. The project is production; never push or deploy without user confirmation.

## Working Practices

### Behaviour

- Follow instructions exactly as stated. Do not make assumptions.
- Make minimal changes required to complete your task. Do not make any changes beyond the instructions.
- **Stay on track**: answer the question that was asked. Do not jump to implementing or summarising instead. If you lose track of the task, say so and ask rather than flailing.
- **Never silently substitute**: if you cannot complete a specific instruction (a file is missing, a tool fails), stop and say so. Do not quietly do something different and present it as the original request.
- **Flag reversals explicitly**: when you change your mind about a recommendation, say so plainly and explain why, rather than sliding into a new direction as if it were a continuation.
- Report results factually without positive spin. If errors or issues remain unresolved, state them clearly.
- **User-only steps are part of the task.** Some steps need the user (Supabase, Cloudflare, admin actions). Walk them through it with exact, ordered steps and wait. Do not work around it to do it yourself, and do not finish the code, declare done, and dump the rest on them. The task is not done until you have guided their part to completion.

### Problem Solving

- Analyse the specific situation before giving advice. Do not give generic answers or troubleshooting steps.
- If you cannot find a perfect solution meeting all requirements, clearly state this. Do not present an alternative as the solution. Make clear where it falls short.
- If you are unsure what to do or have low confidence in your solution, ask for clarification instead of proposing a poor solution.

### Git and Shell

- Do not run git write operations (commit, amend, push, rebase, reset, tag, branch changes) unless the user explicitly asks; otherwise leave changes in the working tree for review.
- **Write clean, concise commit messages**: a short imperative subject line that says what the change does, a body only when the why is not obvious from the diff. No filler, no restating every file touched.
- Avoid Bash command patterns that block auto-approval: a `$` anywhere in a command (treated as shell expansion regardless of quoting), or backslash-escaped spaces in paths (use double-quoted paths instead).

### Workspaces and worktrees

- Each feature has its own folder. Inside it, the feature branch's checkout and its worktrees sit side by side, each in its own sibling folder.
- Work in the feature branch's checkout or a worktree, never on `main`.
- **When you create a worktree, use the EnterWorktree tool**, not `git` by hand. It runs a custom hook that creates the worktree in a parallel folder and adds it to VS Code.
- **Name every branch `<issue_number>-<name>`, where `<issue_number>` is the GitHub issue this work belongs to** (matched to its branch and PR). A different number means a different issue.
- **Name every worktree's branch and folder `<issue_number>-worktree-<slug>`.** A worktree shares its feature's issue number, so off `11-follow-ups` use `11-worktree-redesign`, never `12-...`.
- **Stay in your workspace.** You belong to exactly one workspace, either the feature branch's primary checkout or a worktree. Edit only its files. Never edit, move, copy into, or delete files in another workspace or branch, and never reach around a guard that blocks this (with Bash file ops, by disabling the guard, or otherwise).
- **Read your own workspace first.** Reach into the feature branch or another worktree only when you genuinely need context missing from yours, and then only to read.
- **Integrate and close a worktree with the `merge-worktree` skill.** It commits, rebases onto the feature branch, fast-forwards (never a merge commit), and removes the worktree folder while keeping the branch. Only do this when the user asks: never commit, rebase, or merge a worktree without their approval.
- **Wrong place? Stop and ask.** If you suspect you are in the wrong location, for example branched off `main` instead of the feature branch, stop, tell the user, and ask for help. Do not work around it.

## Package Management

- Use `npm`. Install with `npm install <package>` (runtime) or `npm install -D <package>` (dev tooling).
- Commit `package-lock.json`. CI runs `npm ci` against it.
