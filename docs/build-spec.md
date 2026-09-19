# Build spec: a diagram authoring and sharing app

This document describes everything needed to build this app from scratch, written so the domain is a slot you fill in.
The shape is general: a single-page app where people author spatial diagrams on a playing surface, organise them into documents, share them with teams, and keep a version history.
Swap the surface and the vocabulary and the rest of the architecture stands unchanged.

Read the [TL;DR prompt](#tldr-prompt) first. The sections after it are the detail behind each line of that prompt.

## TL;DR prompt

Fill in the bracketed slots and hand this to a coding agent.

```text
Build a single-page web app for authoring, organising, and sharing [DOMAIN] diagrams.

DOMAIN SLOT
- Surface: [the playing area, e.g. a court, pitch, rink, stage, floor plan], drawn as SVG.
- Markers: [the things placed on it, e.g. players, a ball, equipment], each with a role from a
  fixed vocabulary [list the roles], a colour, and a short label.
- Domain rules: [any legality or layout rules the app should check, e.g. formation or spacing
  rules]. Skip this if the domain has none.

CORE MODEL (do not deviate)
- One `Board` type: an ordered, non-empty list of steps over a shared set of marker identities.
  A board with one step is a static Position. Two or more steps make an animated Sequence.
  The kind is derived from the step count, never stored.
- Marker identity (id, role, label, colour, side) is stored once for the whole board. Only position
  varies per step. Playback interpolates by identity, and movement arrows fall out of step-to-step
  position deltas. Neither needs its own data.
- Coordinates are normalized 0-1 over the surface, never pixels. One geometry module is the only
  place that knows about SVG units.
- One renderer component serves static and animated modes, read-only and editable.
- `Note`: a nestable document of blocks (markdown prose, and groups of board ids). A note references
  boards; boards never reference notes. Any number of notes may embed the same board.

STACK
- React 19 + TypeScript (strict) + Vite. Base UI primitives styled with Tailwind v4. Lucide icons.
  Motion for playback animation. react-markdown for prose. Vitest + React Testing Library.
- Supabase for Postgres, auth, and Edge Functions. Every access rule enforced by row-level security,
  never by the client.
- Static hosting on Cloudflare Pages. Transactional email through Resend from an Edge Function.

ACCESS MODEL
- A board or note has a creator label (attribution only) and an access list of (principal, capability)
  grants. A principal is a user or a team. A capability is viewer, editor, or owner.
- Content appears in a space's library when that space's principal holds a grant, so one board can
  live in several teams and a personal space at once. Scope is derived from grants, never stored.
- A team grant maps the team's roles, capped by the grant: a team lead gets the grant's capability,
  any member at least viewer.
- Roles: global admin, team lead, team member. Every user also has a private personal space.
- Lifecycle is reference-counted: delete detaches your grant, and a row archives only when its last
  grant goes. Archived rows are recoverable for a fixed window, then purged on a schedule.
- Every save is a revision: linear history, no branching, with compare-and-swap conflict detection.
- Read-only access by unguessable share token, plus single-use grant links and exact-email grants.

SURFACES
Library with tag and type filters, note sidebar and note pages, board view, board editor, revision
history, team management, admin panel, account settings, share view, print view, portable JSON
import/export, logged-out landing page with a no-account in-memory sandbox.

DESIGN
Light and dark themes off one CSS-variable token set. One wrapper per control in a `ui/` module, with
every class string in one file. No ad hoc styling and no handpicked values anywhere else. Restrained
motion on a single shared easing curve.

QUALITY GATES
Prettier at 120 chars, ESLint, a no-emit TypeScript check, Vitest against an in-memory backend fake,
and a SQL row-level-security regression test run against a throwaway local database. All five run in
CI on every pull request.
```

## What you are building

The app is an authoring tool, a library, and a collaboration layer over one content type.

- **Author.** Place markers on a surface, drag them, label and recolour them, draw annotations over them. Add a step to turn a static diagram into an animated one.
- **Organise.** Browse everything in a filterable grid. Write nestable documents that embed groups of diagrams inline.
- **Collaborate.** Grant a diagram to a teammate to co-edit, or to a team so its library holds it. Share read-only by link. Fork a copy.
- **Keep.** Every save is a revision with a readable diff. Deletions are recoverable for a window.

The scale to budget for, measured on a finished implementation:

| Part                        | Size                                        |
|-----------------------------|---------------------------------------------|
| Application source          | ~21,000 lines across ~195 files, 23 modules |
| Tests                       | ~9,200 lines across 68 test files           |
| Database migrations and SQL | ~3,400 lines across 25 migrations           |
| Edge Functions              | ~1,100 lines across 8 functions             |

## Tech stack

Pick these and do not substitute without a reason. The pieces were chosen to fit each other.

- **React 19 + TypeScript + Vite.** Function components and hooks only, no class components except one top-level error boundary (React offers no hook equivalent for catching render errors). TypeScript strict mode, with type errors fixed at the root rather than papered over.
- **Base UI primitives + Tailwind CSS v4.** Base UI gives menus, dialogs, popovers, tooltips, and comboboxes correct keyboard, focus, dismissal, and screen-reader behaviour by construction. Tailwind v4's `@theme` layer holds the design tokens. Base UI ships no icons.
- **Lucide (`lucide-react`)** for every interface glyph. The only hand-drawn SVG is the domain art on the surface itself and the brand mark.
- **Motion (`motion`)** for marker movement during playback, on one shared easing curve.
- **react-markdown** for descriptions and per-step instructions.
- **Supabase** for Postgres, auth, and Edge Functions. The browser holds only the public project URL and publishable key. Row-level security is the access boundary.
- **Cloudflare Pages** for the static build. There is no application server.
- **Resend** for transactional email, called from an Edge Function that holds the API key server-side.
- **Vitest + React Testing Library + happy-dom** for the unit suite.
- **Node 24**, pinned in `.nvmrc`. npm, with `package-lock.json` committed and CI installing from it.

## Services to set up

| Service            | What it provides                                        | Cost at this scale |
|--------------------|---------------------------------------------------------|--------------------|
| Supabase           | Postgres, auth, Edge Functions                          | Free tier          |
| Cloudflare Pages   | Static hosting, custom domain, TLS                      | Free tier          |
| Resend             | Transactional email (invites, password resets)          | Free tier          |
| GitHub             | Repository and Actions for CI and both deploy pipelines | Free tier          |
| A domain registrar | The custom domain                                       | Domain cost only   |

Configuration to create once:

- **CI variables** (public by design, since row-level security is the guard): the Supabase project URL and publishable key. Keeping them as CI config rather than committed files lets a second project be introduced with no code change.
- **CI secrets**: a Supabase access token, the production database password, a Cloudflare API token, and the Cloudflare account id.
- **Supabase auth settings**: the production URL registered as the Site URL and in the redirect allow-list, so login, share, and invite links resolve back to the app.
- **Supabase function secrets**: the Resend API key and the service role key. Set these by hand, never in CI.
- **A sending domain verified with Resend**, so mail leaves from your own address rather than a shared one.
- **A keep-alive schedule.** A free Supabase project pauses when idle. A scheduled CI job that calls a few anonymous-granted no-op read functions every six hours keeps it awake. Supabase's bar is a daily rate rather than one request per week, so schedule it accordingly.

## The data model

### Boards

One type backs all content. A board is an ordered, non-empty list of steps over a shared set of marker identities.

```ts
type BoardMarker = Omit<Marker, "position">; // id, role, label?, color?, side?

type BoardStep = {
  id: string;
  instruction: string; // markdown, shown during playback
  positions: Record<string, NormalizedPoint>; // by marker id
  annotations?: Annotation[]; // drawn shapes, per step, no cross-step identity
};

type Board = {
  id: string;
  title: string;
  description: string; // markdown
  mode: SurfaceMode; // which role vocabulary the palette offers
  markers: BoardMarker[]; // shared identities
  steps: BoardStep[]; // ordered, always >= 1
  tags: string[];
  createdBy: string | null; // attribution only, null once the account is deleted
  capability: Capability; // the viewer's own access, derived, never stored
  currentRevisionId: string | null; // for conflict detection
  autoArrows: boolean; // whether derived movement arrows are shown
  opponentSide: boolean; // whether the far half is drawn
  createdAt: number;
  updatedAt: number;
};
```

The client model carries only what a surface renders. The access list, revisions, and share token live in their own tables and are fetched on demand.

### Spine decisions

These are load-bearing. Most of the architecture follows from them and they are expensive to change, so fix them before writing code.

- **Normalized coordinates, never pixels.** Every position is a fraction in `[0, 1]` over the near half of the playing area. The far half, shown only when a board opts in, runs from -1 to 0, so turning it on changes no stored coordinate. One geometry module maps normalized space to SVG units and nothing above it knows about pixels.
- **Stable marker identity across all steps.** Identity is stored once for the whole board. Only position varies per step. This one decision gives you animation (interpolate by identity) and movement arrows (diff consecutive steps) for free.
- **One renderer for both modes.** A static diagram and one animated step are the same component with different props. Passing selection and move handlers makes it editable. There is no second renderer to keep in sync.
- **SVG, not canvas.** A dozen markers on a rectangle that must stay sharp on a phone and animate smoothly is exactly what SVG does as React components.
- **One board type.** Static and animated content are not separate types. A board is animated when it has more than one step.

### Pure operations

Keep every board transform in one module of pure functions that touch neither storage nor the DOM. They split along the identity-versus-position line:

- **Identity edits span every step.** Adding a marker gives it an identity and a benched position on every step. Patching role, label, or colour applies across the whole board. Removing drops the identity and its position everywhere.
- **Position edits touch one step.** Moving a marker changes one step and leaves the others alone.
- **Step edits keep the board valid.** Inserting clones the current step's positions, so only what changes needs dragging. Removing never drops below one step, so a board is never empty.

The same rule applies to any domain legality check: pure functions over the model, separate from rendering.

### Notes

A note plays two roles, kept deliberately separate. It is a document people read, and a node in an organising tree. Content lives in its blocks. Tree position lives in `parentId` and is edited only from the sidebar.

```ts
type NoteBlock =
  | { id: string; kind: "markdown"; text: string }
  | { id: string; kind: "boards"; boardIds: string[] }; // the links themselves

type Note = {
  id: string;
  title: string;
  blocks: NoteBlock[];
  parentId: string | null;
  order: number;
  capability: Capability;
  currentRevisionId: string | null;
};
```

A board carries no note reference. Which boards a note shows is decided entirely by its own blocks, so any number of notes may embed the same board and a board no note references simply lives in the library alone. There is no unfiled state, because membership is not a property a board has. An id that no longer resolves drops at render.

Derive the reverse direction (which notes reference a given board) rather than storing it, and show it on the board view as a quiet backlink row.

### Annotations

Annotations are the shapes drawn over the surface, stored as JSON on each step and rendered on every surface.

- Kinds: line, arrow (optionally curved through a control point), rectangle, ellipse, polygon, freehand stroke, and text label. Each carries a colour from the marker palette and a stroke width. Closed shapes add a fill: none, a translucent tint, or a hand-drawn hachure. Stroked shapes render solid or dashed.
- An annotation belongs to one step and has no cross-step identity, so it never interpolates during playback. Offer an explicit action to copy a step's shapes forward.
- Most kinds draw press-drag-release with magnetic snapping. The polygon is the one multi-click gesture. Simplify a freehand stroke on commit.
- Normalize legacy shapes at read time rather than migrating stored data.

## Backend and access control

### Tables

- `profiles`: one row per account, with a display name, a global-admin flag, and the terms acceptance stamp. The email column is personal data. Make it case-insensitively unique and never grant it to an ordinary client, so no query returns another user's email.
- `teams` and `memberships`: a membership is `(user, team, role)` with role `lead` or `member`. A user has at most one role per team.
- `boards` and `notes`: markers and steps as JSON on the board row, blocks as JSON on the note row.
- `board_access` and `note_access`: one row per grant, each a `(principal, capability)` pair. Exactly one principal column is set (user or team). Capability is `viewer`, `editor`, or `owner`.
- `invites`, `access_links`, `access_requests`, `feedback`: invite links with a use count, single-use grant links, interest submitted from the landing page, and in-app bug reports.
- `board_revisions` and `note_revisions`: one append-only content snapshot per commit, with its author, time, and the revision it was based on. The content row points at its current revision.

Boards, notes, teams, and profiles all carry soft-delete state (`deleted_at`, `deleted_by`). Every read query filters `deleted_at is null`.

### Row-level security

The access boundary is in the database. Every rule holds even if the client is bypassed, so the client is never trusted.

- Write `security definer` helper functions that return the caller's highest capability for a row, plus membership and admin predicates. `security definer` lets a policy resolve a grant without recursing through the policy it is evaluating.
- Policies read through those helpers: select with any capability, update with editor or owner, change the access list only with owner. Add one exception: anyone may always remove their own grant, which is how leaving works.
- Rank the three capabilities with a small function so a policy can compare them.
- A guard trigger keeps the creator label immutable except to an admin. Adding a team grant requires leading that team, so content cannot be pushed into an arbitrary team's library.
- Grant table access to the authenticated role deliberately, table by table. Turn off automatic exposure of new tables.
- A trigger on the access list grace-archives a row once its last grant is gone. That is what makes delete mean detach.

Who may do what:

| Action                                | Member | Lead | Admin           |
|---------------------------------------|--------|------|-----------------|
| View content granted to their team    | yes    | yes  | yes, every team |
| Edit content their team holds         | no     | yes  | yes             |
| Co-edit content granted to them       | yes    | yes  | yes             |
| Their own personal space              | full   | full | full            |
| Invite a member                       | no     | yes  | yes             |
| Create a team                         | yes    | yes  | yes             |
| Archive or delete a team              | no     | no   | yes             |
| Restore deleted content or an account | no     | no   | yes             |

A global admin reading all content, including personal spaces, is a deliberate privacy trade-off for a small trusted group. State it plainly in the README and the terms, and revisit it before opening the app up.

### RPCs and Edge Functions

Use a `security definer` RPC whenever the client must not hold the authority the operation needs.

- **Commit.** The board and note commit RPCs are compare-and-swap writes. The editor passes the revision it started from, and the write lands only while that is still current. A stale base returns a conflict the editor resolves (overwrite, save a copy, or discard) instead of silently clobbering a co-editor.
- **Share token resolution.** A function granted to the anonymous role resolves one row from an exact token, but only a genuinely shared one. A private row never leaks and the collection cannot be enumerated.
- **Exact-email grants.** Resolve and grant in one server step. Run the owner check before and independent of the email lookup, and return nothing whether or not an account matched, so a miss is indistinguishable from a hit. Otherwise you have built an account-existence oracle.
- **Invite preview.** Reveal the team and role only while the link has a use left and has not expired.
- **Soft delete of a subtree**, and the admin-only team delete.
- **Purge.** A function that hard-deletes rows past the recovery window, granted to the service role only and never reachable from a client.

Edge Functions are for work that needs the secret key or a third-party key:

- Redeem an invite: claim one use atomically so two people racing the last use see one winner, create the account if the recipient is new, and add the membership.
- Send an invite: mint an ordinary invite row as the caller, so the insert policy and quota trigger apply exactly as for a copied link, then email its link. Delete the row if the send fails, so a slot is reserved only when mail actually goes out.
- Request a password reset: mint the auth provider's own recovery link under the secret key and email it. Return the same uniform success for a missing account and a failed send, so the endpoint reveals nothing.
- Delete an account: ban the auth user and soft-delete the profile. Content only they held archives. Content a team still holds lives on.
- Restore an account, record an access request, record feedback, and run the scheduled purge.

### Sharing

Sharing is editing the access list, not copying.

- An owner adds a grant for a user (co-editing one board) or a team (placing it in that team's library), at viewer, editor, or owner. Multiple grants are how one board stays in several libraries at once. Copy remains, but as a deliberate fork into a separate board.
- The add-a-person picker is **relationship-scoped**: it offers only the sharer's teammates, grouped by team and searchable, and never loads a global accounts table. People are named by display name, never email.
- Sharing outside your teams works two ways, neither of which enumerates accounts or returns an email. A **grant link** is a single-use, expiring, revocable token carrying the target and a capability, bound to the first signed-in user who redeems it. An **exact-email grant** resolves and grants server-side with no oracle, as above.

### Auth and invites

- Invite-only email and password. There is no open sign-up. The sign-up side of the form collects an access request that an admin works from, and an account is only ever created server-side by the redeem function.
- A logged-out visitor sees a landing page. A valid share or invite link still opens directly, ahead of the landing.
- An invite link carries a team and role, a use count, an expiry, and a server-minted token. Single-use by default, and raising the count lets one link onboard a whole group. Every grant it carries applies per redeemer.
- Charge any quota per use. A link that can still create an account reserves all of its uses, and once it expires or runs out it charges only the accounts it created, which releases the rest.
- Forgotten passwords need no invite. Reset is self-service through the oracle-safe function above.

## Frontend architecture

### Module map

One folder per concern, each named for what it owns.

- `boards/`: the model, pure operations, the backed store, the playback hook, derived arrows, domain legality checks.
- `surface/`: the SVG renderer, markers, arrows, the annotation layer and its gestures, normalized geometry, the role and colour palette, pointer dragging.
- `editor/`: the read-only view and the draft editor, plus the marker palette, inspectors, annotation toolbar, step strip, settings popover, and the description editor.
- `bundle/`: the portable JSON format (types, serialize, parse), the export menu, and the import and replace dialogs.
- `print/`: a chrome-free print surface that renders a board or note as a paper handout.
- `library/`: the browse surface, grid, cards, and type and tag filtering.
- `notes/`: the tree model, operations, store, sidebar, the note view and editor, and backlinks.
- `history/`: the revision list, read-only revision views, the structured diff, and revision-loading hooks.
- `theme/` and `ui/`: the theme hook, and one wrapper per control that every surface renders through.
- `supabase/`, `auth/`, `account/`, `workspace/`, `team/`, `admin/`, `feedback/`, `invites/`, `sharing/`: the client and row mappers, the auth gate, account settings, active-space state, team management, the admin panel, the feedback form, the invite flow, and the sharing flows.
- `legal/`: the terms and privacy notice and its public page.
- `routing/`: hash-route parsing, the current-route hook, typed link builders, title slugs, and the not-found page.
- `shell/`: the app shell, sidebar, icon rail, drawer, top bar, breadcrumb, space switcher, account menu, error boundary, and brand mark.
- `landing/`: the logged-out page, the auth modal, the request-access form, and the no-account sandbox.

### State and persistence

- One store per content type holds the active space's list in React state and exposes the mutations the UI calls. Both load by the space's principal on the access list and attach the viewer's capability to each item.
- Content edits write through the commit RPC. Access-list edits write to the access tables. Apply edits optimistically, surface a failed write as an error, and refetch to reconcile.
- The active space comes from a workspace hook that loads the user's teams, role per team, and admin flag, and tracks which space is on screen.
- Keep the two models honest. A note's board groups carry their own explicit order, so curating a note never touches a board. Structural note moves touch only the note tree.

### Routing and the shell

- Parse the URL hash into a typed route union and expose it as a hook. Build every link through typed builders, never string concatenation. Slug titles for readable URLs.
- A share or invite link wins over everything, since both open with no account. Otherwise an unauthenticated visitor sees the login gate.
- After sign-in, two one-time gates can precede the app: an invite recipient sets a password, and a first-time user sets a display name.
- Past the gates, choose the surface by precedence: a draft in the editor wins, then an open board's view, then the browse surface.
- Wrap the whole app in a top-level error boundary so a render failure shows a recover screen rather than a blank page.
- On a static host, ship a rewrite rule that serves `index.html` for every path, or deep links 404. Cache hashed asset bundles forever and make the entry document always revalidate, so a deploy never serves a returning visitor a stale shell.

### The view-first, edit-draft flow

- Open into a read-only view. Edit a local draft. Done commits, Cancel discards. Nothing reaches storage mid-edit.
- Track the active step by id, not index, so inserting, reordering, or removing never loses the user's place.
- A single-step board shows an affordance that promotes it to multi-step in place, cloning the current positions. The step strip appears only once there are two or more.

### Playback

- One hook owns which step is shown and whether playback is running, and exposes play, pause, jump, and next and previous.
- Each advance allows time for the glide plus a dwell to read the new step. Stop on the last step rather than looping. Starting from the end replays from the first step.
- Honour reduced-motion preferences: the same controls still step through without animation.
- Derive movement arrows from consecutive steps and recompute on demand. Never store them. Drop moves too small to matter, and skip an arrow too short to clear both markers.

### Portable bundles

A versioned JSON format that round-trips notes and boards in full, carrying no server-owned fields (creator, access list, revisions, tokens, timestamps).

- Items reference each other through opaque local refs that resolve within the bundle only. Import mints fresh ids.
- Keep one types module as the single source of truth and bump the format version when the shape changes. An older bundle normalizes on parse with a notice. A newer one is rejected as the app being out of date.
- Be strict on structure and lenient on content. Malformed JSON and unknown refs become readable errors. An out-of-range coordinate clamps, a missing position benches its marker, and an invalid annotation is dropped, each with a notice rather than a failure.
- Export at three levels (one board, one note subtree, a whole space) and offer both copy and download. Viewing rights suffice, so any user can take everything they can see.
- Import parses as it arrives and shows either the validation errors or a preview. Nothing is written until the user confirms.

## Design system

### Tokens

Everything visual comes from one token set. No surface picks a value.

- Put static tokens (fonts, easing, radius, shadow, type scales, layout widths) in a Tailwind `@theme` layer.
- Map each colour utility onto a runtime CSS variable through `@theme inline`, then redefine those variables per `data-theme` attribute on the document. A utility like `bg-panel` then follows the light and dark switch with no `dark:` variants anywhere.
- Name every step of every scale: type, radius, shadow. Never inline an arbitrary value and never hand-pick a one-off to make a single component fit. If no token exists for a role, add one to the shared source.
- Keep the playing surface's own palette theme-independent and out of the swap. A diagram should look the same in both themes, with the chrome around it doing the theming.

### Colour

- Pick the marker palette in OKLCH, in a narrow lightness band, avoiding the red and green hue ranges so roles stay distinct under protan, deutan, and tritan colour-blindness and never collide with the danger colour. Derive each ring as the fill about 0.14 lightness darker.
- Offer a curated recolour palette rather than a free colour picker, and match its entries to the role defaults so a recoloured marker resets cleanly. Keep retired colour keys loading (remapped) so old content keeps rendering.
- Give floating overlays their own elevated surface token, distinct from both the page background and the diagram surface, so a popup reads as the lightest layer in light mode and clearly lifted in dark.

### Controls

- One thin wrapper per control in a `ui/` module: button, input, select, combobox, menu, tabs, dialog, alert dialog, popover, tooltip, toolbar, table, toggle, checkbox, field, side panel. Every surface renders through them, so each control has one definition.
- All shared class strings live in one file. No surface styles a control ad hoc.
- A recurring structure (a table, an overlay, a list row) gets a shared component rather than markup reassembled at each call site.
- Button hierarchy: one primary per view, a bordered ghost for secondary, and a text or icon button for quiet actions. A destructive action is quiet in a row or menu, bordered when it is the main action of its surface, and filled for the confirm inside a modal. Never fake a destructive button with ad hoc classes.
- A quiet button paired with a prominent one in the same action row matches its height, font size, and radius while keeping quiet chrome. Hierarchy comes from fill versus quiet, not size.
- **Use pickers over controls that reveal every option.** A control that shows all its options fits a set bounded by design. When the set grows with the data, scope it to a relationship, filter an already-loaded scoped set, search server-side with a limit, or give it a dedicated paginated page.
- Size a control to its content, not its container. Only genuinely long or free-form values earn full width.
- A list row leads with what identifies the item, not its controls.

### Typography and motion

- Pair a display family for headings, a humanist sans for the interface, and a monospace for marker labels.
- Keep motion restrained and run everything on a single shared easing curve. During playback, glide the marker's outer group between steps and put any entrance animation on an inner group, so animating a position never fights the entrance.

### Brand

- Draw the mark from the product itself, so the logo and the app cannot drift. Keep it to line plus one solid accent, with no shading.
- Put the geometry in **one source module** with the proportions as ratios. Render the in-product mark live from it, and generate every static asset (favicon, maskable icon, link-preview card, and their rasters) from the same source with a script. Never hand-edit a generated asset.
- The in-product mark is monochrome and theme-aware: the line draws in `currentColor` and one accent colour stays constant. A baked raster cannot swap with the theme, so give it one fixed expression.
- The favicon is transparent, maximised to touch all four edges, with a `prefers-color-scheme` rule swapping the line colour.
- Pair the mark with the wordmark as one locked lockup, never re-spaced per surface. Fix the mark-to-text ratio, the gap, and the clear space once.

## Quality gates

Five checks, all of them in CI on every pull request, and all of them runnable locally.

- **Prettier** at 120 characters. Never break lines by hand.
- **ESLint** with the TypeScript, React, and React Hooks rule sets. Do not disable a warning without a deliberate decision.
- **A no-emit TypeScript check** under strict mode, with unused locals and parameters and fall-through cases treated as errors.
- **Vitest + React Testing Library**, fast and dependency-free. Test against a small in-memory fake of the backend client that models the access list so a space's content reads by principal as it would server-side. Mock only external dependencies, never your own components, hooks, or utilities. Query by accessible role, label, and text, and drive interactions with a user-event library. Parametrize to keep the suite small.
- **A SQL row-level-security regression test.** Build a fresh database from the branch's migrations and seed in Docker, run the test inside it, tear it down. This is what stops a policy regression from reaching production, and it must run on the branch's own schema, not a shared one.

Keep the row-level-security test out of the unit suite so the unit suite stays fast and needs no Docker.

## Local development

- Run the backend locally in Docker from the migrations plus a local-only seed. The seed is fixtures, never applied to production.
- Seed three accounts covering the three roles, plus a demo team with a small sample library. Give them one shared password.
- Make the dev server auto-sign-in as a default seeded account, with a quick-switch button per account on the gate. Load the credentials only when serving, so they never reach a production build. Read any non-local credentials from a file outside the repo.
- Offer three dev modes that differ only in which database they target: the shared local stack built from the default branch, the production database (used sparingly), and a throwaway stack built from the current branch's migrations for trying a migration before it merges.
- Split the heavy vendor libraries into their own build chunks so they cache independently and the app chunk stays small.

## Deployment

Two separate, CI-gated paths, both waiting for CI to pass on the default branch. Nothing reaches production from feature work.

- **Front end.** Publish the static build to the host after CI passes. Run on the workflow-completion event and check out the exact commit CI verified, so only green commits reach production.
- **Database migrations.** Push migrations on merge through the same gate, authenticated by an access token and the database password. Flag any pull request touching the migrations folder with a label and a comment, so the migration is seen before merge. Merging after that warning is the deliberate act.
- **Edge Functions.** Deploy all functions on merge through the same gate. Deploying all of them rather than diffing the merged commit is correct: a per-commit diff misses a change made in an earlier commit of a squashed or rebased pull request, and re-uploading an unchanged function is a no-op.
- **Function secrets stay manual.** They change rarely, and CI should never hold them.

## Build order

Each phase ends with something usable. Do not start the next until the current one runs.

1. **The surface.** Geometry and normalized coordinates, the role palette, the renderer, markers, pointer dragging and selection. Local state only, no persistence. This phase decides the spine, so get it right before anything depends on it.
2. **The model and the editor.** The board type, the pure operations, the draft editor, the marker palette and inspector, the description editor. Persist to browser storage so the loop is usable end to end.
3. **Steps and playback.** Promote a board to multi-step, the step strip, the playback hook, derived arrows, per-step instructions.
4. **Library and notes.** The grid, thumbnails, tag and type filters, the note tree, the note view and editor, backlinks.
5. **The backend.** Schema, row-level security, the stores, auth, teams, the space switcher, the seed, and the row-level-security test. This is the largest phase. Do not defer row-level security to the end: write the policies with the tables.
6. **Sharing and access.** The access list, the capability helpers, the access managers, the relationship-scoped picker, share tokens, grant links, exact-email grants, copy-as-fork.
7. **Lifecycle and history.** Soft delete, reference-counted archiving, the recovery window, the purge schedule, revisions, conflict detection, the history view and diff.
8. **Invites and email.** Invite links, the invite flow, the Edge Functions, password reset, the admin panel.
9. **The public edge.** The landing page, the no-account sandbox, the terms page, the request-access form, feedback, print, and portable bundles.
10. **Design pass and brand.** Tokens, the control wrappers, the theme, the mark and its generated assets. Run this in parallel from phase 2, not at the end.

## Decisions to lock before you start

These are cheap now and expensive later.

- Normalized coordinates, and one module that owns the mapping to screen units.
- Marker identity stored once, position per step.
- One content type with a derived kind, not separate static and animated types.
- Access as a list of grants, with the space derived from them. Anything that stores a single owning scope on the row will have to be rewritten the first time content needs to live in two places.
- Delete means detach, with archiving reference-counted by a trigger.
- Every write goes through a compare-and-swap commit that records a revision.
- Row-level security as the only access boundary, written alongside the tables and covered by a regression test from the first migration.
- One token set and one wrapper per control, enforced from the first screen.

## Writing rules worth adopting

The same rules apply to documentation, interface copy, titles, comments, and commit messages.

- Every sentence carries concrete content. Cut anything whose only job is to assert importance.
- Be concise. Cut words that add length without information, and say each point once.
- Write plain subject-verb-object sentences. Split a compound thought in two. Use the punctuation mark that does the job you mean: a colon introduces, a period ends. Stacked em dashes, semicolons, and commas are the main tell of machine-written prose.
- Keep titles short and factual. No hype, no title-colon-subtitle patterns.
- Use comments sparingly, only for a complicated block or an unusual line. A comment describes the current code, never what changed.
