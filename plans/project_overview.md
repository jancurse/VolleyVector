# Volleyball Tactics & Drills — Stack & Scope

## Bottom line

Build it as a single-page web app: **React + TypeScript + Vite** on the front end, the court and markers drawn in **SVG** (not canvas), animation between drill steps via **Motion**, and **Supabase** (Postgres + Auth) as the backend. Static front end on Cloudflare Pages or Vercel; Supabase managed free tier.

| Layer                    | Pick                              |
|--------------------------|-----------------------------------|
| Framework                | React + TS + Vite                 |
| Court / markers / arrows | SVG, rendered as React components |
| Drill animation          | Motion                            |
| Backend + DB + auth      | Supabase                          |
| Static hosting           | Cloudflare Pages / Vercel         |

## Backend choice

A low-stakes call — for one team's tool with document-shaped data and simple permissions, any mainstream BaaS does this, and the SVG editor plus the step animation is most of the real work regardless. Supabase covers every requirement, the SQL permission model is no obstacle, and its large ecosystem means the "authenticated users plus anonymous read-only by token" pattern is well-trodden. If the library data is ever worth querying (most-run drills, tag overlap), Postgres is the right home for it.

Worth knowing, not decisive: **Appwrite** (per-document deny-by-default permissions map the public/private split a touch more directly), **PocketBase** (only if self-hosting everything on one box appeals).

## Architectural decisions to honour

These are the choices the implementing agent should not relitigate, because they're the spine of the app and easy to get wrong:

- **Normalized 0–1 coordinate space**, never pixels. The same diagram then renders correctly on a phone and a laptop, and drag positions are resolution-independent.
- **Every marker keeps a stable identity across all steps of a drill.** This is what makes playback nearly free: the animation interpolates each marker's position from one step to the next, matched by identity. Movement arrows fall out as the delta between consecutive steps.
- **One court component renders both modes** — a static tactic and an animated drill step.
- **SVG, not canvas/Konva.** This is ~12 markers on a rectangle that must stay crisp on phones and animate smoothly between steps; SVG wins on both. Konva would only earn its place if the editor later grew into a heavy multi-object scene with resize/snap.

## What the system stores

Conceptual shape only — schema and storage are the implementing agent's call:

- A **tactic**: title, category, situation tag, a short note, a set of markers (each with identity, normalized position, label, and role), a share token, a published flag, author, timestamp.
- A **drill**: title, category, session, and an ordered list of steps — each step carrying a text instruction and the marker positions for that step (arrows optional, derivable from step deltas) — plus a share token, published flag, author, timestamp.

Role drives marker colour and default label (S, MB, OH, OPP, L).

## Roles, auth, and sharing

Auth is required. Three tiers of access:

- **Coaches** — account; create, edit, and organise all content.
- **Players** — account; full view and playback of the library; read-only, no editing.
- **Anyone with a share link** — no account; can open the single tactic or drill that link points to, read-only. They do not get the full library or full view — that is reserved to signed-in players and coaches.

Each tactic and drill has an unguessable share token and its own URL (e.g. `/t/:token`, `/d/:token`). The no-account link resolves through a **server-side lookup keyed on the token**, so it returns only that one item and the collection can't be enumerated. Read-only is enforced server-side for both players and link viewers — not just hidden in the UI.

Concurrent editing by multiple coaches works through shared auth. Live simultaneous co-editing of the same item is not required; if it ever became one, that is the single place a reactive backend (Convex) would beat Supabase.

## Build phases

Each phase is shippable and de-risks the next:

1. Static court + markers — locks the coordinate system.
2. Tactic editor (place, drag, edit, save) — content type #1, end to end.
3. Library — browse and search/filter by category / situation / session.
4. Share + read-only viewer (token route), verified on a phone.
5. Drill model — steps, per-step instruction, step-through.
6. Playback animation + auto-derived arrows.
7. Auth and access-rule lockdown.

## Hosting

Static front end on Cloudflare Pages or Vercel (free, deploy from GitHub); Supabase managed free tier; self-host later if wanted, since the stack is open-source.

## Rough effort

A focused weekend covers phases 1–4 (tactics, library, sharing) as a usable tool. Drills with step-through and playback (5–6) are another solid weekend. Auth and access lockdown (7) is a few hours. Playback is the easy part once the coordinate-and-stable-identity foundation is right — which is why that foundation comes first.
