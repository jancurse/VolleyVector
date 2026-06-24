# Landing page

The marketing landing is built from the app's own board surfaces, not copies of them, so what a visitor sees is exactly what the app renders.

- `ShowcaseBoard` is a thin wrapper around `BoardView`. It inherits every `BoardView` change automatically. Never give it its own layout.
- `RotationShowcase` is a hand-built still. It reuses the view and editor pieces (`Court`, `RotationPanel`/`RotationViewPanel`, `DescriptionEditor`/`DescriptionPanel`) but assembles its own layout, so it does **not** inherit layout changes from `BoardView` or `BoardEditor`.

**Keep `RotationShowcase` in sync by hand.** When you change the board view/editor layout — the one-column card order (Description, Board, Steps) or the rotation-beside-description pairing — make the matching change in `RotationShowcase` in the same commit, so the landing never drifts from the app.
