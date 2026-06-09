# App Shell & Navigation Redesign

## Implementation Agent Instructions

- **Role**: A design-led senior frontend engineer for a React 19 + TypeScript + Vite SPA, fluent in information architecture and Base UI + Tailwind.
- **Task**: Replace the app's ad-hoc top-bar chrome with a deliberate, persistent shell: a left sidebar, a slim contextual top bar, real path-based URLs, and full pages in place of the mega-modals.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature. Do not touch the court visuals or the colour palette.
    - Write clean, easy-to-maintain code. Route everything through the existing `src/ui/` wrappers and the tokens in `src/index.css`; do not style controls ad hoc.
    - **Invoke the `frontend-design` skill before building or restyling any surface.** The design quality bar in this plan is a hard requirement, not a suggestion.
    - Reuse existing data hooks and pure operations. This redesign moves presentation, it does not rewrite the data layer.
    - No `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or `any` without explicit user permission.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md (the app-shell, organisation, and backend sections)
    - `src/App.tsx` (the navigation state machine and header to be replaced)
    - `src/workspace/useWorkspace.ts`, `src/workspace/space.ts` (active space, teams, roles, admin flag)
    - `src/supabase/rows.ts` (row mappers; where slugs are added)
    - `src/topics/TopicSidebar.tsx`, `src/library/Browse.tsx`, `src/library/selection.ts` (the sidebar to lift and the selection to derive)
    - `src/ui/styles.ts` and the `src/ui/` wrappers (the control system to reuse and extend)
    - `src/sharing/useShareRoute.ts`, `src/invites/useInviteRoute.ts` (the hand-rolled routing pattern to mirror)
    - `src/team/TeamManager.tsx` + `src/team/useMembers.ts`, `src/admin/AdminManager.tsx` + `src/admin/useAdmin.ts`, `src/account/AccountManager.tsx` (the modals to convert to pages, and the hooks to preserve)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message. If the section is `_None._`, write `Follow-ups: none.`

## Context

The app works, but its chrome grew feature by feature with no information architecture. Every global control was bolted onto the top-right of one `<header>` in `App.tsx`: the space switcher, Team, Admin, Account, theme, Sign out, and Delete account, in a mix of button sizes, variants, and icon-vs-text styles. The space switcher even hides itself below 760px rather than adapting.

The authenticated app is a single state-swapped shell. `App.tsx` holds `draft > openId > selection` and swaps the whole content area between editor, board view, and browse. The topic sidebar only exists on the browse surface and disappears the moment a board opens. The heavy surfaces are all modals: `AdminManager` is a 30rem dialog containing six unbounded lists plus team creation, and `TeamManager` holds the member roster inline. None of the navigation is in the URL, so the back button, refresh, and deep links do not work for anything except share and invite links.

The goal is a clean, modern, friendly shell with excellent UI: a persistent sidebar, a slim contextual top bar, real URLs, and proper pages for the management surfaces. The existing palette and the court/board visuals are already good and stay untouched. This is a chrome and IA redesign, not a visual reinvention.

## Plan

### Goals

- A **persistent left sidebar** present on every authenticated surface, including board view and edit, that never disappears.
- A **slim top bar** carrying a breadcrumb, the current view's contextual actions, and a single top-right account menu.
- **Real path-based URLs** via the History API, so back, refresh, and deep links work for normal navigation. The URL is the single source of truth for active space, selection, and open board.
- **Human-readable slugs** for teams and topics in those URLs; boards keep their uuid.
- **Full pages instead of mega-modals** for team management, admin, and account settings, with unbounded lists rendered as tables on their own sub-pages.
- **One consistent control system**: deliberate button sizes, variants, and icon-vs-text choices, all through `src/ui/`.
- **Responsive** down through the user's working widths: full sidebar at full-HD, an icon rail around 960 to 1400, a drawer below that.

### Non-goals

- No change to the colour palette, design tokens, typography scale, or the court/board rendering and motion.
- No change to the data model beyond adding `slug` to teams and topics.
- No new access rules. Team rename stays admin-only (no RLS change). Coaches do not gain new permissions.
- No replacement of the `#/share/<token>` and `#/invite/<token>` hash routes; they keep working as-is.

### Locked decisions

- **Routing**: hand-rolled History-API hook, no router library. URL is the single source of truth. Topic URLs are flat so they survive re-nesting. Boards use their uuid.
- **Slugs**: `slug` on `teams` (globally unique) and `topics` (unique per space), generated client-side from the title at creation, **stable across renames** so links never break.
- **Account menu**: a single top-right avatar dropdown holding account settings, theme toggle, sign out, and delete account. Nothing else lives in the top-right.
- **Team management**: reached from a gear on the active team in the sidebar's space switcher. The coach-facing Team page is the member roster plus invite links only. Team rename, archive, and delete stay in the Admin area (admin-only, no RLS change).
- **Admin**: a dedicated sidebar entry, visible only to admins, opening a full Admin area.
- **New board**: a prominent primary action in the content header of the boards area. Creating from a topic page pre-files the new board into that topic.
- **Visual scope**: keep palette and court; redesign layout, hierarchy, spacing, consistency, and interactions.

### Routing layer

Add a small routing module mirroring the existing `useShareRoute` convention. Do not add a router dependency.

- New files:
    - `src/routing/route.ts`: the `Route` discriminated union plus pure `parsePath(pathname, search)` and `buildPath(route)`. Pure and unit-tested, in the spirit of `src/library/selection.ts`.
    - `src/routing/useRoute.ts`: holds the current `Route`, subscribes to `popstate`, and exposes `navigate(route, { replace? })` over `history.pushState`/`replaceState`.
    - `src/routing/links.ts`: resolve a `Space`, `Topic`, or `Board` to a `Route` and back, doing slug-to-id lookups against the loaded stores so components never hand-build URLs.
    - `src/routing/NotFound.tsx`: a small in-app not-found surface reusing existing page styles, modelled on the missing branch of `src/sharing/ShareView.tsx`.
