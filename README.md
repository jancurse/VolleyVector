# VolleyVector

VolleyVector is a single-page web app for building, browsing, organising, and animating volleyball tactics and drills. Each tactic or drill is a board, a court where players and the ball hold a single position or move through a sequence. A board can be shared with a whole team or a few friends to develop it together.

The code is written entirely by Claude Code.
The app is live at [volleyvector.app](https://volleyvector.app), invite-only for now.

<p align="center">
  <img src="docs/rotation-showcase.gif" alt="Editing a 5-1 rotation in VolleyVector: receivers drag into place and the overlap rules flag an illegal lineup live" width="760">
</p>

## Features

- **Court editor:** place, drag, label, and recolour markers on a normalized court that stays crisp from phone to laptop. Nudge a selected marker with the arrow keys.
- **Positions and Sequences:** every board is one court diagram. A single step is a static Position. Adding steps promotes it in place to an animated Sequence.
- **Playback:** step through a Sequence, or play it back as a smooth animation. Movement arrows are derived automatically from how markers move between steps.
- **Markdown:** each board carries a markdown description, and each step its own markdown instruction. Both use a Write/Preview toggle.
- **Notes:** nestable written documents that mix markdown prose with embedded groups of boards. Any number of notes may reference the same board, and a board lists the notes it appears in.
- **Library:** browse every board as a grid of court thumbnails. Filter by type (All, Positions, Sequences) and by tags.
- **Try it without an account:** a logged-out visitor sees a landing page and can build a board in an in-memory sandbox before signing in.
- **Accounts and teams:** invite-only sign-in with self-service password reset, and a display name shown on the boards and notes you share. Any account can create a team, and its coach grows it by inviting members by email or a single-use link. Per team, coaches curate the library and players view it read-only.
- **Account and team lifecycle:** anyone can delete their own account, and an admin can archive or delete a team. Deleted boards, notes, teams, and accounts are kept for a three-month recovery window before they are purged.
- **Spaces:** every user has a private personal space, and each team has a shared library. A board or note can be granted to several teams and to individual users at once, so it lives in every library that holds it rather than in one.
- **Sharing and collaboration:** grant a board to a teammate to co-edit it together, or to another team so a coach of several teams keeps one board across them, each at viewer, editor, or owner. Share outside your teams with a single-use grant link or to an exact email. Open any shared board read-only from an unguessable link, or copy one into your own space to fork it.
- **History:** every save is a revision, so a board or note keeps a linear edit history, and a save that would clobber a co-editor's change is caught as a conflict to resolve instead.
- **Light and dark themes:** the interface follows the system preference and can be toggled.

## Stack

- **React 19 + TypeScript + Vite** drive the single-page app.
- **[Base UI](https://base-ui.com)** primitives styled with **[Tailwind CSS](https://tailwindcss.com) v4** build the accessible controls and overlays from one token theme.
- **[Lucide](https://lucide.dev)** provides the interface icons.
- **SVG** renders the court, markers, and arrows as React components.
- **[Motion](https://motion.dev)** animates marker movement during playback.
- **[react-markdown](https://github.com/remarkjs/react-markdown)** renders descriptions and instructions.
- **[Supabase](https://supabase.com)** holds the database and auth. Boards and notes persist there, and every access rule is enforced by row-level security.
- **[Resend](https://resend.com)** sends the transactional email (invites and password resets) from Supabase Edge Functions.
- **[Cloudflare Pages](https://pages.cloudflare.com)** serves the static build, published automatically once CI passes on `main`.

## Privacy

A global admin can read all content, including users' personal boards. This is acceptable for the small, trusted group the app currently serves, and should be revisited before it is made available more widely.

The app shows a plain-language [Terms & Privacy](src/legal/legalText.ts) notice at `/terms`, linked from the login screen and the account menu. Every new account must accept it during signup. It states that the app is provided as-is with no warranty, what data is stored and where (Supabase and Cloudflare), the admin-can-read-everything trade-off above, and how to have data removed.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to build, run, and contribute.
