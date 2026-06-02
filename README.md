# VolleyCoach

VolleyCoach is a web app for building and sharing animated volleyball tactics and drills. Place and drag markers on a court to lay out formations, then chain them into drills that play back as smooth animations. Everything lives in a searchable library, and any single tactic or drill can be opened from a share link with no account needed.

> **Status:** early development. The repository is the project scaffold, and none of the features below are built yet. See [plans/project_overview.md](plans/project_overview.md) for the full scope, architecture, and phased build plan.

## Planned features

- **Court editor**: place, drag, and label markers on a normalized court that stays crisp on phone and laptop.
- **Tactics**: save static formations with a category, situation tag, and notes.
- **Drills**: chain steps with per-step instructions, played back as animation with auto-derived movement arrows.
- **Library**: browse, search, and filter tactics and drills by category, situation, and session.
- **Sharing**: open a single tactic or drill from an unguessable share link, no account required.
- **Roles**: coaches edit everything, players view the whole library read-only, and link viewers see one item.

## Stack

The intended stack is React + TypeScript + Vite, with SVG court diagrams, [Motion](https://motion.dev) for animation, and [Supabase](https://supabase.com) for the database and auth. Planned hosting is a static front end on Cloudflare Pages or Vercel with the Supabase managed tier. These services are not configured yet.

## Development

See [docs/development.md](docs/development.md) for setup, commands, and tooling.
