# Topics — a coach-curated hierarchy for organizing boards

## Implementation Agent Instructions

- **Role**: A frontend engineer extending a polished SVG-based React app with a content-organisation layer — a navigable, nestable topic tree — without regressing the existing board view, editor, or playback.
- **Task**: Add **Topics**: a coach-curated, nestable hierarchy that gives each board an optional home topic and each topic an optional markdown explanation, browsed from a persistent left sidebar.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature, and reuse what exists (the `Court`, `LibraryCard`, `DescriptionEditor`, and markdown rendering) rather than rebuilding it.
    - Write clean, easy-to-maintain code.
    - No regression to the board view, editor, or playback: opening, editing, and playing a board behaves exactly as today.
    - Match the existing restrained visual language; the sidebar must read as quiet and typographic, not as heavy app chrome.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @plans/project_overview.md
    - The surfaces this touches: `src/boards/`, `src/library/`, `src/editor/BoardView.tsx`, `src/editor/BoardEditor.tsx`, `src/App.tsx`, and `src/index.css`.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.` Do not implement follow-ups unless explicitly asked.

## Plan

### Goal

Give the library a coach-curated structure on top of its flat grid. **Topics** form a nestable tree the coach authors; each board may have one **home topic**, and each topic may carry a markdown explanation of its subject. The result reads like a team handbook: a left-hand table of contents, and for each topic an explanation followed by the boards that illustrate it. Tags are unchanged and keep doing their cross-cutting job alongside topics.

### The model

- A **Topic** is a tree node with: `id`, `title`, an optional markdown `body`, a parent (nullable, for nesting), and an order among its siblings.
- Nesting depth is the coach's call — the tree supports arbitrary depth rather than capping it.
- A **board has at most one home topic** (single membership, not many — cross-cutting reuse is what tags are for). A board with no home topic is **Unfiled**. This single home-topic reference is the one source of truth for membership; nothing else duplicates it.
- Boards within a topic carry a **coach-controlled manual order** that persists. The board-tree order and the order of boards within a topic are both authored, not derived.
- Topics are persisted in their own localStorage store (e.g. `volleycoach-topics`), seeded on first run with a small starter tree so the sidebar is not empty. The board store gains the home-topic reference; boards saved before this feature default to Unfiled.

### Navigation and layout

- The browse surface gains a **persistent left sidebar** acting as the table of contents:
    - **All Boards** sits at the top — today's full grid with its type and tag filters, unchanged.
    - Below it, the **topic tree**, with disclosure controls for nested topics.
    - An **Unfiled** view so a coach can find and file boards that have no home topic yet.
- Selecting a topic shows a **content pane** with the topic's markdown explanation at the top (rendered in the existing description typography), then the grid of that topic's boards. The Positions / Sequences toggle and the tag chips stay available and filter within the topic.
- A topic page shows the boards filed **directly** in that topic, not those of its descendants. A topic's subtopics are reached through the sidebar (and may be linked at the top of the page); they are not folded into the parent's grid.
- The sidebar belongs to the **browse surface only**. Opening a board into its read-only view or the editor stays **full-width**, exactly as today; the board view/editor and playback are untouched.

### Authoring (coach)

- Coaches **create, rename, delete, nest, and reorder** topics, and edit a topic's markdown body. Players see topics read-only.
- A topic page follows the existing **view-first → edit-draft** pattern (as `BoardView` → `BoardEditor`): read-only by default, with an Edit affordance for coaches for the topic's title and markdown body.
- **Filing a board** is done from the board editor: a single-select **Topic picker** (offering the topic tree plus a None / Unfiled option) sets the board's home topic, alongside the existing tag editor.
- **Curating a topic's boards** is done on the topic page: a coach can **reorder** the boards in a topic and **remove** a board from it (returning it to Unfiled). The manual order persists.

### Non-goals

- No change to the court, markers, arrows, geometry, palette, inspector, drag, theme, or playback.
- No change to the board model's markers/steps, nor to the tag system, autocomplete, or filtering mechanics.
- No backend; topics live in localStorage like boards (the Phase 2 schema maps a topic to a self-referential `parent_id` row and a board to a `topic_id`, but that is out of scope here).

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- Cover the topic operations (create, rename, delete, nest, reorder) and the topic store's seed/load.
- Cover filing a board via the editor's Topic picker, the Unfiled fallback, and that removing a board from a topic returns it to Unfiled.
- Cover the manual order of boards within a topic persisting.
- Cover the sidebar navigation: All Boards vs. a selected topic vs. Unfiled, and that a topic page lists exactly its directly-filed boards (not its descendants').

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- A coach can create, rename, delete, nest, and reorder topics, and write a markdown explanation for each.
- Each board can be filed under one home topic from the board editor or left Unfiled; the sidebar browses All Boards, each topic, and Unfiled.
- On a topic page a coach can reorder its boards and remove one (returning it to Unfiled), and the order persists.
- A topic page shows the topic's markdown explanation above the grid of its directly-filed boards, with the type and tag filters working within it.
- Opening, editing, and playing a board is unchanged, and the board view/editor remain full-width.

## Follow-ups

_None._

## Implementation Notes

Topics live in their own store (`src/topics/`: `types`, `operations`, `storage`, `useTopics`) mirroring the boards store. A board gains `topicId` (its one home-topic reference, the sole source of truth for membership) and `topicOrder` (its manual order within that topic). The browse surface (`src/library/Browse.tsx`) puts a quiet `TopicSidebar` table of contents beside a content pane that shows All Boards, Unfiled, or one topic's page; the board view, editor, and playback are untouched and stay full-width.

### Critical Issues

- **Forward-fill of pre-Topics boards is the loader's only defaulting.** Boards saved before this feature carry no `topicId`/`topicOrder`, so `loadBoards` maps each loaded board to `{ topicId: null, topicOrder: 0 }` defaults — i.e. Unfiled. This is the single migration path; topics have no legacy form, and once a board is re-saved it carries the fields, so the map becomes a no-op.
- **The seed is first-run only.** `SAMPLE_TOPICS` seeds a browser that has nothing stored yet. A browser that already persisted a topic tree keeps it — changing the seed does not rewrite it. To pick up a changed seed, clear site data (or delete the stale topics in the UI). This is why a developer who ran an earlier build still sees the earlier tree until they clear `volleycoach-topics`.

### Key Decisions

- **Membership and order both live on the board.** `topicId` is membership; `topicOrder` is the manual order among a topic's boards. A topic never lists its boards, so nothing duplicates membership (the plan's spine rule). `boardsInTopic` derives a topic's ordered boards; `Browse` treats a board whose `topicId` is null _or_ points at a missing topic as Unfiled, so a dangling reference never hides a board.
- **Filing vs. reordering touch `updatedAt` differently.** Filing happens through the board editor's Topic picker and commits on Done, so it goes through `updateBoard` and bumps `updatedAt` (it is a board edit); `App.commit` assigns a fresh `topicOrder` only when the home topic actually changed. Structural curation on a topic page (`moveBoardInTopic`, `unfileBoards`) is deliberately _not_ a content edit and leaves `updatedAt` alone, so reordering within a topic never churns the All-Boards recency order.
- **Deleting a topic cascades the subtree but never deletes boards.** `deleteTopic` removes the topic and all descendants; `App.removeTopic` coordinates the two stores — it returns every board filed under any removed topic to Unfiled, deletes the subtree, resets the selection if it pointed inside it, and confirms first (as board deletion does).
- **Reuse over rebuild.** `BoardGrid` (extracted from `Library`) carries the type/tag filters and the card grid for all three surfaces (All Boards, Unfiled, topic page); `LibraryCard`, `DescriptionEditor`, and markdown rendering are reused unchanged; `TopicPicker` (a depth-indented `<select>`) is shared by board filing (None → Unfiled) and topic nesting (None → Top level, excluding self + descendants to bar cycles).
- **Authoring surfaces follow the existing patterns.** A topic page is view-first (`TopicView`) → edit-draft (`TopicEditor`), exactly like `BoardView` → `BoardEditor`: the draft edits title, markdown body, and parent (nest), with Delete beside Done. Structural reorder among siblings lives in the sidebar as hover-revealed up/down controls, where the siblings are visible. The sidebar is navigation plus a quiet "+ New topic"; a topic page adds "+ Subtopic".
- **No role gating in Phase 1.** There is no auth yet, so all topic authoring is shown, consistent with the board editor already being open to everyone. "Players see topics read-only" is a Phase 2 (RLS) concern, not implemented here.
- **Selection lives in `App`.** Holding the browse selection in `App` (not `Browse`) keeps it across opening and closing a board, so returning from a board lands back on the topic you were browsing. The in-place topic edit state stays local to `Browse`.
- **Flat starter seed.** At the user's request the seed is three flat top-level topics — Rotations, Defense, Drills — with no nesting. Nesting itself is fully supported (arbitrary depth) and covered by tests; only the seed is flat. The two sample boards are filed (Base defence → Defense, Serve receive to outside → Drills) so the seed leaves nothing Unfiled.

### Verification

- `npm run typecheck`, `npm run lint`, and `npm run format:check` all pass.
- `npm run test` — 127 passed (10 files). Added: topic `operations` (create, rename, delete, nest with cycle guard, reorder, flatten, subtree) and `storage` (seed/round-trip/invalid) suites; board topic-ordering ops (`boardsInTopic`, `nextTopicOrder`, `moveBoardWithinTopic`); the legacy-board → Unfiled normalization; and App integration tests for sidebar navigation (All Boards / topic / Unfiled), filing via the editor's Topic picker, the Unfiled fallback for a new board, remove-from-topic → Unfiled, nesting with a parent page listing only its directly-filed boards (not descendants'), creating and explaining a topic, and the delete cascade returning boards to Unfiled.
- Checked on screen with Playwright: the browse surface (quiet sidebar — All Boards, the flat Rotations/Defense/Drills tree, Unfiled, + New topic — beside the unchanged grid), a topic page (explanation above the directly-filed board with the type/tag filters and per-card reorder/remove), the topic editor (title, explanation, parent picker), and the board editor staying full-width with the Topic picker in the side column.
