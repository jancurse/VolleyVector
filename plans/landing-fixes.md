# Landing real-examples: fixes

Independent groups. Each can be done on its own.

## Group A — Court colours must not depend on theme (app-wide)

The court is always light (the floor/line tokens in `src/index.css` are set once under `:root` and never overridden per theme). But a few court visuals reach for the theme-dependent `--accent`/`--danger`, so they flip between light and dark on an unchanging court. That is the amber-vs-red discrepancy.

- In `src/court/court.css`, these use `var(--accent)` or `var(--danger)`: the selection halo (`.court-halo`, `.court-halo--on`), the fault halo (`.court-halo--fault`), the rotation cue line (`.court-link--cue`), the violation line (`.court-link--violation`), and the annotation cues (`.court-annotation--selected`, `.court-annotation-handle-dot`, `.court-poly-target`, `.court-snap-dot`).
- Fix: add theme-independent court tokens (alongside `--court-play` etc. in the `:root` block of `src/index.css`) pinned to the light-court values (`--accent` light `#2f6fe0`, `--danger` light `#d6442b`), and point the rules above at them instead of `--accent`/`--danger`. The ball arrow (`--ball-arrow`) is already theme-independent.
- Also fix the false comment at the top of `src/court/court.css` claiming the court "swaps with `[data-theme]` too" — it does not.

## Group B — Drill needs an opposite

`DRILL_BOARD` in `src/landing/exampleBoards.ts` has only five players (no opposite), which is unrealistic.

- Add an `opposite` marker and carry it through all four steps.
- Base the step-1 formation on the most similar real 5-1 rotation rather than inventing positions (rotation 1: setter penetrating from the right back, opposite front-left), so the start reads as a genuine serve-receive.

## Group C — Rotation section rework

In `src/landing/LandingPage.tsx` the rotation section is wrong on three counts.

- **Framing:** the heading "Catch overlap faults on the board." is wrong — overlap is only the final beat. Reframe around the rotation/constraint feature, with the fault as the cautionary end.
- **Mini board missing:** show the rotation diagram beside the court, reusing `src/editor/RotationBoard.tsx` (props: `markers`, `rotation`, `selectedId`, `links`), as the app's board view does.
- **Liveliness:** it currently plays as three discrete stills. Make it feel like a coach dragging the opposite: continuous motion of one marker from legal, into the lane (cue lines show), then past the middle (violation), with the overlay recomputed live. Replace the 3-step `ShowcaseBoard` approach here.

## Group D — Unconfirmed, verify before touching

The landing may load in a different theme than the signed-in app. A browser check saw it come up on the system default, but that could just be an empty saved preference in a fresh browser rather than a real divergence. Confirm against `src/theme/useTheme.ts` behaviour before deciding there is anything to fix.
