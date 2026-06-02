# Phase 1 — The Product, Working in Dev

The whole interactive app, client-side only, until it genuinely feels good. No backend, accounts, or deployment — those are later phases. This plan prescribes _what_ Phase 1 contains and the order to build it; the _how_ (component structure, state approach, extra libraries, exact interactions and visuals) is the building agent's call, refined through review once it is on screen rather than pinned down here.

## Goal

A coach can build, browse, and play back tactics and drills entirely in the browser — and it looks and moves beautifully. State persists locally (localStorage) so a real library accumulates across reloads.

## How we work in this phase

- **Ship fast, then refine.** Each stage lands as an initial autonomous cut, then we adjust the details through back-and-forth. Do not try to specify the details up front.
- **Looks are a feature.** Clean, minimal, restrained; motion simple yet effective — 3b1b/Manim level of polish (smooth easing, purposeful animation, nothing decorative). Light/dark and the palette are the agent's call.
- **Honour the spine decisions** in [project_overview.md](project_overview.md): normalized 0–1 coordinates, stable marker identity across steps, one court component for both modes, SVG.

## Stages

Build in order. Each is shippable and reviewed before the next.

### Stage 1 — The look: static court + markers

- Render the court and a set of markers beautifully, with no interaction yet.
- This locks the visual language everything inherits — court, marker shapes, role colours and labels, typography, spacing, and the overall motion feel. Get it right before building features on top of it.

### Stage 2 — Tactic editor

- Place, drag, label, and recolour markers; edit a markdown description.
- Create, edit, and delete tactics, persisted to localStorage.

### Stage 3 — Drills and playback

- Author a drill as ordered steps, each with its own instruction and marker positions.
- Step through the steps, and play them back as a smooth animation with auto-derived movement arrows (markers matched by identity).

### Stage 4 — Library

- Browse all saved tactics and drills, and filter by their organising tags.
- Open any item into the editor or playback.

## Out of scope

- Backend, accounts, auth, share links, deployment (Phases 2–3).
- The final tag taxonomy, court geometry, and role/label conventions — placeholders are fine and settled as we build.

## Done when

Tactics and drills can be created, edited, browsed, and played back entirely in dev, they persist across reloads, and the look and motion feel polished enough to be the product's selling point.
