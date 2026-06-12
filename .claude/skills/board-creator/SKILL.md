---
name: board-creator
description: Author VolleyCoach board bundles (JSON) from prose or documents, validate them, and hand them to the user for import. Use when the user wants boards, drills, rotations, or tactics created for the app.
---

# Board Creator Skill

You author **board bundles**: portable JSON the user pastes into the app's import dialog (Library → page-bar menu → Import JSON…).
You never write to the database or drive a browser; the app's import path is the only door.

## Workflow

1. **Gather the source material.** Read whatever describes the content: the user's prose, a PDF of rotations, a drill book. Ask what is unclear (rotation system, level, which steps matter).
2. **Author a bundle.** Write one JSON file following [format.md](format.md), placing markers with the coordinate cheat sheet in [court.md](court.md). Start from the bundles in [examples/](examples/) as few-shot references.
3. **Validate.** Run `node .claude/skills/board-creator/scripts/validate.mjs <file>` on every bundle before handing it over. Fix every error; treat warnings as probable mistakes.
4. **Hand over.** Write the bundle to `drafts/<slug>.json` at the project root (gitignored; create the folder if missing). In a dev session, give the user the full preview URL — `http://localhost:<dev server port>/#/preview` — as a clickable link (it is also in the library's page-bar menu, Draft preview…): it lists the drafts, renders the selected one, live-reloads when you rewrite the file, and imports on click. Without a dev server, fall back to giving them the JSON to paste: library → page-bar menu → Import JSON… → paste, check the preview, confirm.
5. **Iterate.** The user eyeballs the rendered courts and comes back with corrections, in words or as JSON: the preview lets them edit a board in the app's editor and **Save & copy JSON** the edited bundle to paste back to you. A pasted bundle carries minted UUID refs — fold its content into the draft file while keeping the file's own refs and any boards/topics the paste did not change. Rewrite the same draft file and re-validate; the preview updates by itself. Import always creates new boards, so tell the user to delete the superseded ones.

## Model invariants

- **Marker identity is shared across all steps.** A marker (id, role, label, colour) is declared once per board; only its position varies per step. Never re-declare or rename a marker between steps.
- **Every step should position every marker.** A step that omits a marker's position benches it (parks it off-court) on import. Carry unmoved markers' positions forward unchanged.
- **Movement arrows are derived, never authored.** The app draws an arrow wherever a marker's position changes between consecutive steps. To show movement, move the marker; do not draw arrow annotations for player or ball movement.
- **One step is a Position (static), two or more a Sequence (animated).** Use a Position for an arrangement, a Sequence for a play or drill. Keep sequences readable: one tactical beat per step, described in its `instruction`.
- **Mode picks the vocabulary.** `positions` for volleyball roles (setter, outside, middle, opposite, libero), `basic` for a coach and generic numbered players.

## Writing titles and text

Titles, descriptions, and step instructions render in the app. Avoid AI-sounding prose:

- **Plain, direct sentences.** Subject-verb-object. Split compound thoughts into separate sentences.
- **No em dashes or semicolons.** Use a period or a colon instead. Avoid stacked commas.
- **Every sentence carries concrete content.** Cut filler that only asserts importance ("This is a crucial drill for…").
- **Titles are short and factual** ("Rotation 1 serve receive", not "Mastering the Art of Rotation 1"). No hype words, no title-colon-subtitle patterns.
- **Prefer bullet lists in descriptions.** Descriptions are markdown: structure coaching points as bullets, not paragraphs.

## Annotations

**Do not add annotations unless the user explicitly asks for them.**
When asked, the typical use is a tinted closed shape (`rect`, `ellipse`, or `polygon` with `"fill": "tint"`) marking a coverage zone or target area, plus an occasional `text` label.
Never use an `arrow` annotation to show a marker's movement — that is the derived arrows' job.
