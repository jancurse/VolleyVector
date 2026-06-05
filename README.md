# VolleyCoach

VolleyCoach is a single-page web app for building, browsing, organising, and animating volleyball tactics and drills. A coach lays out players and the ball on a court and writes a markdown description. A single arrangement is a static **Position**. Chaining several steps makes a **Sequence** that plays back as a smooth animation, and its movement arrows are derived from the steps. Boards are organised into a coach-curated tree of topics and filtered by tags.

> **Status:** early development. The full interactive app runs in the browser, and every board and topic persists to the browser's `localStorage`. There is no backend, no accounts, no sharing, and no deployment yet.

## Features

- **Court editor:** place, drag, label, and recolour markers on a normalized court that stays crisp from phone to laptop. Nudge a selected marker with the arrow keys.
- **Positions and Sequences:** every board is one court diagram. A single step is a static Position. Adding steps promotes it in place to an animated Sequence.
- **Playback:** step through a Sequence, or play it back as a smooth animation. Movement arrows are derived automatically from how markers move between steps.
- **Markdown:** each board carries a markdown description, and each step its own markdown instruction. Both use a Write/Preview toggle.
- **Topics:** organise boards into a nestable, coach-curated tree, each with its own markdown explanation. A board has one home topic or sits Unfiled.
- **Library:** browse every board as a grid of court thumbnails. Filter by type (All, Positions, Sequences) and by tags.
- **Light and dark themes:** the interface follows the system preference and can be toggled.

## Not built yet

- **Backend persistence** on Supabase, replacing `localStorage`.
- **Accounts and roles:** invite-only coaches who edit, and read-only players, enforced server-side.
- **Sharing:** open a single board from an unguessable share link, with no account.
- **Deployment** of the static front end against the managed backend.

## Stack

- **React 19 + TypeScript + Vite** drive the single-page app.
- **SVG** renders the court, markers, and arrows as React components.
- **[Motion](https://motion.dev)** animates marker movement during playback.
- **[react-markdown](https://github.com/remarkjs/react-markdown)** renders descriptions and instructions.
- State lives entirely in the browser's `localStorage`. A **[Supabase](https://supabase.com)** backend (database and auth) and static hosting are planned but not wired up yet.

## Development

- See [docs/architecture.md](docs/architecture.md) for how the client fits together.
- See [docs/development.md](docs/development.md) for setup, commands, and tooling.
