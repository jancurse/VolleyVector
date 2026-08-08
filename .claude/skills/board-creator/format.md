# The bundle format (formatVersion 4)

A bundle is one JSON object carrying notes and boards.
It mirrors `src/bundle/types.ts`, the format's source of truth; keep this file in lockstep with it.

```jsonc
{
  "formatVersion": 4,
  "notes": [
    {
      "ref": "t1", // opaque local id, unique across the bundle
      "title": "Serve receive",
      "parentRef": null, // another note's ref, or null for a root; sibling order = array order
      "blocks": [
        { "kind": "markdown", "text": "Why this matters…" },
        { "kind": "boards", "boardRefs": ["b1"] } // the note's board links themselves
      ]
    }
  ],
  "boards": [
    {
      "ref": "b1", // unique across the bundle
      "title": "Rotation 1",
      "description": "Markdown shown on the board page.",
      "mode": "positions", // "positions" (volleyball roles) or "basic" (coach + players)
      "markers": [
        { "id": "s", "role": "setter" },
        { "id": "oh1", "role": "outside", "label": "OH1" },
        { "id": "x-mb", "role": "middle", "side": "opponent" } // only on an "opponentSide" board
      ],
      "steps": [
        {
          "instruction": "Markdown shown during playback.",
          "positions": { "s": { "x": 0.7, "y": 0.85 }, "oh1": { "x": 0.25, "y": 0.6 }, "x-mb": { "x": 0.5, "y": -0.1 } },
          "rotation": { "kind": "preset", "rotation": 1 } // the step's official-position rotation, when set
        }
      ],
      "tags": ["serve receive"],
      "rotationStrict": false, // strict clamps illegal drags in the editor; loose (the default) only flags
      "opponentSide": true // draws the opponent half, so markers may carry a side and y may go negative
    }
  ]
}
```

## Rules

- `formatVersion`, `notes`, and `boards` are required; either array may be empty.
- **Refs, not ids.** `ref`, `parentRef`, and `boardRefs` resolve within the bundle only. Every reference must point at a ref defined in the bundle. The import mints real ids.
- **A `boards` block's refs are the note's board links.** A board no note references is fine: it simply lives in All Boards. Any number of notes may reference the same board.
- **Marker ids are board-local strings** (short and readable, e.g. `"s"`, `"oh1"`, `"ball"`), unique within their board. Each step's `positions` is keyed by them.
- **Steps are ordered and non-empty.** One step renders a static Position; two or more an animated Sequence.
- **Roles**: `setter`, `outside`, `middle`, `opposite`, `libero`, `ball`, `coach`, `player`. Use the volleyball roles in `positions` mode and `coach`/`player` in `basic` mode; every board with a ball gets one `ball` marker.
- **Marker `label`** overrides the role's default code (`S`, `OH`, `MB`, `OPP`, `L`, `C`, `P`). Number repeated roles (`OH1`, `OH2`). **Marker `color`** (basic mode): `blue`, `amber`, `teal`, `magenta`, `violet`, `slate`.
- **Marker `side`** is `"opponent"` for a player on the far half, absent for ours. It needs the board's `"opponentSide": true`, or the import moves the marker to our side with a notice. Number each side's labels separately (both teams may have an `OH1`), leave the ball sideless, and keep rotations to our players: an opponent in a `rotation` assignment leaves it inactive.
- **Optional with defaults**: a board's `description` (empty), `tags` (empty), `autoArrows` (true), `rotationStrict` (false), `opponentSide` (false); a step's `instruction` (empty), `annotations` (none), and `rotation` (off); a note's `parentRef` (null) and `blocks` (none).
- **Rotations**: a step's `rotation` is `{ "kind": "preset", "rotation": 1–6 }` (a 5-1 preset numbered by the setter's official position; needs a 5-1 roster) or `{ "kind": "custom", "assignment": { "1": "<marker id>", … } }` mapping slots 1–6 to markers. An unreadable rotation is dropped on import with a notice. The validator warns where an active rotation's positions break the overlap rules (FIVB 7.4), which the app flags on screen.
- **Coordinates** are normalized fractions of the half-court; see [court.md](court.md). Out-of-range values are clamped on import; a marker missing from a step's `positions` is benched. Both produce import notices, so position everything deliberately.
- **Older bundles**: version 2 named the notes `topics` and filed each board through a `topicRef`; the import still reads both, folding a `topicRef` into a trailing boards block. Version 3 had no opponent half. Always write version 4.

## Annotations (only when asked)

Each annotation carries `color` (a marker colour key) and `width` (stroke, ~4–8). Kinds:

| kind      | geometry                            | extras                                          |
|-----------|-------------------------------------|-------------------------------------------------|
| `line`    | `a`, `b` points                     | `dash`: `"solid"` or `"dashed"`                 |
| `arrow`   | `from`, `to`, optional `via` (bend) | `dash`                                          |
| `rect`    | `a`, `b` corners                    | `fill`: `"none"`, `"tint"`, `"hachure"`; `dash` |
| `ellipse` | `a`, `b` corners                    | `fill`, `dash`                                  |
| `polygon` | `points` (3+, implicitly closed)    | `fill`, `dash`                                  |
| `free`    | `points` (2+)                       | —                                               |
| `text`    | `at` point, `text` string           | `width` maps to font size                       |
