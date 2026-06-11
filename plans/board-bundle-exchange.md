# Board Bundle Exchange: JSON Import/Export and the Authoring Skill

## Implementation Agent Instructions

- **Role**: Senior frontend engineer on this codebase, fluent in the board/topic model and the Supabase-backed stores.
- **Task**: Add a versioned JSON bundle format with app-side import (with live preview) and export at board, topic, and space level, plus a project skill that authors bundles.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - The bundle parser must never crash the app on malformed input: every parse failure surfaces as a readable error in the import dialog.
    - Export → import must round-trip: importing an exported bundle recreates the same boards and topics (new ids, same content).
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md (the data model, topics, and store sections)
    - src/boards/types.ts, src/boards/normalize.ts, src/boards/useBoards.ts
    - src/topics/types.ts, src/topics/operations.ts, src/topics/useTopics.ts
    - src/editor/useCopyBoardJson.ts, src/editor/CopyJsonButton.tsx, src/editor/BoardActionsMenu.tsx
    - src/library/Library.tsx, src/topics/TopicView.tsx, src/sharing/ShareView.tsx
    - src/court/geometry.ts, src/court/roles.ts (for the skill's coordinate and role reference)
    - .claude/skills/plan/SKILL.md (as an example of an existing project skill's shape)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there (one feature per top-level bullet, its tasks as sub-bullets). Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`, so the user can review what you deferred. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goals

- One portable, versioned JSON **bundle format** that carries boards and topics with no server-owned fields, defined in app source as the single source of truth.
- **Export** of that format at three levels: one board, one topic (with its subtree and member boards), and the whole active space.
- **Import** of that format into the active space through a dialog with a live preview, supporting an iterate loop: generate JSON with Claude, paste, eyeball the rendered courts, refine, confirm.
- A **project skill** that teaches Claude to author valid, volleyball-sensible bundles from prose or documents (e.g. a PDF of serve-receive rotations).

### Non-goals

- No writes to Supabase from the skill; the app's import path is the only door.
- No annotation authoring by default: the skill adds annotations only when explicitly asked.
- No Playwright or browser automation in the skill workflow.
- No update-in-place on re-import: import always creates new boards and topics.

### The bundle format

A new module (suggested: `src/bundle/`) owns the format: its TypeScript types, the `formatVersion` constant, serialization from `Board`/`Topic`, and parsing/validation back.

```jsonc
{
  "formatVersion": 1,
  "topics": [
    {
      "ref": "t1",
      "title": "Serve receive",
      "parentRef": null,
      "blocks": [
        { "kind": "markdown", "text": "…" },
        { "kind": "boards", "boardRefs": ["b1"] }
      ]
    }
  ],
  "boards": [
    {
      "ref": "b1",
      "topicRef": "t1",
      "title": "Rotation 1",
      "description": "…",
      "mode": "positions",
      "markers": [{ "id": "s", "role": "setter" }],
      "steps": [{ "instruction": "…", "positions": { "s": { "x": 0.7, "y": 0.85 } } }],
      "tags": ["serve receive"]
    }
  ]
}
```

- **Refs, not ids.** Boards and topics carry opaque local `ref` strings; cross-references (`topicRef`, `parentRef`, `boardRefs`) resolve within the bundle only. Import mints fresh UUIDs, slugs, and block/step ids. Export uses the real ids as ref values.
- **No server fields.** `owner`, `teamId`, `shared`, `authorLocked`, share tokens, and timestamps never appear in a bundle. Import stamps them per the active space exactly as `addBoard`/`addTopic` do today.
- **Marker ids are board-local strings**, kept as given (validated unique within the board). Step `positions` are keyed by them.
- **Optional fields with defaults**: a board's `description` (empty), `tags` (empty), `topicRef` (null → Unfiled), `autoArrows` (true); a step's `annotations` (none); a marker's `label`/`color` (role defaults). Topic sibling order is the array order; `order` is minted at import.
- Both `topics` and `boards` are required arrays; either may be empty (a per-board export has `topics: []`).
- **Versioning.** The `formatVersion` constant lives beside the parser. A bundle with an older version is normalized on parse (the `boards/normalize.ts` philosophy) and the import dialog shows a non-blocking notice that the bundle (and so the skill that wrote it) is out of date. A bundle with a newer version is rejected with a message that the app is out of date.
- **Leniency.** Parsing is strict on structure (unknown refs, missing required fields, malformed JSON → listed errors) and lenient on content: coordinates are clamped via `clampToCourt`, stored-annotation shapes pass through `normalizeAnnotation`, unknown extra fields are ignored, and a step missing a marker's position benches that marker with a notice.

### Export

- A shared export helper builds a bundle from a set of boards and topics and offers it two ways: **Copy JSON** (clipboard, reusing the existing copied-confirmation pattern) and **Download JSON** (a `.json` file named from the board/topic/space title).
- **Board**: the existing Copy JSON item in `BoardActionsMenu` is reworked to emit a single-board bundle, and a Download item joins it. ShareView's copy button emits the same single-board bundle. `useCopyBoardJson`'s raw-`Board` serialization is retired.
- **Topic**: a matching overflow menu on the topic page bar exports the topic, its whole subtree, and all member boards of those topics.
- **Space**: an overflow menu on the Library (All Boards) page bar exports every topic and board in the active space. This is the data-portability surface: any user can take everything they can see in a space, in every space they can reach.
- Export is available to anyone who can view the content; it needs no edit rights.

### Import

- An **Import JSON…** item in the same Library page-bar menu opens an import dialog. It is offered only when the user may create content in the active space (same condition as the New board action).
- The dialog accepts pasted JSON (textarea) and a file picker. It parses on input and shows either:
    - the list of validation errors, or
    - a **preview**: the topic tree to be created and each board rendered as a small static court (first step) with its title and step count, plus any leniency/version notices.
- Confirming imports create-only into the active space: topics first (parents before children), then boards, via the existing store write paths (extend `useBoards`/`useTopics` minimally where an insert variant is needed, e.g. inserting a fully-formed topic). Writes are awaited; a failure surfaces in the dialog and nothing pretends to have succeeded.
- Nothing is written until the user confirms; cancel discards everything.

### The skill

A project skill at `.claude/skills/board-creator/`, committed to the repo:

- **SKILL.md** (short): the workflow (gather source material → author a bundle → validate with the bundled script → hand the JSON to the user to paste into the app's import dialog → iterate on feedback), the model invariants (shared marker identity, every step covers every marker, arrows are derived and never authored, one step = Position and two or more = Sequence), and the standing rule: do not add annotations unless the user asks (when asked, tinted closed shapes for coverage zones are the typical use).
- **format.md**: the bundle schema and the `formatVersion` it targets, kept in lockstep with `src/bundle/`.
- **court.md**: the coordinate cheat sheet derived from `court/geometry.ts` and `court/roles.ts`: the half-court frame (x sideline to sideline, y net to end line), the attack line, court zones 1–6 as coordinate ranges, the bench row, where a server and the ball go, and the role vocabulary with default labels.
- **examples/**: two or three real exported bundles (harvest them with the new export once it works) as few-shot references.
- **scripts/validate.mjs**: a self-contained Node script (no imports from `src/`, no dependencies) that checks a bundle file: JSON validity, version, ref resolution, marker-id uniqueness, step coverage, coordinate ranges. The skill runs it on every bundle before handing it over.

The validator is intentionally standalone so the skill can later be shared with users who do not have this repo. To keep it honest, a repo test feeds the `examples/` bundles through both the real `src/bundle` parser and the validator, so drift between them fails CI.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests. Cover at least:

- Bundle round-trip: export a space (topics + boards) and re-parse it; content matches, server fields are absent.
- Parse validation: malformed JSON, unknown refs, newer `formatVersion` (rejected), older version (notice), benched missing positions, legacy annotation normalization.
- The example bundles in `.claude/skills/board-creator/examples/` parse cleanly through `src/bundle` and pass `scripts/validate.mjs`.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- A board, a topic, and the whole space each export via Copy and Download in their page-bar or overflow menus.
- Pasting a generated bundle into the import dialog shows rendered court previews before anything is written, and confirming creates the topics and boards in the active space.
- An older-version bundle imports with a "skill may be out of date" notice; a newer-version bundle is refused with an "app out of date" message.
- The skill authors a multi-board bundle with a topic that validates and imports cleanly.

## Follow-ups

- A one-action "everything I can reach" takeout across all spaces (e.g. one file per space or a zip). Deferred: per-space export already covers data portability in a few clicks, and a cross-space fetch plus a zip dependency is not worth it until a concrete trigger (offboarding, a user request) shows up.
- Dev-only file-watched preview route: a `#/preview` route reading a gitignored JSON file the skill writes, so iteration needs no pasting.
- Update-in-place re-import: matching boards/topics by ref or title to update instead of duplicating.

The print/handout half of the original "presentation-grade exports" follow-up is implemented; see the notes below.

## Implementation Notes

- The format lives in `src/bundle/`: `types.ts` (the `Bundle` types and `FORMAT_VERSION`), `serialize.ts` (`toBundle`, `bundleFilename`), and `parse.ts` (`parseBundle`, which validates and materializes in one call). `parseBundle(text, existingTopics)` returns either readable errors or ready-to-insert `Topic[]`/`Board[]` with fresh ids, slugs minted against the existing tree, and topics ordered parents-first, plus the leniency notices. Boards come back with `owner: null` and zero timestamps; `App.importBundle` stamps the owner and `addBoard` stamps the times.
- `formatVersion` validation accepts any integer ≥ 0 so the older-version notice path is real and testable (version 0 never shipped, but it parses with the out-of-date notice rather than being a dead branch until v2).
- Annotations in a bundle are lenient as a whole: a shape that fails its per-kind validation is dropped with a notice instead of failing the import, since a half-readable drawing should not block boards. Everything else (refs, marker ids, modes, roles, point shapes) is strict.
- `benchPosition` in `src/boards/operations.ts` is now exported, so the parser benches a marker a step omits using the same slot logic the editor uses.
- The export UI is one hook plus one menu: `useBundleExport` (copy with the 1.5 s confirmation, download via a Blob URL) and `ExportMenu` (Copy JSON / Download JSON plus optional extra items). `BoardActionsMenu` and `CopyJsonButton` now emit single-board bundles; `useCopyBoardJson` is deleted. `Library` and `TopicView` gained an optional `menu` prop and `App` composes the menus there, including the Import JSON… item (only when `canEdit`).
- `useTopics` gained `insertTopics(topics)`: sequential awaited inserts (parents first) with retries, updating local state per success; a mid-list failure returns the error and keeps the already-inserted topics. `useBoards.addBoard` is reused unchanged for the boards.
- The skill's examples were authored by hand to match the export shape exactly (no live space had exportable content to harvest); `tests/bundle/examples.test.ts` proves they parse through `src/bundle` with zero notices and pass `scripts/validate.mjs` with zero warnings, which is the drift guard the plan asked for.

### Print/handout exports (follow-up, implemented)

The handout rendering shipped as a print stylesheet surface, not a PDF library, so the same React components serve screen and paper.

- Two chrome-free routes render a paper document the browser prints or saves as PDF: `/…/board/<id>/print` and `/…/topic/<slug>/print` (`printBoard`/`printTopic` in `src/routing/route.ts`). They are reached from a **Print…** item in the board's overflow menu and the topic page's export menu; the space level deliberately has no print surface.
- `src/print/` holds the surface. `PrintView` forces the light theme and sets the document title while open (so the saved PDF is named after the board or topic), with a screen-only toolbar carrying Back and Print. `BoardPrint` renders one board: kind and title header, description, then a Position's single court or a Sequence's two-column step cards, each a static court with the derived arrows previewing its upcoming move and its instruction, kept whole across page breaks. `TopicPrint` renders the topic document with each board group expanded through `BoardPrint`, using the same placement-hint semantics as `TopicView`.
- The topic print covers the topic's direct members only, not its subtree. The printed artefact is the one topic document, unlike the topic JSON export, which carries the whole subtree.
- A stale print deep link whose board or topic the URL's space does not hold shows the not-found surface once the space settles; it does not self-heal to the board's real space the way the board view route does.

### Critical Issues

No critical issues.
