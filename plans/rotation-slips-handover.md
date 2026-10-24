# Rotation slips: handover

This branch adds team rosters, games, and printable rotation slips.
The first round was built in a cloud session and verified locally.
The user then reviewed it, and every change from that review (`plans/rotation-slips-followups.md`) is now built.
Format, lint, typecheck, build, the unit tests (73 files, 783 tests), and the RLS test all pass.
The next step is the user's second review.

## What was built

### Database

- Migration `supabase/migrations/20261024203951_rotation_slips.sql` adds two tables. It has not reached production, so it was edited in place rather than followed by a second migration.
    - `roster_players`: a team's players (number 0–99, name, main and optional secondary position). Removing a player sets `archived_at`. A number is unique among a team's active players.
    - `games`: a name, an optional `played_on` date, a `squad` of roster ids, `overrides` (one-game number or position changes per player), `overview` (print flag and rotation), and `lineups`, all but the squad as JSON.
- RLS on both: any team member reads, a coach of the team or an admin writes. Purging a team cascades both away.
- `supabase/tests/rls_policies_test.sql` covers both tables (coach, player, outsider, admin) on its own team C.

### App

- `src/games/`: the model (`types.ts`), pure lineup operations (`lineup.ts`), the roster import parser (`rosterImport.ts`), the stores, `GamesPage`, `GamePage`, `SquadDialog`, `LineupEditor`, `PlayerPicker`, and the slips (`SlipFrame`, `SlipCourt`, `ZonePlayer`, `RotationSlip`, `OverviewSlip`).
- `src/team/`: `RosterSection`, `PlayerDialog`, and `RosterImportDialog` on the team page.
- `src/print/GamePrint.tsx`: the print document.
- Routes `/t/<team>/games`, `/t/<team>/games/<id>`, and `/t/<team>/games/<id>/print`. Team spaces only.
- A **Games** row in the sidebar under All Boards, in team spaces. The games page has a **Roster** button for every member.

### Behaviour

- **Roster.** A coach adds players one by one or imports pasted spreadsheet rows or a CSV (number, name, main, optional secondary). The import previews every line with its error and only adds.
- **Squad.** A table on the game page. **Pick squad** opens a filterable checklist, where a picked player can also get a different number or positions for this game only.
- **Overview.** A slip showing every squad player at the zone a 5-1 gives their main position. Outsides and middles appear in both of their zones. It rotates, and **Print the overview** puts it first in the print.
- **Lineups.** A new lineup fills a 5-1 with the setter in I. The coach edits on the slip: each zone and the libero cell open a player picker. With **5-1 suggestions** on (the default), the picker lists main-position fits, then secondary fits, and hides everyone else behind **Show everyone else**. Picking a player already on court swaps the two. The rotate buttons sit beside the stamp.
- **Possible subs.** Per starter, picked only from players off court and not the libero.
- **Saving.** The game page autosaves 600 ms after the last edit, on leaving, and before opening the print view.
- **Players.** They see the same slips read-only and may rotate them.
- **Print.** 12 mm page margins. The overview first if chosen, then each lineup as one block: its chosen versions three to a row, possible subs and notes once below.
- Deleting a game is a hard delete behind a confirm. Admin recovery does not cover games.

## How to test

Run `npm run dev:migrate` and open <http://localhost:5173>. It signs in as the seeded coach, on a fresh database built from this branch.

In the sidebar, switch to **Demo Team**, open **Games**, then **Roster** → **Import…**, and paste:

```text
number,name,main,secondary
1,Lena Vogt,S,
3,Ana Ruiz,S,OPP
2,Tess Moor,L,
4,Mia Kraus,OH,
11,Sara Lind,OH,OPP
17,Kim Roth,OH,MB
5,Jana Weiss,MB,
15,Ida Berg,MB,
9,Nora Falk,OPP,OH
```

Back in **Games**, create a game and play. **Print slips** opens the print view.
For the player view, sign out from the avatar menu and use the **Player** quick sign-in.

## Before merging

1. Delete this handover and the follow-ups file in their own commit (plans never reach `main`), then open the PR.
2. The PR will be flagged as a database change. Merging applies the migration to production automatically.
3. After the merge, verify both tables and their columns exist in production with a read-only Supabase MCP query.
