# Rotation slips: handover

This branch adds team rosters, games, and printable rotation slips.
The code, unit tests, and RLS test are written and pass in the cloud session that built them.
Your job is to verify it locally, then walk the user through the checks only they can do.

## What was built

### Database

- Migration `supabase/migrations/20261024203951_rotation_slips.sql` adds two tables.
    - `roster_players`: a team's players (number 0–99, name, main and optional secondary position). Removing a player sets `archived_at`. A number is unique among a team's active players.
    - `games`: a name, an optional `played_on` date, a `squad` of roster ids, and `lineups` as JSON.
- RLS on both: any team member reads, a coach of the team or an admin writes. Purging a team cascades both away.
- `supabase/tests/rls_policies_test.sql` gains a section for both tables (coach, player, outsider, admin), on its own team C because team A is purged earlier in the file.

### App

- `src/games/`: the model (`types.ts`), pure lineup operations (`lineup.ts`), the stores (`useRoster`, `useGames`), `GamesPage`, `GamePage`, `LineupEditor`, and `RotationSlip`.
- `src/team/RosterSection.tsx` and `PlayerDialog.tsx`: the roster on the team page.
- `src/print/GamePrint.tsx`: the print document.
- Routes `/t/<team>/games`, `/t/<team>/games/<id>`, and `/t/<team>/games/<id>/print`. Team spaces only.
- A **Games** row in the sidebar under All Boards, in team spaces.

### Behaviour

- A new lineup fills a 5-1 in service order with the setter in I, by main position, lower numbers first. Any six players are allowed after that.
- Choosing a player who is already on court swaps the two. Rotate buttons shift everyone one position either way.
- Each lineup has a libero, planned subs per starter, free-text notes, and the rotated versions to print (stored as shifts; default setter in I and II).
- The game page autosaves 600 ms after the last edit, on leaving, and before opening the print view. Players see each lineup read-only as its slip.
- Print: one section per lineup, its chosen versions side by side, three to a row, subs and notes once below.
- Deleting a game is a hard delete behind a confirm. Admin recovery does not cover games.

## Agent checks

Run these yourself and report the results.

1. `npm ci`, then `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run build`.
2. `npm run test`. Expect 72 files and 752 tests passing.
3. `npm run test:rls`. Expect "RLS tests passed".
4. `npm run dev:migrate` to confirm the migration applies cleanly on a fresh stack. Stop it afterwards.

Do not drive the browser to click data into existence. The UI checks below are the user's.

## User steps

Use the `user-steps` skill: one step at a time, and wait for each result before giving the next.

1. **Try it as a coach.** Have the user run `npm run dev:migrate` (it signs in as the seeded coach) and open the Demo Team.
    - On the team page (Manage team…), add six to eight players covering a 5-1 plus a libero. Try a duplicate number and check the error.
    - Open **Games** in the sidebar, create a game, and check the whole roster is in the squad.
    - Add a lineup and check it fills as a 5-1 with the setter in I. Rotate both ways, swap two players, add a sub, write a note, and toggle print versions.
    - Reload the page and check everything was saved.
2. **Print.** Have them click **Print slips**, then print to PDF on A4.
    - Check three slips fit across a page, names are readable, a lineup's slips do not split across pages, and the PDF reads in greyscale.
    - Ask for their verdict on the look. This is a judgment call only they can make.
3. **Try it as a player.** Have them sign out and use the Player quick sign-in.
    - The roster and games must be read-only: no add, edit, delete, or autosave.
4. **Before merging.** Have the user delete this handover file in its own commit (plans never reach `main`), then open the PR.
    - The PR will be flagged as a database change. Merging applies the migration to production automatically.
    - After the merge, verify both tables exist in production with a read-only Supabase MCP query.
