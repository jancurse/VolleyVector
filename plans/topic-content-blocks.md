# Topic content blocks

## Implementation Agent Instructions

- **Role**: A frontend engineer fluent in this app's React 19 + TypeScript model, the topic/board stores, and the view-first / edit-draft editor pattern.
- **Task**: Replace a topic's single markdown body with an ordered list of interleaved blocks (markdown prose and board groups), and remove the type/tag filtering from topic pages.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Keep board membership on `Board.topicId` as the single source of truth. A topic's blocks own only placement and layout, never membership.
    - Reuse the existing draft-commit editor flow and the existing reorder idiom (up/down buttons), rather than introducing new patterns.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md (the "Organising boards" and "State, persistence, and the app shell" sections)
    - `src/topics/` (types, operations, storage, useTopics, TopicView, TopicEditor, Browse)
    - `src/library/BoardGrid.tsx`, `src/library/LibraryCard.tsx`, `src/library/items.ts`
    - `src/boards/operations.ts`, `src/boards/useBoards.ts`, `src/boards/types.ts`, `src/App.tsx`
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.` Do not implement follow-ups unless explicitly asked.

## Plan

### Goals

- A topic page reads as a document: a coach writes prose, shows a group of boards, writes more prose, then shows alternatives, in any order they choose.
- Topic pages no longer carry the All Boards type/tag filter controls.

### Non-goals

- Per-board variations (a board branching into slight variants). Explicitly out of scope.
- Drag-and-drop block or board reordering. Up/down buttons only for now.
- Showing a board on a topic page that is filed under a different topic. A board has at most one home topic; a topic shows only its own members.

### Data model

- Add a discriminated union and replace `Topic.body` with an ordered block list:

```ts
type TopicBlock =
  | { id: string; kind: "markdown"; text: string }
  | { id: string; kind: "boards"; boardIds: string[] };

