# Width-independent team-management entry

## Implementation Agent Instructions

- **Role**: React + TypeScript engineer working on the VolleyCoach app shell and library surface.
- **Task**: Add a team-management entry point on the team's own content surface so management is reachable at every sidebar width, keeping the existing sidebar gear as a shortcut.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Render the new control through the `src/ui/` wrappers; no ad-hoc control styling.
    - Reuse the existing manage-team wiring (`canManageActiveTeam`, `onManageTeam`/`teamRoute`) rather than introducing a parallel path.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/App.tsx (the team-management wiring: `canManageActiveTeam`, `onManageTeam`, `teamRoute`, the `Library` render around line 820)
    - @src/library/Library.tsx (the All Boards page bar and its `menu` slot)
    - @src/shell/SpaceSwitcher.tsx (the existing gear: icon, `aria-label`, gating)
    - @src/shell/SidebarRail.tsx (the icon-only mode that lacks any management entry)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects. Re-read and restate each verbatim in the final message. If `_None._`, write `Follow-ups: none.`

## Plan

### Goal

Team management must be reachable at every sidebar width. Today the only entry is the gear on the active team row in the full sidebar (`SpaceSwitcher.tsx`). In rail (icon-only) mode the sidebar collapses to `SidebarRail`, which has no gear, so management is only reachable indirectly by expanding the nav overlay behind the `ListTree`/"Notes" toggle. Add a stable entry on the team's own library surface that does not depend on sidebar width.

### Requirements

- On the **All Boards (team library) surface**, add a **`Manage team…` item** to the page bar's existing overflow (`⋯`) menu when the active space is a team the user may manage.
    - Place it at the top of the menu, above the existing `Import JSON…` / export items.
    - Gate it on the same condition as the sidebar gear: a coach of that team or an admin (the `canManageActiveTeam` value `App.tsx` already passes to the sidebar). Never show it in the personal space or for a team the user can only view.
    - Activating it navigates to the team page, reusing the same target as the sidebar gear (`teamRoute(teamId, allTeams)`).
    - Give it the Lucide `Settings` icon, consistent with the sidebar gear.
- Keep the existing sidebar gear in `SpaceSwitcher` unchanged; the new control is an addition, not a replacement.
- The showcase (Inspiration) team follows the same rule: the control appears only for a curator, matching the sidebar gear's current behaviour.

### Non-goals

- No change to the rail (`SidebarRail`) itself: do not add a gear to the icon rail.
- No change to the breadcrumb.
- No change to who may manage a team or to the team page itself.
- Do not add the control to note pages within a team; the team library (the team's landing surface) is the single new home.

### Constraints

- The menu already arrives as a ReactNode from `App.tsx` (the `menu` prop on `Library`, built as the `ExportMenu` with its `MenuItem` children). Add the `Manage team…` item there, where `canManageActiveTeam` and `teamRoute` already live; `Library` itself should need no change.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill. Cover:

- The `Manage team…` menu item renders on the team library when the user may manage, and activating it routes to the team page.
- It is absent in the personal space and when the user may only view the team.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- Team management is reachable from the team library page bar at full, rail, and drawer widths, gated to coaches/admins, routing to the same place as the sidebar gear.
- The sidebar gear still works unchanged.
- Documentation is updated to match (see Documentation).

### Documentation

After the code is done, update the docs so they describe the new entry point and stop implying a header "Team" action that does not exist:

- `docs/architecture.md` — the "Navigation and the app shell" section currently says the header carries a "Team" action; correct it to describe the actual entry points (the sidebar gear and the new team-library page-bar control), and note the rail/drawer reach.
- `AGENTS.md` — only if its module-map description of the shell/team surfaces is made inaccurate by the change.

## Follow-ups

_None._

## Implementation Notes

- **Where the item lives.** Added the `Manage team…` `MenuItem` to the library page bar's `ExportMenu`, built inline in `App.tsx` (the `route.kind === "library" || route.kind === "note"` branch, ~line 824). `Library.tsx` needed no change: it already takes the menu as a `ReactNode` prop. The item leads the menu's `children`, above `Import JSON…` / `Draft preview…`, so it sits at the top under the export defaults.
- **Gating.** Shown only when `activeSpace.kind === "team" && canEdit`. This is exactly the `canManageActiveTeam` (`!personal && canEdit`) value `App.tsx` already passes to the sidebar, so the page-bar control and the sidebar gear gate identically. The `activeSpace.kind === "team"` form (rather than `!personal`) is required to narrow the `Space` union so `activeSpace.teamId` type-checks. The showcase follows the same rule by construction: a curator's `canEdit` is true in the showcase team, a viewer's is not.
- **Navigation.** Activating it calls `navigate(teamRoute(activeSpace.teamId, allTeams))`, the same target as the sidebar gear's `onManageTeam`, so both routes land on the same team page.
- **Icon.** Uses Lucide `Settings` (matching the sidebar gear), `aria-hidden`, with `className="gap-2"` on the `MenuItem` (whose `OVERLAY_ITEM` base is already `flex items-center`) for icon-to-label spacing. The icon being `aria-hidden` keeps the menu item's accessible name "Manage team…".
- **Tests.** Added three tests to the existing `team management` describe block in `tests/App.test.tsx`: the coach reaches management from the page-bar menu and lands on the team page (asserts the team page's "Invite member" button), the item is absent in the personal space, and a player on the team library gets no item. Full `App.test.tsx` suite: 70 passed.
- **Diagnostics.** Prettier, ESLint, and `tsc --noEmit` all clean.
- **Docs.** Rewrote the stale "Navigation and the app shell" bullet in `docs/architecture.md` that claimed the header carries a "Team" action: it now describes the real top bar (breadcrumb plus the account control, drawer toggle in drawer mode), notes the brand/space-switcher/admin live in the sidebar/rail, and documents both team-management entry points (sidebar gear and the new page-bar control) with their rail/drawer reach. `AGENTS.md` needed no change: its module map does not describe this entry point.

### Critical Issues

_None._
