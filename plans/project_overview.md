# VolleyCoach — Product & Build Plan

VolleyCoach is a private, invite-only web app for building, browsing, sharing, and animating volleyball tactics and drills. Accounts are organised into teams, each with its own shared library, and every user also has a private personal workspace. Coaches author diagrams on a volleyball court; players view and play them back; anyone with a share link can open one specific item, read-only. It is a single-page app, and diagram positions are stored resolution-independently so the same diagram stays crisp on a phone and a laptop.

## The product

### Content types

There are two content types that share almost all of their code, rendering, and storage. The only real difference is static vs. animated:

- **Tactic — a static position.** A single arrangement of markers on the court, e.g. base defence against an outside attack. (The name is provisional.)
- **Drill — a multi-step sequence.** An ordered list of steps that plays back as an animation.

Both carry:

- a title and a **markdown** description,
- organising tags (see [Library](#library)),
- a set of markers (see [The court and markers](#the-court-and-markers)),
- an author, a timestamp, and a home space (team or personal),
- a share token (see [Sharing](#sharing)).

They differ only in their markers:

- A **tactic** has one set of markers.
- A **drill** has an ordered list of steps, each with its own instruction and the marker positions for that step. Marker identity is stable across steps, so playback interpolates each marker from one step to the next by identity, and **movement arrows are derived from the deltas between steps** — there is no separate arrow data to author.

### The court and markers

- **One court component renders both modes** — a static tactic and a single drill step are the same view with different inputs.
- **Coordinates are normalized 0–1, never pixels**, so positions are resolution-independent.
- **Markers** cover the players and the ball (and similar objects as defences need them).
    - A marker's **role** drives its colour and a default label.
    - The exact roles, the labelling convention (e.g. MB1/MB2), and the court extent and aspect ratio are build-time details, decided once we can see the product on screen.

### People, teams, and spaces

Accounts are organised into **teams**, and content lives in one of two **spaces**:

- **Team space** — a team's shared library, visible to its members and curated by its coaches.
- **Personal space** — a user's private workspace, visible only to them until they share an item.

Access has these tiers:

- **Global admin** — an app-level flag on a normal account. Creates teams, invites anyone into any team, manages all memberships, and has full read/write access across every team. Can grant admin to others. The first admin is bootstrapped by hand; everything after is self-serve in the app.
- **Coach** — a per-team role. Creates, edits, and organises their own team's library, and invites people into that team.
- **Player** — a per-team role. Full view and playback of their team's library; strictly read-only.
- **Share-link visitors** — no account. Can open the single item a link points to, read-only. They never get the library or the browse view.

A user may belong to several teams with a different role in each, and the admin flag is orthogonal to team membership.

#### Accounts and roles

- **Invite-only.** There is no public signup. An admin invites into any team; a coach invites into their own team. An invite always targets a team with a role.
- **Per-team roles.** Each membership is a `(user, team, role)` link, role being coach or player. A coach (own team) or an admin assigns roles.
- **Author lock.** A coach can lock a team board they authored so only they and admins can edit or delete it.

### Sharing

- Every tactic and drill has its own shareable link, backed by an **unguessable token** that resolves to exactly that one item — the collection cannot be enumerated from a link.
- **Read-only is enforced server-side** for both players and link visitors, not merely hidden in the UI.

### Library

- Coaches and players browse the full library and **filter by organising tags** — category, situation (for tactics), and session (for drills).
- The exact tag values are coach-managed content, not fixed here.

### Playback and animation

- A drill can be **stepped through** one step at a time, and **played back** as a smooth animation.
- Animation interpolates marker positions between steps by identity (via Motion); **movement arrows are derived automatically** from step-to-step deltas.

## Architecture and stack

| Layer                    | Choice                             |
|--------------------------|------------------------------------|
| Framework                | React + TypeScript + Vite          |
| Court / markers / arrows | SVG, as React components           |
| Animation                | Motion                             |
| Backend (DB + auth)      | Supabase                           |
| Hosting                  | Cloudflare Pages / Vercel (static) |

### Why this shape

The real work is the SVG editor and the step animation; the backend is a low-stakes "BaaS with auth" choice. Supabase gives a free tier, built-in auth, and a well-trodden "signed-in users plus anonymous read-only by token" pattern.

### Spine decisions (do not relitigate)

These are easy to get wrong and expensive to change, so they are fixed:

- **Normalized 0–1 coordinates, never pixels.**
- **Stable marker identity across all steps** — the single decision that makes playback and derived arrows nearly free.
- **One court component for both modes.**
- **SVG, not canvas/Konva** — ~12 markers on a rectangle that must stay crisp on phones and animate smoothly. Konva would only pay off if the editor grew into a heavy multi-object scene with resize/snap.

### Hosting and operations

- The static front end deploys from GitHub to Cloudflare Pages or Vercel (free).
- Supabase runs on the managed free tier.
- **Keep-alive:** the free tier pauses a project after 7 days without database activity, and recovering needs a manual dashboard restore (it does not auto-wake on a visit). A scheduled **GitHub Action** pings the database a few times a week so the project never pauses.

## Building it

A few big phases, each of which gets its own detailed sub-plan when we reach it. The backend stays out of the picture until the app already works well in dev — the real work is the editor and the animation, and there is no reason to take on Supabase, auth, and hosting before that is solid.

### Phase 1 — The product, working in dev

Build the whole interactive app client-side, with local/in-memory state and no backend, until it genuinely feels good on screen:

- The court and the normalized coordinate system (rendered first, so the coordinate foundation is locked before anything depends on it).
- The tactic editor: place, drag, label, and recolour markers, and edit the markdown description.
- Drills: author ordered steps, step through them, and play them back as animation (Motion) with auto-derived movement arrows.
- The library: browse and filter by organising tags.

### Phase 2 — Backend, auth, and sharing (Supabase)

Once the dev app is solid, give it persistence and access control:

- The Supabase project and schema (boards and topics with owner, scope, team, and share token; markers and steps stored as JSON), wired to the editor for save and load.
- **Auth and row-level security**: invite-only accounts organised into teams, a global admin plus per-team coach/player roles, ownership, team isolation, token-based read, and server-side read-only enforcement.
- The two spaces: a coach-curated library per team and a private personal workspace per user, with sharing and coach promotion between them.
- The share-token route and its read-only viewer.
- The keep-alive GitHub Action.

### Phase 3 — Deploy and operate

- Deploy the static front end from GitHub to Cloudflare Pages or Vercel.
- Verify the full flow on a real phone, including opening a share link.
- A final pass auditing RLS so read-only access and per-item sharing hold server-side.

## Deferred decisions

Recorded here so they are made deliberately at build time rather than by accident:

- Court extent and aspect ratio (full court, or one half with net and attack line).
- The exact marker roles and labelling convention.
- Whether the editor is fully usable on phones or desktop-first.
- The category / situation / session tag values.