type Topic = {
  id: string;
  title: string;
  blocks: TopicBlock[]; // replaces `body`
  parentId: string | null;
  order: number;
};
```

- A `"boards"` block's `boardIds` are **placement hints**, not membership. They are intersected with the topic's actual members (boards whose `topicId` is this topic) at render and at edit, so a stale id silently drops. When the same id appears in more than one group (only reachable through bad stored data, never the editor), the first occurrence wins and later ones drop, so a board never renders twice.
- Drop `Board.topicOrder` entirely. Blocks are the only manual ordering. A topic's members default to newest-first (`updatedAt` descending), matching the library.
- **No backward compatibility.** The app is still in development with no real stored data, so nothing migrates old `localStorage`. Updating the seeds and validators is enough; a stale store is simply discarded and reseeded.

### Rendering a topic page (`TopicView`)

- Compute `members` = boards filed in this topic, newest-first.
- Render the subtopic link row directly under the title bar, above the content blocks, as a persistent navigation row.
- Walk `topic.blocks` in order:
    - `markdown` → render with `ReactMarkdown` (same `vc-markdown` treatment as the current body).
    - `boards` → render a card grid (reused `LibraryCard`s) for `boardIds` filtered to `members`, in the block's order, dropping any id already shown by an earlier group. Skip a board group that resolves to zero boards.
- After the blocks, render any **unplaced members** (filed here but not referenced by any `boards` block) in a trailing card grid, newest-first, so a filed board can never disappear. Omit the trailing grid when every member is placed.
- The page no longer renders the filtering controls or per-card reorder/remove controls. Opening a card still opens the board.

### Editing a topic (`TopicEditor`)

- Keep the existing draft-commit flow: the editor holds a local draft of `blocks` (alongside title and parent) and commits the whole array on **Done**. No new store mutations are needed beyond widening the commit patch.
- The block editor is an ordered list. Each block shows:
    - a **markdown** block → the existing `DescriptionEditor` (compact variant), with up/down reorder and a remove action.
    - a **board group** block → a picker over the topic's member boards (which boards are in the group and their order within it), with up/down reorder and a remove action for the block itself.
- Add-block affordances let the coach append a markdown block or a board-group block to the list.
- The board-group picker offers only this topic's members. A board may appear in at most one group within the topic; once placed it is not offered to other groups.
- **Members come from the live `boards` prop, never copied into the draft.** The draft holds only `blocks` (plus title and parent). Membership is derived from the boards prop on every render, so an immediate unfile (below) drops the board from the picker and groups at once. A `boardIds` entry whose board is no longer a member is ignored when rendering the group, exactly as on the view.
- The board-group editor also offers an **unfile** action per member, which removes the board from the topic (sets its `topicId` to null). This is a board-membership edit, so it calls the board store directly and takes effect immediately rather than waiting for the topic draft's **Done**. Because it commits straight to the board store, **Cancel** does not revert an unfile (it only discards the `blocks`/title/parent draft). Wire `unfileBoards` through `Browse` into `TopicEditor` for this.

### Operations and store

- `topics/operations.ts`: add pure helpers over `TopicBlock[]` — append/insert a block, update a markdown block's text, set a board group's `boardIds`, reorder a block up/down, remove a block. Update `createTopic` to seed `blocks: []` and `setTopic` to patch `title`/`blocks` instead of `title`/`body`.
- The `body → blocks` swap touches three coupled commit sites that all carry the old field; change them together:
    - `topics/useTopics.ts`: widen `updateTopic`'s patch type from `Pick<Topic, "title" | "body">` to `Pick<Topic, "title" | "blocks">`.
    - `topics/TopicEditor.tsx`: change `onDone`'s patch type from `{ title; body; parentId }` to `{ title; blocks; parentId }`, and hold `blocks` in the draft instead of `body`.
    - `src/library/Browse.tsx`: the `onDone` handler commits `updateTopic(id, { title: patch.title, body: patch.body })` — change `body` to `blocks`. `parentId` keeps going through `reparentTopic` separately, unchanged.
- `topics/storage.ts`:
    - Update `isTopic` to validate `blocks` as an array of valid `TopicBlock`s (each a `markdown` block with a string `text` or a `boards` block with a `string[]` `boardIds`), replacing the `body` string check. No migration: a store that fails validation is discarded and reseeded.
    - Update `SAMPLE_TOPICS` so each seed topic carries a single markdown block holding its current body text. No seed includes a board group; sample boards filed under a topic appear as unplaced members in its trailing grid.

### Board-side cleanup (dropping `topicOrder`)

- `boards/types.ts`: remove `topicOrder`.
- `boards/operations.ts`: drop `topicOrder` from `createBoard`; sort `boardsInTopic` by `updatedAt` descending; remove `nextTopicOrder` and `moveBoardWithinTopic`.
- `boards/useBoards.ts`: remove `moveBoardInTopic`.
- `boards/storage.ts`: `isBoard` never checked `topicOrder`, so the validator needs no change. Drop `topicOrder` from the two `SAMPLE_BOARDS` seeds and from the `topicOrder: b.topicOrder ?? 0` default in the load-time map (leave the `topicId` default in place).
- `src/App.tsx`: drop the refile-order logic in `commit` (the `nextTopicOrder` call); remove the `moveBoardInTopic` wiring passed to `Browse`. `unfileBoards` stays and is now routed to the topic editor (see below).
- `src/library/Browse.tsx`: remove the `onMoveBoardInTopic` prop and the per-card reorder/remove wiring into `TopicView`. Pass `unfileBoards` (a single-board unfile) into `TopicEditor` for its board-group unfile action.

### Filtering removal (issue 1)

- Factor the plain card grid (the `vc-grid` of `LibraryCard`s) out of `BoardGrid` into a small reusable piece, used by both the topic page's board groups / trailing grid and by `BoardGrid`.
- Keep the filter-aware empty copy ("Nothing matches these filters" vs the plain `emptyLabel`) inside `BoardGrid`, not the extracted grid. The plain grid only ever shows a plain empty label, so it should not carry filter wording.
- `BoardGrid` keeps the type and tag filters and is used only by the All Boards surface (`Library`). Topic pages render through the filter-less card grid, so the filters are gone from topic pages by construction.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- `topics/operations`: the block helpers (append/insert, update text, set group boards, reorder, remove).
- `topics/storage`: `isTopic` accepts the new block shape and rejects malformed blocks (a non-array `blocks`, an unknown `kind`, a `markdown` block with non-string `text`, a `boards` block with a non-`string[]` `boardIds`). No migration test — there is no legacy shape to migrate.
- `TopicView`: markdown and board-group blocks render interleaved in order; a board group drops ids that are not members; unplaced members render in a trailing grid; no filter controls are present.
- `TopicEditor`: add a markdown block and a board-group block, edit text, assign and reorder boards in a group, reorder and remove blocks, unfile a member, and commit the result.
- `boards/operations`: `boardsInTopic` returns members newest-first. Remove or update tests covering the deleted `nextTopicOrder` / `moveBoardWithinTopic`.
- Update any existing tests that reference `topicOrder`, `moveBoardInTopic`, or the topic page's old filter / per-card controls.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- A topic page renders prose and board groups interleaved in the coach's chosen order, with no type/tag filter controls.
- A board filed in a topic but not placed in any block still appears, in a trailing group.
- A board-group block referencing a board no longer filed in the topic silently omits it; a board listed in two groups renders only in the first; no board renders twice on the page.
- The seed topics open with their explanation as a first markdown block, and seed boards filed under a topic show in its trailing group.

## Follow-ups

- Drag-and-drop reordering for blocks and for boards within a group, replacing the up/down buttons.
- An optional caption/title on a board-group block, if writing a heading in a preceding markdown block proves awkward.

## Implementation Notes

Implemented the plan in full. All format/lint/typecheck checks and the 150-test suite pass, the production build is clean, and the topic page and block editor were verified on screen with Playwright.

### Data model and operations

- `topics/types.ts`: added the `TopicBlock` discriminated union and replaced `Topic.body` with `blocks: TopicBlock[]`.
- `topics/operations.ts`: `createTopic` seeds `blocks: []`; `setTopic` patches `title`/`blocks`. Added block helpers `makeMarkdownBlock`, `makeBoardsBlock`, `appendBlock`, `setBlockText`, `setBlockBoards`, `moveBlock`, `removeBlock`. `setBlockText`/`setBlockBoards` guard on `kind`, so an id that resolves to the other block kind is left untouched.
    - Naming note: the plan sketched "update a markdown block's text" / "set a board group's boardIds"; I named these `setBlockText` / `setBlockBoards` for symmetry. Behaviour matches the plan.
- `topics/storage.ts`: `isTopic` now validates `blocks` as an array of valid `TopicBlock`s via a new `isTopicBlock`; each `SAMPLE_TOPICS` seed carries one markdown block holding its old body text (stable block ids). No migration — a failing store is discarded and reseeded.
- `topics/useTopics.ts`: widened `updateTopic`'s patch to `Pick<Topic, "title" | "blocks">`.

### Board-side cleanup (dropped `topicOrder`)

- `boards/types.ts`: removed `topicOrder`.
- `boards/operations.ts`: dropped `topicOrder` from `createBoard`; `boardsInTopic` now sorts `updatedAt` descending; removed `nextTopicOrder` and `moveBoardWithinTopic`.
- `boards/useBoards.ts`: removed `moveBoardInTopic`.
- `boards/storage.ts`: dropped `topicOrder` from both seeds and from the legacy load-time default (kept the `topicId` default).
- `App.tsx`: removed the `nextTopicOrder` refile-order logic in `commit` and the `moveBoardInTopic` wiring; `Browse` now takes a single-board `onUnfileBoard`.

### Rendering and editing

- `TopicView.tsx`: rewritten as a document — a persistent subtopic-link row under the title, then the blocks in order (markdown via `ReactMarkdown`, board groups as a `CardGrid` intersected with members and de-duplicated across groups), then a trailing `CardGrid` of unplaced members (omitted when empty). Empty markdown blocks render nothing. No filter or per-card controls.
- `TopicEditor.tsx` + new `BoardGroupBlock.tsx`: draft of `title`/`blocks`/`parentId`, committed on Done. Block list with per-block reorder/remove and add-text / add-board-group affordances. The board-group editor offers only unplaced members (a board sits in at most one group), reorders within the group, and exposes a per-member **Unfile** that calls the board store immediately (so Cancel does not revert it). Members derive from the live `boards` prop every render, never copied into the draft.
- `library/CardGrid.tsx` (new): the plain `vc-grid` of `LibraryCard`s with a plain empty label, extracted from `BoardGrid`. `BoardGrid` keeps the type/tag filters and the filter-aware empty copy, renders matches through `CardGrid`, and is now used only by the All Boards `Library`.

### CSS

- Added a `Topic block editor` section (`vc-blocks`, `vc-block`, `vc-block-ctrls`, `vc-block-boards`, `vc-block-board-list`, `vc-block-board`, `vc-block-board-title`, `vc-block-add`); reused `vc-card-ctrl`/`vc-card-remove`; removed the now-orphaned `vc-card-wrap`/`vc-card-controls`.
- Pre-existing bug surfaced and fixed: the base `.vc-markdown { flex: 1; min-height: 190px }` (sized for the board description column) overrode the topic body's content-sizing because it sits later in the file at equal specificity. Changed the override selector to `.vc-markdown.vc-topic-body` so a topic's prose blocks size to content instead of each grabbing 190px of height.

### Tests

- Updated `boards/operations`, `boards/storage`, `library/items`, `topics/operations`, `topics/storage`, and `App` tests for the model change (dropped `topicOrder`/`body`, newest-first `boardsInTopic`, block helpers and block validation, the editor-driven unfile and text-block flows).
- Added `tests/topics/TopicView.test.tsx` (interleaving, group membership filtering, no-double-render, trailing grid, no filter controls) and `tests/topics/TopicEditor.test.tsx` (add/edit/reorder/remove blocks, assign/reorder boards in a group, remove-from-group vs unfile).

### Critical Issues

_None._ All acceptance criteria are met: tests and diagnostics pass; a topic page renders interleaved prose and board groups in order with no filter controls; an unplaced filed board trails in a final grid; stale and duplicate board-group ids are dropped so no board renders twice; the seed topics open with a markdown explanation and their filed boards appear in the trailing grid.
