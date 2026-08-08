# Opponent side: handover

Branch `claude/opponent-side-board-feature-7kxmsv`, for issue [#50](https://github.com/jancurse/VolleyVector/issues/50). The plan is beside this file in `plans/opponent-side.md`. Both are deleted before the squash merge.

## What was built

A board can show the opponent half and hold markers on it. It is off by default, so every existing board renders exactly as before.

- **Coordinates did not change.** Our half keeps normalized y 0 to 1. The opponent half runs -1 to 0, so no stored position, annotation, or revision changes meaning and there is no data migration. Turning the half on opens the SVG `viewBox` upward instead of altering the mapping, which is why dragging, drawing, and snapping needed no new maths.
- **A marker carries an optional `side`.** Opponent players draw as rounded squares in the same role colours, so the two teams stay apart at thumbnail size and in greyscale rather than by colour alone. The ball is neutral: one ball crosses the net.
- **Rotation stays our side's feature.** Opponent markers never enter a preset roster or a custom assignment. Tightening that also closed an existing gap: a custom assignment used to accept any marker id, so the ball could be given an official position.
- **New per-board column `opponent_side`**, plus the editor controls: an On/Off toggle in the court settings gear, a side switch in the marker palette, and a side switch in the selected marker's inspector.

## Your steps

### 1. Use the branch database, not the shared one

This branch adds a column and replaces the `commit_board` function. Your shared local database is built from `main`, so it does not have either, and `npm run dev` against it will fail to save a board.

```sh
git fetch origin claude/opponent-side-board-feature-7kxmsv
git checkout claude/opponent-side-board-feature-7kxmsv
npm install
npm run dev:migrate     # a temporary database built from this branch's migrations
```

`npm run dev:migrate` tears its database down on exit. Your shared stack is untouched, so `npm run dev` on `main` keeps working as before.

### 2. Run the checks I could not

This container has no Docker, so I could not run the RLS test, start a dev server, or look at the app. Everything below is unverified by me:

```sh
npm run test:rls    # needs Docker; the migration replaces commit_board, so this is the one that matters
```

`npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build` all pass here.

### 3. Look at it

With `npm run dev:migrate` running, on a new board:

1. Open the court settings gear, set **Opponent side** to **On**. The court should grow to the full 13:23 court with the opponent half above the net, two attack lines, and the front zones shaded as one band across the net.
2. The marker palette gains a **Our team / Opponent** switch. With **Opponent** armed, the role swatches turn square and a pressed role lands on a bench above the opponent's end line.
3. Select an opponent marker: the inspector shows the same side switch, so a marker added to the wrong team is one press from fixed.
4. Set up a 5-1 on our side and turn a rotation on. The rotation panel and its zone diagram should only ever offer our six players, and no opponent marker should draw a violation edge.
5. Drag an opponent marker and draw an annotation on the far half: both should reach the opponent end line and stop there.
6. Set **Opponent side** back to **Off**. A dialog names how many markers go; confirming removes them from every step, and one undo brings them back. One of our own markers left standing over the net comes back within reach of our half rather than vanishing.
7. Then check the surfaces that only pass the flag through: the board's library card, its note card, the `…/print` route, and a narrow window (the court fills the column and the page never scrolls sideways).

**This is the part I would look at hardest**: whether the full court at its own size budget (`--court-size-full`, about 500px wide on a desktop) reads well beside the description and rotation panel, and how it behaves between roughly 1000px and 1200px wide, where the two-column layout stacks. That is a judgement call about proportion, and screenshots would not settle it.

### 4. Production

Nothing reaches production until the PR merges. On merge, `.github/workflows/migrate-prod.yml` pushes the migration after CI passes on `main`, the same green-`main` gate as the deploy. The PR will carry the `database-migration` label from the migration guard, which is your cue to read the migration before merging.

The migration is additive: it adds `opponent_side boolean not null default false` and replaces `commit_board` so the function writes the new column. That replacement reads `coalesce((content->>'opponent_side')::boolean, false)`, so a browser tab still running the old bundle commits a board as a half-court board rather than failing on a not-null violation.

## Left out on purpose

- **Hiding the opponent half clears its markers, but not annotations drawn on it.** A shape drawn on the far half stays in the step and reappears if the half is turned back on. Markers are cleared because an invisible marker still feeds the derived arrows and the marker count; an annotation is inert. Removing a coach's drawings without being asked seemed worse than keeping them.
- **The opponent has no rotation of its own**, per the issue's non-goals.
- **No new board-creator example bundle.** The skill's `format.md`, `court.md`, and `validate.mjs` carry the new fields, and the four existing examples moved to `formatVersion` 4, but none of them uses an opponent half.