- `Route` shape:
    - `{ kind: "library"; space }` — all boards in a space.
    - `{ kind: "topic"; space; topicSlug }` — a topic page.
    - `{ kind: "board"; space; boardId; edit }` — board view or edit.
    - `{ kind: "settings" }` — account settings page.
    - `{ kind: "team"; teamSlug }` — team management (members + invites).
    - `{ kind: "admin"; sub }` — admin area, `sub` in `overview | teams | accounts | recovery`.
    - `{ kind: "notFound"; path }`.
    - `space` is `{ kind: "personal" } | { kind: "team"; teamSlug }`, carrying the slug so the URL stays the source of truth.
- Route map:
    - `/` redirects (`replaceState`) to the landing space, matching today's default: the first team if any, else personal.
    - `/personal`, `/personal/topic/<slug>`, `/personal/board/<id>`, `…/board/<id>/edit`.
    - `/t/<team-slug>`, `/t/<team-slug>/topic/<slug>`, `/t/<team-slug>/board/<id>`, `…/board/<id>/edit`.
    - `/t/<team-slug>/team` — team management.
    - `/settings`.
    - `/admin` redirects to `/admin/teams`; `/admin/teams`, `/admin/accounts`, `/admin/recovery`.
    - `#/share/<token>` and `#/invite/<token>` unchanged. They read the hash and are orthogonal to the path router; `App.tsx` keeps checking them first.
- Topic URLs are **flat** (`/topic/<slug>`, not a nested ancestor path). Topics re-nest freely via `reparentTopic`, so a path that encoded ancestors would break on every move. The slug is unique within the space and stable. The breadcrumb shows the live ancestor chain, derived from `parentId` at render.
- How routes drive existing state (URL becomes the single source of truth):
    - `activeSpace` is derived from `route.space`. An effect in `App.tsx` calls `workspace.setActiveSpace` when the route's space differs from the current one. The one-time default logic becomes the `/` landing redirect.
    - `selection` is derived from the route: a `topic` route yields `{ kind: "topic", id }` (slug resolved against loaded topics), otherwise `{ kind: "all" }`. The `Selection` type stays as the shape content components consume; it is computed, not stored. Clicking a topic calls `navigate`, not `setSelection`.
    - `openId` and `draft` are derived from a `board` route and its `edit` flag. The `commit`, `remove`, `onEdit`, and `onBack` handlers call `navigate` instead of `setOpenId`/`setDraft`.
    - The gates above the surface stay state-and-effect based, not routes: share token, loading, invite token, unauthenticated login, invite set-password, workspace error, and name setup. They short-circuit before the routed content renders, exactly as today.
- Board deep-link resolution:
    - Parse to a `board` route, resolve `team-slug` to a team against `workspace.teams`. An unknown slug renders `NotFound` with no database round-trip.
    - Set the active space, let `useBoards`/`useTopics` refetch, then resolve the board from the loaded list (the existing `boards.find` line).
    - If the board is not in the loaded space list, fall back to a new `fetchBoardById(boardId)` helper alongside `boardByToken` in `src/sharing/share.ts`, using `.eq("id", boardId).maybeSingle()`.
    - **RLS hides unreadable rows; it does not return a 403 on read.** So "wrong space" and "no permission" are indistinguishable and both surface a single not-found state. Do not build a 403-vs-404 split; it is not expressible. If the board is readable but lives in a different space than the URL claimed (a moved board), `replaceState` to its real space URL and switch the active space, so stale links self-heal.
- The Cloudflare Pages SPA fallback already exists (`public/_redirects` → `/* /index.html 200`), so a hard refresh of a deep path resolves to `index.html`. **No infra step is required.**

### Slug model and Supabase steps

- Schema: `teams.slug text` globally unique; `topics.slug text` unique within a space (a partial unique index on `(team_id, slug)` where `scope = 'team'`, and another on `(owner, slug)` where `scope = 'personal'`). Boards keep their uuid and gain no slug.
- Generation: client-side from the title at creation. Add `src/routing/slug.ts` with a pure `slugify(title)` (lowercase, ASCII-fold, hyphenate, collapse repeats, trim, fall back to `untitled`), unit-tested. On topic create (`useTopics.addTopic`) disambiguate against the in-memory space topics and append `-2`, `-3` on collision, with the unique index as the backstop (retry on a `23505`). On team create (`useWorkspace.createTeam`) insert `slugify(name)` and on conflict retry with a short random suffix.
- Stability: slugs never change on rename. The display name changes freely; the slug is a permanent handle minted once. This keeps every bookmark and open tab valid.
- Mappers and stores: add `slug` to `TopicRow`, `TopicInsert`, `topicFromRow`, `topicToInsert`, and the team-row reads in `src/supabase/rows.ts`; add `slug` to the `Topic` model (`src/topics/types.ts`) and to `TeamMembership` (`src/workspace/useWorkspace.ts`). The topic select already uses `select("*")`, so reads pick up the column once it exists. Add `slug` to the team select. Update `tests/helpers/supabaseFake.ts` so rows carry a slug.
- **User-run Supabase migration (Gate B).** Provide the user one new migration file under `supabase/migrations/` to apply, with ordered SQL: add both columns; backfill `teams.slug` from `name` and `topics.slug` from `title` with a SQL slugify, de-duplicated by a window function (teams globally, topics partitioned per space); set both columns `not null` after backfill; create the unique index on `teams.slug` and the two partial unique indexes on `topics`; end with `notify pgrst, 'reload schema';`. No new grant is needed: `slug` rides on the existing full-row `insert`/`update` grants on `teams` and `topics` for both `authenticated` and `service_role`. No new RLS policy is needed; existing team and topic policies already cover the column. The user runs this; the slug-dependent client code ships only after they confirm it is applied.

