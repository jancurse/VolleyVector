# VolleyCoach

VolleyCoach is a single-page web app for building, browsing, organising, and animating volleyball tactics and drills. A coach lays out players and the ball on a court and writes a markdown description. A single arrangement is a static **Position**. Chaining several steps makes a **Sequence** that plays back as a smooth animation, and its movement arrows are derived from the steps. Boards are organised into a coach-curated tree of topics and filtered by tags.

> **Status:** in development. The full interactive app runs in the browser, and boards and topics persist to a Supabase backend behind invite-only accounts. Accounts are organised into teams, each user also has a private personal space, and a board can be opened read-only from a share link. Access is enforced in the database by row-level security. Deployment is not wired up yet.

## Features

- **Court editor:** place, drag, label, and recolour markers on a normalized court that stays crisp from phone to laptop. Nudge a selected marker with the arrow keys.
- **Positions and Sequences:** every board is one court diagram. A single step is a static Position. Adding steps promotes it in place to an animated Sequence.
- **Playback:** step through a Sequence, or play it back as a smooth animation. Movement arrows are derived automatically from how markers move between steps.
- **Markdown:** each board carries a markdown description, and each step its own markdown instruction. Both use a Write/Preview toggle.
- **Topics:** organise boards into a nestable, coach-curated tree, each with its own markdown explanation. A board has one home topic or sits Unfiled.
- **Library:** browse every board as a grid of court thumbnails. Filter by type (All, Positions, Sequences) and by tags.
- **Accounts and teams:** invite-only sign-in. A global admin creates teams and invites anyone; per team, coaches curate the library and players view it read-only.
- **Two spaces:** each team has a shared library, and every user has a private personal space (My Boards / My Topics) only they can see.
- **Sharing:** share a personal board into a team and open any board read-only from an unguessable link. A coach can copy or move a shared board into the team library, and anyone can copy one into their own space.
- **Light and dark themes:** the interface follows the system preference and can be toggled.

## Privacy

A global admin can read all content, including users' personal boards. This is acceptable for the small, trusted group the app currently serves, and should be revisited before it is made available more widely.

## Not built yet

- **Deployment** of the static front end against the managed backend.

## Stack

- **React 19 + TypeScript + Vite** drive the single-page app.
- **[Base UI](https://base-ui.com)** primitives styled with **[Tailwind CSS](https://tailwindcss.com) v4** build the accessible controls and overlays from one token theme.
- **SVG** renders the court, markers, and arrows as React components.
- **[Motion](https://motion.dev)** animates marker movement during playback.
- **[react-markdown](https://github.com/remarkjs/react-markdown)** renders descriptions and instructions.
- **[Supabase](https://supabase.com)** holds the database and auth. Boards and topics persist there, and every access rule is enforced by row-level security. Static hosting is planned but not wired up yet.

## Development

- See [docs/architecture.md](docs/architecture.md) for how the client fits together.
- See [docs/development.md](docs/development.md) for setup, commands, and tooling.
