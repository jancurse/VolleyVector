# VolleyCoach

VolleyCoach is a single-page web app for building, browsing, organising, and animating volleyball tactics and drills. A coach lays out players and the ball on a court, writes a markdown description, and either keeps it as a static **Position** or chains several steps into a **Sequence** that plays back as a smooth animation with movement arrows derived from the steps. Boards are organised into a coach-curated tree of topics and filtered by tags.

> **Status:** Phase 1 — the full interactive app runs in the browser, with every board and topic persisted to the browser's `localStorage`. There is no backend, no accounts, no sharing, and no deployment yet; those are Phases 2–3.

## Features

- **Court editor** — place, drag, label, and recolour markers on a normalized court that stays crisp from phone to laptop, and nudge a selected marker with the arrow keys.
- **Positions and Sequences** — every board is one court diagram; a single step is a static Position, and adding steps promotes it in place to an animated Sequence.
- **Playback** — step through a Sequence or play it back as a smooth animation, with movement arrows derived automatically from how markers move between steps.
- **Markdown** — each board carries a markdown description, and each step its own markdown instruction, edited with a Write/Preview toggle.
- **Topics** — organise boards into a nestable, coach-curated tree, each topic with its own markdown explanation; a board has one home topic or sits Unfiled.
- **Library** — browse every board as a grid of court thumbnails and filter by type (All / Positions / Sequences) and by tags.
- **Light and dark themes** — the interface follows a system-preference-aware light or dark theme.

## Planned (Phases 2–3)

- **Backend persistence** on Supabase, replacing `localStorage`.
- **Accounts and roles** — invite-only coaches who edit and read-only players, enforced server-side.
- **Sharing** — open a single board from an unguessable share link, with no account.
- **Deployment** of the static front end against the managed backend.

## Stack

- **React 19 + TypeScript + Vite** drive the single-page app.
- **SVG** renders the court, markers, and arrows as React components.
- **[Motion](https://motion.dev)** animates marker movement during playback.
- **[react-markdown](https://github.com/remarkjs/react-markdown)** renders descriptions and instructions.
- State lives entirely in the browser's `localStorage`. **[Supabase](https://supabase.com)** for the database and auth, and static hosting, are planned but not wired up yet.

## Development

- See [docs/architecture.md](docs/architecture.md) for how the client fits together.
- See [docs/development.md](docs/development.md) for setup, commands, and tooling.