### Shell decomposition

- New component tree under a new `src/shell/`:
    - `AppShell.tsx`: the persistent layout (sidebar + top bar + routed content outlet) that replaces the `App.tsx` header and the state-swap block. It picks content by `route.kind`.
    - `Sidebar.tsx`: always present. Top is the space switcher; middle is the space nav; an admin entry appears for admins.
    - `SpaceSwitcher.tsx`: Personal plus each team, replacing the `Select` in the old header. The active team row shows a gear that navigates to `/t/<slug>/team`, gated by `canEdit` for that team.
    - `SidebarNav.tsx`: "All boards", the lifted `TopicSidebar`, and "+ New topic".
    - `TopBar.tsx`: the slim bar holding the breadcrumb, a contextual-actions slot, and the avatar menu.
    - `Breadcrumb.tsx` plus a pure `src/shell/breadcrumb.ts`: from the route plus loaded teams, topics, and boards, derive `{ label, route }[]` — space crumb, the live topic ancestor chain (walk `parentId`), then the board title as a terminal crumb.
    - `AvatarMenu.tsx`: a thin composition over `src/ui/Menu.tsx` with account settings (to `/settings`), theme toggle (reuse `useTheme` and the existing sun/moon SVGs), sign out, and delete account (reuse the existing confirm-and-sign-out flow). In dev, fold the existing `DebugMenu` action in here under `import.meta.env.DEV`.
- Lift the sidebar out of `Browse`: remove the two-column grid and the `TopicSidebar` render from `src/library/Browse.tsx`. Dissolve `Browse` so the shell routes directly to `Library`, `TopicView`, and `TopicEditor`; the content choice is now route-derived. `TopicSidebar`'s internals do not change shape; its `selection` comes from the route and its `onSelect` calls `navigate`. The sticky and responsive wrapper moves into the shell's sidebar container.
- `App.tsx` shrinks to: the gates, the store wiring (`useWorkspace`, `useBoards`, `useTopics`, `useConfirm`, `useTheme`, `useAuth`), `useRoute`, and the route-to-state effects. It renders `AppShell`. The grab-bag header is deleted. The `managing`, `adminOpen`, and `accountOpen` modal flags are removed in favour of routes; `sharing` stays as a small dialog keyed on the open board.
- New board placement: a primary action in the content header of `Library` and `TopicView`. From a topic page it pre-files the board into that topic before opening the editor.

### Pages replacing modals

Reuse every existing data hook and handler. Only the presentation container changes from dialog to page. Render unbounded lists as tables using a new shared table style (see the consistency pass).

- Team: `src/team/TeamPage.tsx` at `/t/<slug>/team`, reached from the space-switcher gear. It shows the member roster as a table (`src/team/MembersTable.tsx`) driven by `useMembers` verbatim (`members`, `loading`, `setRole`, `remove`), with the per-row role select and a remove icon button, and an "Invite" button opening the existing `InviteDialog` unchanged. No team-settings sub-page: rename, archive, and delete live in Admin.
- Admin: `src/admin/AdminPage.tsx` with a `Tabs` sub-nav, all sub-pages driven by `useAdmin` unchanged.
    - `/admin/teams`: live teams as a table with archive, unarchive, and delete; team creation as a small inline form or "+ New team" dialog at the top, calling `workspace.createTeam`. This is also where an admin renames a team if rename UI is added.
    - `/admin/accounts`: active profiles as a table.
    - `/admin/recovery`: recently deleted teams, accounts, boards, and topics as grouped tables with restore actions.
    - Destructive confirmations keep using `useConfirm`.
