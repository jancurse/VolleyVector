# VolleyCoach

VolleyCoach is a single-page web app for building, browsing, organising, and animating volleyball tactics and drills. A coach lays out players and the ball on a court and writes a markdown description. A single arrangement is a static **Position**. Chaining several steps makes a **Sequence** that plays back as a smooth animation, and its movement arrows are derived from the steps. Boards are filtered by tags and embedded in notes, a coach-curated tree of written documents.

> **Status:** in development. The full interactive app runs in the browser, and boards and notes persist to a Supabase backend behind invite-only accounts. Accounts are organised into teams, each user also has a private personal space, and a board can be opened read-only from a share link. Access is enforced in the database by row-level security. The static front end is deployed to Cloudflare Pages.

## Features

- **Court editor:** place, drag, label, and recolour markers on a normalized court that stays crisp from phone to laptop. Nudge a selected marker with the arrow keys.
- **Positions and Sequences:** every board is one court diagram. A single step is a static Position. Adding steps promotes it in place to an animated Sequence.
- **Playback:** step through a Sequence, or play it back as a smooth animation. Movement arrows are derived automatically from how markers move between steps.
- **Markdown:** each board carries a markdown description, and each step its own markdown instruction. Both use a Write/Preview toggle.
- **Notes:** nestable written documents that mix markdown prose with embedded groups of boards. Any number of notes may reference the same board, and a board lists the notes it appears in.
- **Library:** browse every board as a grid of court thumbnails. Filter by type (All, Positions, Sequences) and by tags.
- **Accounts and teams:** invite-only sign-in, with a display name shown on the boards and notes you share. A global admin creates teams; a coach grows their team by sharing single-use invite links. Per team, coaches curate the library and players view it read-only.
- **Account and team lifecycle:** anyone can delete their own account, and an admin can archive or delete a team. Deleted boards, notes, teams, and accounts are kept for a three-month recovery window before they are purged.
- **Spaces:** every user has a private personal space, and each team has a shared library. A board or note can be granted to several teams and to individual users at once, so it lives in every library that holds it rather than in one.
- **Sharing and collaboration:** grant a board to a teammate to co-edit it together, or to another team so a coach of several teams keeps one board across them, each at viewer, editor, or owner. Open any shared board read-only from an unguessable link, or copy one into your own space to fork it.
- **History:** every save is a revision, so a board or note keeps a linear edit history, and a save that would clobber a co-editor's change is caught as a conflict to resolve instead.
- **Light and dark themes:** the interface follows the system preference and can be toggled.

## Privacy

A global admin can read all content, including users' personal boards. This is acceptable for the small, trusted group the app currently serves, and should be revisited before it is made available more widely.

## Stack

- **React 19 + TypeScript + Vite** drive the single-page app.
- **[Base UI](https://base-ui.com)** primitives styled with **[Tailwind CSS](https://tailwindcss.com) v4** build the accessible controls and overlays from one token theme.
- **SVG** renders the court, markers, and arrows as React components.
- **[Motion](https://motion.dev)** animates marker movement during playback.
- **[react-markdown](https://github.com/remarkjs/react-markdown)** renders descriptions and instructions.
- **[Supabase](https://supabase.com)** holds the database and auth. Boards and notes persist there, and every access rule is enforced by row-level security.
- **[Cloudflare Pages](https://pages.cloudflare.com)** serves the static build, published automatically once CI passes on `main`.

## Development

- See [docs/architecture.md](docs/architecture.md) for how the client fits together.
- See [docs/development.md](docs/development.md) for setup, commands, and tooling.
