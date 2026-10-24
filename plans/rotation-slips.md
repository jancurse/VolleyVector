# Rotation Slips

## Implementation Agent Instructions

- **Role**: Senior React + TypeScript + Supabase engineer with a strong eye for print and editorial design.
- **Task**: Add a per-team player roster and a Games surface where a coach picks a squad, builds starting lineups, and prints them as rotation slips.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Load the `supabase` skill before any database work, and the `frontend-design` skill before building the UI.
    - Every access rule is enforced by RLS and covered in `supabase/tests/rls_policies_test.sql`.
    - The printed slip must read as a real line-up slip a coach is proud to hand over, not a generic table.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md
    - `src/boards/rotation.ts` (official slots, 5-1 service order)
    - `src/court/roles.ts` (position vocabulary and colours)
    - `src/print/` (the print surface and routes)
    - `src/team/TeamPage.tsx`, `src/routing/route.ts`, `src/shell/Sidebar.tsx`
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there (one feature per top-level bullet, its tasks as sub-bullets). Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`, so the user can review what you deferred. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Open Issues

1. Where Games live in the navigation.
2. What happens to games when a roster player is removed.
3. The printed slip's exact layout and how slips fill a page.

### Goals

- A team keeps one roster of its players.
- A coach creates games, picks a squad from the roster, and builds one or more starting lineups per game.
- A coach prints each lineup as a rotation slip, in as many rotated versions as needed, because who serves first is unknown before the match.

### Non-goals

- Rosters or games in the personal space. Both are team-only.
- Revision history, conflict detection, sharing, share links, or the access-list grant model. Games and rosters follow team roles only.
- In-match tracking (live rotation, score, used subs).
- Bundle export/import of games or rosters.

### Roster

- Each team has a roster. A roster player has a jersey number, a name, a main position, and an optional secondary position.
- Positions are setter, outside, middle, opposite, libero, drawn with the same colours as the court roles in `src/court/roles.ts`.
- A jersey number is unique within a team's roster.
- The roster is managed on the team page. A coach of the team (or an admin) adds, edits, and removes players. Any team member views it.

### Games

- A game has a name and an optional date. It is deliberately lightweight, so a coach can also use one for a general lineup idea rather than a real match.
- A game belongs to one team. Coaches of the team (and admins) create, edit, and delete games. Players view them read-only.
- A game holds a squad: the subset of the roster picked for it.
- A game holds one or more lineups, built from its squad.

### Lineups

- A lineup assigns six squad players to the official positions I–VI, plus an optional libero.
- Any six players are allowed. When the six picked players form a 5-1 by main position (one setter, two outsides, two middles, one opposite), the lineup defaults to 5-1 service order with the setter in I.
- Two controls rotate the lineup by one position, one in each direction: forward (the volleyball rotation, II moves to I) and back.
- Each position may carry one or more alternatives: squad players planned as subs for that starter.
- A lineup has a free-text notes field, shown beside the slip and printed with it.
- A lineup can be named (e.g. "Set 1", "vs. tall blockers"). An unnamed lineup is numbered.

### Printing

- The game has one print action. It opens a chrome-free print surface (like the existing board and note print routes) with the game's lineups.
- For each lineup the coach chooses which rotated versions to print: the lineup as entered plus any number of rotations forward. The common case is two versions, setter in I and setter in II.
- Each version prints as its own slip. A version is labelled by where the setter stands (e.g. "Setter in II") when the lineup has a setter, otherwise by its rotation offset.
- A slip carries the team name, the game name and date, the lineup name, positions I–VI with jersey numbers and names, the libero, the alternatives, and the lineup notes.
- The slip's design follows the look of a real line-up slip: the server-order row I–VI that a scorer reads, alongside a court diagram of the six positions (front row IV-III-II, back row V-VI-I). It uses the app's type system and role colours, and stays legible printed in greyscale.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- The pure lineup operations (default 5-1 assignment, rotate forward and back, versions for print, setter labelling) have unit tests.
- The RLS test covers roster and game access for coach, player, non-member, and admin.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- `npm run test:rls` passes.
- A coach can build a roster, create a game, pick a squad, build a lineup that defaults to 5-1 with the setter in I, rotate it both ways, add alternatives and notes, and print it in several rotated versions.
- A player sees the roster and games read-only, and a non-member sees neither.
- `docs/architecture.md` and the module map in `AGENTS.md` describe the new module and tables.

## Follow-ups

_None._

## Implementation Notes

### Critical Issues