- Account: `src/account/SettingsPage.tsx` at `/settings`, reached from the avatar menu. Reuse `setDisplayName`, the display name, and the read-only email. Delete account and the theme toggle belong to this account cluster: theme stays a quick toggle in the avatar menu, delete account moves off the always-visible header into the avatar menu or this page.
- Dialogs that remain: `useConfirm` for all confirmations, `ShareDialog` for copy-a-link and promote (opened from the board view's Share action), `InviteDialog` for invite-by-link, and the small `CopyToPersonalButton`/`PromoteToTeamMenu` affordances.

### Component consistency pass

The tokens and wrappers are already centralised in `src/ui/styles.ts`; the inconsistency is in usage. No palette or token change.

- Destructive row actions use `IconButton` with an `aria-label`, not ad-hoc class strings. Migrate the bespoke remove button in `TeamManager`/`MembersTable` to `IconButton` and drop the literal class string.
- Keep the existing button variant semantics: one `primary` per view, `ghost` for secondary, `text` or a plain `IconButton` for quiet and icon actions, `danger` only for destructive, `dashed` only for "add". The deleted header removes most of the inconsistency by construction.
- Add one shared table style set to `src/ui/styles.ts` (head, row, cell), optionally a thin `src/ui/Table.tsx`, so all four management tables render identically using existing tokens. This is the only new control family the redesign needs.
- New pages reuse the existing page scaffolding (`PAGE`, `PAGE_BAR`, `TITLE`, `EYEBROW`, `PANEL`, `PANEL_TITLE`, `FIELD_LABEL`) and `src/ui/Tabs.tsx` for in-page sub-navigation, so they match the library and topic views.

### Responsive behaviour

Primary target is full-HD; the sidebar has three modes. Delete the `max-[760px]:hidden` on the space switcher and the `max-[860px]:static` collapse; the switcher is always reachable.

- At 1400px and up: sidebar fully expanded, reusing the current left-column width.
- Around 960 to 1400: an icon rail. The space switcher shows initials or avatars, the topic tree expands on demand, and nav items are icons with tooltips (reuse `src/ui/Tooltip.tsx`). The breadcrumb truncates middle crumbs.
- Below 960: a drawer toggled by a hamburger in the top bar, closing on selection.
- Implement with a small hand-rolled media-query hook or pure CSS breakpoints driving the shell grid. Board view and editor stay full-width content; the court is untouched.

### Sequencing

Each stage keeps the app shippable. The only hard external gate is the Supabase migration in Stage 4.

1. **Stage 1 — Routing.** Routing behind existing state, no behaviour change. Add the routing module and wire `useRoute` so the URL mirrors the current state: write the URL when space, selection, or open board change, and read it on load. Topics use their id in the URL for now; slugs come in Stage 4. Back, refresh, and deep links start working. Hash routes untouched.
2. **Stage 2 — Shell.** Shell decomposition. Build `AppShell`, `Sidebar`, `SpaceSwitcher`, `SidebarNav`, `TopBar`, `Breadcrumb`, and `AvatarMenu`; lift `TopicSidebar`; dissolve `Browse`; delete the old header. The sidebar becomes persistent across board view and edit. Selection and open board become route-derived.
3. **Stage 3 — Pages.** Pages replacing modals. Convert account to `/settings`, team to `/t/<slug>/team`, and admin to `/admin/*`, adding the shared table style. Keep `ShareDialog`, `InviteDialog`, and confirmations as dialogs.
4. **Stage 4 — Slugs.** Gate B: the user applies the Supabase migration and confirms. Then ship `slug.ts`, the mapper and store changes, slug generation on create, and switch team and topic URLs from id to slug, `replaceState`-canonicalising old id links to slug links. Update `supabaseFake`.
5. **Stage 5 — Responsive & consistency.** The responsive rail and drawer, plus the consistency cleanup (migrate the remove button, codify button rules in the style guide).
6. **Stage 6 — Polish.** Move the board's contextual actions (Share, Edit, Copy, Lock) into the top bar's contextual-actions slot, and finalise breadcrumb truncation.

### Design quality bar

- Invoke the `frontend-design` skill at the start of each surface (shell, sidebar, top bar, the three page families) and hold its bar: deliberate hierarchy, generous spacing, considered states (hover, focus, active, empty, loading), and restrained motion consistent with the existing settle easing.
- Keep the established palette, tokens, and type scale. Excellence here is in layout, rhythm, alignment, and interaction quality, not new colour.
- Empty and loading states are part of the work: the member, account, recovery, and admin tables each need a considered empty state, not a bare blank.

### Testing

Add or update unit tests to cover the changed behaviour, no more than the changes require. Use the `react-testing` skill, and query by role and text.

- `tests/routing/route.test.ts`: `parsePath`/`buildPath` round-trips for every route, the flat topic form, board view and edit, hash-route pass-through, and not-found.
- `tests/routing/slug.test.ts`: `slugify` folding, collisions, and fallback.
- `tests/shell/breadcrumb.test.ts`: the ancestor chain survives a simulated re-nest.
- Update `tests/App.test.tsx`: the old `Active space` select, `Team`, `Admin`, `Account`, and `+ New board` targets move to the space switcher, the gear, the admin sidebar entry, the avatar menu, and the content-header button. Add assertions that navigation changes `window.location.pathname` and that a board deep link renders the board while an unknown id renders the not-found surface.
- Keep the existing `useMembers`, `useWorkspace`, `useBoards`, `useTopics`, and admin data tests green; the `supabaseFake` slug additions must default so they do not break.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- The left sidebar is present on every authenticated surface, including board view and edit, and does not disappear when a board opens.
- The top bar shows a breadcrumb and a single top-right avatar menu; the old grab-bag of header buttons is gone.
- Back, refresh, and deep links work for spaces, topics, and boards. Team and topic URLs use slugs; board URLs use the uuid. Share and invite hash links still work.
- Team management, admin, and account settings are full pages; the six former admin lists are tables on their own sub-pages. Only confirmations, the share dialog, and invite-by-link remain dialogs.
- The palette and the court rendering and motion are unchanged.
- Verified on screen with Playwright at 1920x1080 and at two narrower widths (around 1280 for the rail and around 900 for the drawer): the persistent sidebar, a board deep link surviving a hard refresh, the back button returning to the prior surface, the management pages rendering as pages, and the space switcher never hidden. A Sequence still plays with its visuals and motion intact.

## Follow-ups

_None._

## Implementation Notes

### Stage 1 — Routing

Status: complete. All 227 tests pass; lint and typecheck clean. Verified in a real browser (Playwright) at `/`.

What shipped:

- `src/routing/route.ts`: the `Route` discriminated union plus pure `parsePath` / `buildPath`, and helpers `routeSpace` and `sameRouteSpace`. Topic URLs are flat (`/…/topic/<slug>`); boards use the uuid; `/admin` parses to `admin/teams`.
- `src/routing/useRoute.ts`: holds the live `Route`, subscribes to `popstate`, exposes `navigate(route, { replace? })` over `pushState`/`replaceState`.
- `src/routing/links.ts`: resolves spaces, topics, and boards to/from a `Route`. The id→slug switch is localised to two accessors, `topicSlugOf` and `teamSlugOf`, which return the id today and will return `.slug` in Stage 4. Everything else routes through them.
- `src/routing/NotFound.tsx`: the in-app not-found surface, reusing the page scaffolding.
- `src/sharing/share.ts`: added `fetchBoardById` (board + scope + teamId) for deep-link resolution and self-heal.
- `src/workspace/space.ts`: added `sameSpace`.
- `tests/routing/route.test.ts`: round-trips every route, the flat topic form, board view/edit, `/admin` canonicalisation, trailing slashes, encoded slugs, and not-found.

Key decisions and deviations from the plan's Stage-1 wording:

- **Went straight to URL-as-source-of-truth, not a transitional two-way mirror.** The plan's Stage 1 says "URL mirrors current state"; its own design section (and the end state) makes the URL the single source of truth. A two-way mirror fought the async workspace default and would have been thrown away in Stage 2, so `App` now derives `selection`, `openId`, and the edit flag from the route, and an effect syncs `activeSpace`. The Stage-1 boundary kept is the **UI**: the old header, `Browse`, and the management modals are untouched; only navigation moved to the URL. Topics and teams still use their id in the URL (slugs are Stage 4) — the `Route` field is named `teamSlug`/`topicSlug` but holds the id until then.
- **Kept the workspace one-time default to the first team.** The plan says "the default logic becomes the `/` landing redirect." I added the `/` landing redirect, but also kept the existing default, because the default is what avoids a double content-fetch on the common `/` landing (it sets the team before content loads). The redirect canonicalises the `/` URL; the default picks the space.
- **Draft reconciliation happens during render, not in an effect.** The new `react-hooks/set-state-in-effect` rule forbids synchronous `setState` in an effect body. Seeding the editor draft from the board on an edit URL, clearing it when the URL leaves edit mode, and resetting the not-found flag are all done with React's "adjust state during render" pattern. Only the async board lookup stays in an effect (its `setState` lands in the promise callback).
- **`onBack` from a board returns to the space library, not the board's topic.** The BoardView back control is labelled "Library" and the existing tests expect the All Boards grid, so back navigates to `homeRoute()`. The browser back button covers "return to exactly where I came from."

Gotchas found and fixed:

- **Hash routes vs the path router.** A share/invite link rides the hash with the pathname at `/`, so the route parses as `root`. The root-landing effect would then `navigate`, and `replaceState` strips the hash — flipping `ShareView` away to the main app. Fixed with a `hashRoute` guard that makes the whole path router dormant while a hash link owns the screen.
- **Spurious not-found flash on a cross-space deep link.** On a personal deep link the workspace defaults to the first team, so the board lookup briefly ran in the wrong (team) space, set "missing", showed not-found, then the space switched and re-resolved — a visible flicker that also raced the tests. Fixed by gating the lookup on `spaceReady` (active space matches the route's space), so the lookup only runs once the right library is loaded.
- **Tests share one happy-dom window.** Added `window.history.replaceState(null, "", "/")` to `App.test`'s `beforeEach` so each test starts from the landing route, and added `maybeSingle` to the Supabase fake (used by `fetchBoardById`). The new `routing` describe asserts the URL updates on open, a deep link resolves the board, and an unknown id renders not-found.

### Stage 2 — Shell

Status: code complete. All 233 tests pass; typecheck, lint, and format clean. Visual verification with Playwright is the one item deferred to the next sub-20%-context window (the cross-stage Playwright pass in the acceptance criteria covers the shell visually); the build and the behaviour/accessibility tests are green.

What shipped:

- `src/shell/AppShell.tsx`: the persistent grid frame (a 16rem sidebar column beside a content column), owning the background glow and the content padding that `Browse` used to set.
- `src/shell/Sidebar.tsx`: always present on every authenticated surface. Brand, then `SpaceSwitcher`, then the lifted `TopicSidebar` in a scrolling middle region, then an admin entry pinned at the foot (admins only).
- `src/shell/SpaceSwitcher.tsx`: the personal space plus each team as highlighted rows (replacing the old header `Select`). The active team row carries a gear that opens its management surface, shown only when the user may curate that team (`!personal && canEdit`). Each row's decorative initial badge is `aria-hidden`, so a row's accessible name is just the space name.
- `src/shell/TopBar.tsx`: the slim sticky bar — breadcrumb on the left, a contextual-actions slot (unused until Stage 6), the avatar menu on the right.
- `src/shell/Breadcrumb.tsx` + pure `src/shell/breadcrumb.ts`: the live trail (space crumb, the `parentId` ancestor chain, the board title terminal crumb). Earlier crumbs are nav buttons; the last is `aria-current="page"` text. Tested in `tests/shell/breadcrumb.test.ts`, including a simulated re-nest.
- `src/shell/AvatarMenu.tsx`: the single top-right control — an initials avatar (`aria-label="Account menu"`) opening account settings, the theme toggle, sign out, delete account, and, in a dev build, the folded-in "Reset local state".
- `App.tsx` rewired onto `AppShell`: the grab-bag `<header>` is deleted; `Browse.tsx` is deleted and its content choice (`Library` / `TopicView` / `TopicEditor`) now lives in `App`, driven by the route plus a local `editingTopicId`. `TopicSidebar`'s nav wrapper was stripped of its sticky/responsive classes (the shell owns positioning now). `TopicView` gained a primary "+ New board" (demoting Edit/Subtopic to ghost); creating a board from a topic page pre-files it into that topic. `MenuItem` now merges a passed `className`.

Key decisions and deviations:

- **`SidebarNav` was not split out as its own component.** The plan lists a `SidebarNav.tsx` holding "All boards", the lifted `TopicSidebar`, and "+ New topic". But `TopicSidebar` already renders all three (All Boards row, the tree, the new-topic action), so wrapping it would have been a redundant pass-through. The lifted `TopicSidebar` serves as the nav directly inside `Sidebar`. No behaviour or markup was lost; the relevant tests ("All Boards", "+ New topic", topic rows) stay green.
- **Management surfaces are still dialogs in Stage 2, opened from the shell.** `TeamManager`, `AdminManager`, and `AccountManager` remain the existing dialogs, opened via local state (`managing` from the switcher gear, `adminOpen` from the sidebar Admin entry, `accountOpen` from the avatar "Account settings"). Converting them to routed full pages and removing those three flags is Stage 3, so `/settings`, `/t/<slug>/team`, and `/admin/*` still render `NotFound` (they are not yet reachable by URL, only via these affordances). This keeps Stage 2 shippable without pulling Stage 3's page work forward.
- **Players no longer reach team management.** The switcher gear is gated on `canManageActiveTeam` (`!personal && canEdit`), per the locked decision that the Team surface is coach-facing. A player (no `canEdit`) sees no gear, so the previous player-can-view-the-roster-read-only path is gone. This is a deliberate consequence of the plan's gating, not a regression to fix; the player team test now asserts the absence of the gear.

Test changes (`tests/App.test.tsx`), all behaviour-and-role queries:

- Space switch: the old `combobox "Active space"` + its options became sidebar **buttons** named by space (`"Personal"`, each team name). Touched `personal space`, the `sharing` `openMyBoard` helper, and the admin "becomes selectable" test.
- `"Team"` header button → the switcher gear `getByRole("button", { name: "Manage My Team" })`; the player case asserts no `/Manage/` button.
- `"Admin"` header button → the sidebar `getByRole("button", { name: "Admin" })` (unchanged name; absent for non-admins, already covered by the permissions test).
- `"Account"` header button → open `"Account menu"`, then the `"Account settings"` menuitem.
- `"Delete account"` and the dev "Reset local state" → now menuitems inside the avatar menu; the former `debug menu` describe became `avatar menu`, asserting the dev reset is offered and the menu is keyboard-navigable and dismisses on Escape (first item is now "Account settings").
- Unchanged: `"+ New board"`, `"+ New topic"`, `"All Boards"`, topic-name buttons, the BoardView `/Library/` back control, and the whole editor flow.

### Stage 3 — Pages replacing modals

Status: code complete. All 234 tests pass; typecheck, lint, and format clean. Visual verification with Playwright stays deferred to the end (the user set context at ~13% and asked to run Playwright once at the close), so the management pages have not yet been seen on screen. The build and the behaviour/role tests are green.

What shipped:

- `src/ui/styles.ts`: one shared table look — `TABLE_FRAME` (the bordered panel card a table sits in), `TABLE`, `TABLE_HEAD_CELL`, `TABLE_CELL` — so all four management tables render identically from existing tokens. `TABLE` drops the last body row's rule (`[&_tbody_tr:last-child_td]:border-0`) so it never doubles the frame border. No palette or token change.
- `src/account/SettingsPage.tsx` at `/settings`: the display name read-only with a pencil to edit (reusing `setDisplayName`), the read-only email beneath, both inside a `PANEL` card under the shared `PAGE`/`EYEBROW`/`TITLE` scaffolding. The former `AccountManager` body, lifted out of a dialog.
- `src/team/TeamPage.tsx` at `/t/<slug>/team`: the team name as the page title, an "Invite member" page action (opening the unchanged `InviteDialog`), and the roster. Drives `useMembers` verbatim and owns the remove-confirm (`useConfirm`) and member-error state.
- `src/team/MembersTable.tsx`: the roster as a table — member, a per-row role `Select` (or a read-only role chip for the viewer's own row and for a non-manager), and a remove `IconButton`. Considered empty (`No members yet.`) and loading states.
- `src/admin/AdminPage.tsx` at `/admin/*`: the admin area as a page with a `Tabs` sub-nav over three real routes (`/admin/teams`, `/admin/accounts`, `/admin/recovery`), all driven by one `useAdmin(true)` snapshot. Teams tab: a "New team" inline form (`workspace.createTeam`) plus a live-teams table (state badge, archive/unarchive, delete). Accounts tab: active profiles table (You/Admin tags, delete non-admins). Recovery tab: grace-archived teams, accounts, boards, and topics as grouped restore tables. Destructive actions keep `useConfirm`; each tab has its empty state (`No teams yet.`, `No accounts.`, `Nothing to recover.`).
- `App.tsx`: removed the `managing` / `adminOpen` / `accountOpen` flags and the three dialog renders. The switcher gear now navigates to `teamRoute`, the sidebar Admin entry to `/admin/teams` (with `adminActive` = `route.kind === "admin"`), and the avatar "Account settings" to `/settings`. New `settings` / `team` / `admin` branches in the content switch render the pages (`team` resolves the slug to a membership, else `NotFound`; `admin` renders only for an admin, else `NotFound`).
- Deleted the three replaced modals (`TeamManager.tsx`, `AdminManager.tsx`, `AccountManager.tsx`). `ShareDialog`, `InviteDialog`, the copy/promote affordances, and every `useConfirm` confirmation stay dialogs, as planned.

Key decisions and deviations:

- **Creating a team no longer navigates away.** In Stage 1–2 the `createTeam` wrapper in `App` navigated to the new team's library; as a routed page that would unmount `AdminPage` before its "Created …" confirmation could show. The wrapper is gone: `AdminPage` calls `workspace.createTeam` directly, stays put, shows the confirmation, and reloads its own snapshot. The new team appears in the sidebar switcher (from `workspace.teams`); the admin chooses when to switch into it.
- **The team page is viewable read-only by any member via its URL; the gear stays coach-gated.** `canManage` (`isAdmin || membership.role === "coach"`) gates the role select, remove, and invite controls. A player typing `/t/<slug>/team` sees the roster only — restoring the old read-only-roster affordance that Stage 2's gear-gating had removed, but only for someone who knows the URL. The sidebar gear is still shown only to managers.
- **The remove control is an `IconButton` from the start.** Stage 5's consistency pass lists "migrate the bespoke remove button in TeamManager/MembersTable to IconButton". Building `MembersTable` fresh, the remove is an `IconButton` with an `aria-label` directly, so that specific Stage 5 item is already satisfied (the `StepStrip`'s own `STEP_REMOVE` string is a different control, untouched). The remove uses the `plain` variant (neutral hover) rather than a red hover, staying inside the existing icon-button variants; the confirm dialog carries the destructive intent.
- **Delete account and the theme toggle stay in the avatar menu, not duplicated on the settings page.** The plan allows either home; they are already in the avatar menu (Stage 2, tested there), so the settings page is name + email only.
- **The team breadcrumb crumb is "Members".** Changed from "Team" so the trail reads e.g. "Falcons › Members" rather than "Falcons › Team". Covered by a new `breadcrumb.test.ts` case.

Test changes:

- `tests/admin/AdminManager.test.tsx` → `tests/admin/AdminPage.test.tsx`: ported every assertion (list teams/accounts/recovery, archive write, `delete_team` RPC, `delete-account` invoke, restore writes/invokes) to the page. A tiny harness owns `sub` so a tab click switches panels as navigation would; rows are now `<tr>` (`.closest("tr")`). Same `supabaseFake`, same recorded-call assertions.
- `tests/App.test.tsx`: the account test now asserts the `/settings` **page** (heading "Settings", name/email text, change-and-save) instead of a dialog; the admin create-team test drops the dialog-closing Escape (the page stays, the team shows in the sidebar).
- `tests/shell/breadcrumb.test.ts`: added the team-route case (`["Falcons", "Members"]`).

### Stage 4 — Slugs

Status: complete. 250 tests pass; typecheck, lint, and format clean. The migration is applied in production (Gate B cleared).

What shipped:

- `supabase/migrations/20260609000003_slugs.sql`: adds `slug` to `teams` and `topics`, backfills with a SQL slugify (a `pg_temp` function folding accents and hyphenating, mirroring the client), de-duplicated by window functions (teams globally; topics partitioned per space), sets both `not null`, creates the unique index on `teams.slug` and the two partial indexes on `topics`, and reloads the PostgREST schema. No new grant or policy.
- **The deploy path changed since the plan was written.** The repo now carries a read-only Supabase MCP server and the CLI as a devDependency, so Gate B was not a paste-SQL handoff: the user ran `supabase login`/`link` interactively, and the migration went out via `npx supabase db push` under the permissions-ask guard. The remote migration history was already in sync, so no `migration repair` was needed.
- `src/routing/slug.ts` + `tests/routing/slug.test.ts`: pure `slugify` (NFKD fold, lowercase, hyphenate, `untitled` fallback) and `uniqueSlug` (first free `-2`, `-3`, … suffix).
- Model and mappers: `slug` on `Topic`, `TopicRow`, `TopicInsert`, `TeamMembership`, and the team select; mapped in `topicFromRow`/`topicToInsert`; `SAMPLE_TOPICS` and the test fake carry slugs (`my-team`, `rotations`, …).
- Generation: `createTopic` mints via `uniqueSlug` against the in-memory space; `useTopics.addTopic` retries once with a random suffix on a `23505`; `useWorkspace.createTeam` inserts `slugify(name)` with the same one-shot retry.
- URLs: `topicSlugOf`/`teamSlugOf` flipped to `.slug`; the lookups (`findTeamId`, `findTopicId`, `spaceForRouteSpace`) still match an old id link; the new pure `canonicalRoute` rebuilds resolvable handles, and App's canonicalisation effect `replaceState`s old id links to slug links.

Key decisions and deviations:

- **The placeholder rename re-mints the slug.** Topics are created as "New topic" and renamed afterwards, so minting strictly once would leave every topic slugged `new-topic-N` forever. Deviation: the first rename away from the untouched "New topic" placeholder re-mints the slug from the real title; every later rename leaves it alone, so the plan's guarantee (bookmarks never break) holds for any topic anyone could have linked to under its real name.
- **Editor Done survives the re-mint.** Committing that first rename invalidates the URL's old handle, which fell to NotFound. `TopicEditor onDone` now replace-navigates to the topic by id, and the tolerant lookup plus `canonicalRoute` rewrite it to the fresh slug.

Test changes: `tests/App.test.tsx` URL assertions moved from `/t/test-team` to `/t/my-team`; `Topic`/`TeamMembership` fixtures across the suite gained slugs; `tests/topics/operations.test.ts` asserts the minted slug and the `-2` collision suffix.

### Stage 5 — Responsive & consistency

Status: complete. 258 tests pass; format, lint, and typecheck clean. Verified on screen with Playwright at 1920 (full), 1200 (rail, plus the expanded overlay), and 800 (drawer open and closed).

What shipped:

- `src/shell/useSidebarMode.ts`: a hand-rolled `useSyncExternalStore` hook mapping `(min-width: 1400px)` → `full`, `(min-width: 960px)` → `rail`, else `drawer`. It subscribes to the two media-query change events and additionally to window `resize`: happy-dom seeds a change listener's previous-matches state to `false`, so a true→false transition fires no change event there, while resize always fires. Browsers fire both; duplicates dedupe on the snapshot value.
- `src/shell/SidebarRail.tsx`: the slim rail (a 3.5rem column) — the brand glyph, one initial badge per space (the existing badge look, the active space accent-filled), a `ListTree` Topics toggle that opens the expanded overlay (highlighted and `aria-expanded` while open), and the `ShieldCheck` admin entry at the foot. Every item carries a right-side `Tooltip`. The items are hand-rolled nav buttons in the sidebar's own row idiom rather than `IconButton`s: an appended `bg-accent-weak` cannot reliably beat the IconButton variant's own background utility (same-specificity Tailwind classes resolve by stylesheet order), which visibly dropped the active highlight.
- `src/ui/SidePanel.tsx`: a left-anchored overlay built on Base UI's Dialog (focus trap, focus return, escape and scrim dismissal for free), 16rem wide, sliding in on the settle easing with `motion-reduce:transition-none`, named via `aria-label`. The overlay hosts the unchanged full `Sidebar`, so the manage-team gear and topic tree work identically there.
- `src/shell/BrandMark.tsx`: the court-grid glyph extracted from `Sidebar` so the rail reuses it.
- `AppShell` takes a `mode` and switches the left grid column (16rem / 3.5rem / none). `TopBar` takes an optional `onOpenNav` and renders a leading `PanelLeft` IconButton ("Open navigation") in drawer mode.
- `App.tsx` owns the mode and one `navOpen` flag. A small `closing(fn)` wrapper makes every sidebar navigation pick (space, topic, All Boards, new topic, gear, admin) also close the overlay, without duplicating Sidebar internals; reorder/nest stay non-closing. `navOpen` resets during render when the mode returns to `full`.
- `docs/style_guide.md` gained a `## UI Controls` section codifying the button-variant rules.

Key decisions and deviations:

- **No dead collapse classes were found to delete.** The old header's `max-[760px]:hidden` / `max-[860px]:static` hacks were already removed in Stage 2; the remaining `max-[…]` classes (`PAGE_BAR`, board editor/view) belong to content surfaces and stay.
- **Tests pin the viewport centrally.** happy-dom's default 1024px viewport would resolve to `rail`, so `tests/setup.ts` sets a 1920px viewport in a global `beforeEach` via a typed `tests/helpers/viewport.ts` helper (`window.happyDOM.setViewport`, declared once so no casts); responsive tests resize per test through the same helper. happy-dom evaluates the min-width queries and fires resize on `setViewport`, so no matchMedia stub was needed.
- New tests: `tests/shell/useSidebarMode.test.ts` (width→mode mapping, reaction to live resizes) and `tests/shell/responsiveShell.test.tsx` (drawer: the hamburger opens the navigation and picking a topic closes it and navigates; rail: named space badges, the Topics toggle opens the overlay and reports `aria-expanded`). One nuance: while the overlay is open the modal dialog makes the background inert, so the rail toggle is asserted via a reference captured before opening.

### Stage 6 — Polish

Status: complete. 262 tests pass; format, lint, and typecheck clean. Verified on screen with Playwright against the production backend at 1920×1080 (full sidebar), 1280 (rail), and 900 (drawer): the top-bar actions on a board, a deep link surviving a hard refresh, breadcrumb navigation plus the browser back button, the team page as a full page, the drawer overlay, and a Sequence playing with its motion intact.

What shipped:

- **Board actions moved into the top bar.** The view branch in `App.tsx` now builds the open board's contextual actions and passes them to `TopBar`'s previously unused `actions` slot, next to the breadcrumb that ends in the board's title: the quiet utilities as `plain` icon buttons (Copy JSON as a `Braces` glyph, the author lock as `Lock`/`LockOpen`), then the share-or-copy affordance (Share for an owned personal board, Copy to My Boards on a team board), then Edit as the view's one `primary`, all at `sm` to fit the slim bar. The accessible names are unchanged ("Copy JSON"/"Copied", "Lock editing"/"Unlock editing", "Share", "Edit"), so the existing tests carried over; the lock test now asserts the controls live inside the banner.
- `src/editor/CopyJsonButton.tsx`: the copy-JSON control extracted from `BoardView` (it owns the copied state and the clipboard write), rendered as an icon button per the style guide's quiet-action rule.
- `BoardView` slimmed to a pure reading surface: the built-in Copy JSON/Lock/Edit buttons and their props (`canEdit`, `canSetLock`, `onToggleLock`, `onEdit`) are gone. The `actions` header slot stays for the shell-less share page: `ShareView` now injects Copy to My Boards, the promote menu, and `CopyJsonButton` there itself.
- `CopyToPersonalButton` gained a `size` prop so the top bar renders it at `sm` while the share page keeps `md`.
- **Breadcrumb truncation finalised.** A pure `collapseCrumbs` in `src/shell/breadcrumb.ts` folds a trail longer than four crumbs into head + ellipsis + last two; `Breadcrumb.tsx` renders the fold as a `Menu` on an ellipsis icon button ("More pages"), whose items navigate to the hidden crumbs, so deep topic chains stay reachable. Per-crumb `max-w` truncation is unchanged.

Key decisions and deviations:

- **Copy JSON became an icon button everywhere, including the share page.** Four text buttons crowded the slim bar, and the style guide assigns quiet actions to `IconButton`; the swap to a check glyph (name "Copied") keeps the confirmation behaviour and the test contract.
- **The collapsed crumbs are a menu, not plain "…" text.** Truncation must not cost reachability: the plan's flat topic URLs mean the breadcrumb is the only visible ancestor chain, so the hidden middle stays navigable through the menu.
- **The ellipsis menu was verified by unit and component tests, not on screen.** Seeing it live needs a 4-deep topic chain, which would have meant writing throwaway rows into the production database; `tests/shell/Breadcrumb.test.tsx` covers the fold and the menu navigation instead.

New tests: `collapseCrumbs` cases in `tests/shell/breadcrumb.test.ts` and `tests/shell/Breadcrumb.test.tsx` (the trail links earlier crumbs, ends in `aria-current` text, folds a six-crumb trail, and navigates from the menu).

### Critical Issues

_Filled in by the implementation agent._
