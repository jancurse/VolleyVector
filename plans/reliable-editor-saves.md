# Reliable Editor Saves

## Implementation Agent Instructions

- **Role**: Senior React + TypeScript engineer with a focus on data integrity and failure-path UX.
- **Task**: Make the board and topic editors' Done commits awaited, retried, and non-destructive on failure, and back the board editor's draft up to localStorage.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - A commit must never silently lose work: every failure path keeps the user's draft reachable and visible.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/boards/useBoards.ts
    - @src/topics/useTopics.ts
    - @src/App.tsx (the `commit`, `cancelEdit`, and draft-reconciliation logic)
    - @src/editor/BoardEditor.tsx
    - @src/topics/TopicEditor.tsx
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there (one feature per top-level bullet, its tasks as sub-bullets). Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`, so the user can review what you deferred. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Context

A field incident showed the current save path losing a board's content permanently.
Board and topic writes are fire-and-forget: the editor discards its draft and navigates away before the request completes.
When the request fails client-side (Safari's "TypeError: Load failed" after a sleep or suspended tab), the store's failure handler refetches and overwrites the optimistic state with the stale server row.
At that point the user's work exists nowhere.

### Goals

- A Done commit either verifiably saves, or keeps the full draft on screen with a clear way to retry.
- A transient network failure is retried automatically before the user ever sees an error.
- A page reload mid-edit cannot destroy a board draft.

### Non-goals

- The small optimistic writes (delete, lock, share, unshare, unfile, move-to-team, topic create/remove/reorder/re-nest) keep their current optimistic-plus-refetch behaviour.
- No change to the server schema, RLS, or Edge Functions.

### Requirements

#### Awaited commits

- The board editor's Done (`commit` in `src/App.tsx`, calling `addBoard`/`updateBoard` in `src/boards/useBoards.ts`) and the topic editor's Done (`updateTopic` in `src/topics/useTopics.ts`) must await the write and report success or failure to the caller.
- While the save is in flight, the editor stays open and the Done action shows a saving state and cannot be pressed again.
- On success, behaviour is unchanged: the draft is dropped and the app navigates to the committed view.
- On failure, the editor stays open with the draft fully intact, an inline error is shown near the Done action, and pressing Done retries the commit. Nothing is discarded and nothing navigates.
- A commit that cannot even be attempted (no active space, no user, or `updateBoard`'s target missing from the list) must surface as a failure too, never as a silent no-op. `updateBoard` currently returns silently when the board is not in the list; under an awaited commit this must instead perform the write (the id and payload are known) or report failure.

#### Automatic retry

- A failed commit write is retried automatically (2 retries with a short backoff) before the failure is surfaced to the user.
- Only the awaited commit path gains retries; the optimistic writes are unchanged.

#### Non-destructive failure handling

- A failed commit must not trigger the store's refetch-and-overwrite reconciliation (`fail()` in both stores), since that erases the optimistic state holding the user's work. The error state belongs to the editor, not the global store banner.
- The existing `fail()` behaviour remains for the optimistic writes listed under Non-goals.

#### Board draft backup

- The board editor's working draft is persisted to localStorage, keyed by board id, as the draft changes, and removed on successful commit, cancel, and delete.
- When the editor opens for a board (including a direct edit URL after a reload) and a backup exists that is newer than the board's `updatedAt`, the user is asked whether to restore the unsaved changes via the existing confirm dialog. Accepting seeds the editor from the backup; declining discards the backup and opens the saved board.
- A brand-new, never-committed board whose edit URL is reloaded must also recover from its backup, even though the board is in no list yet.
- The backup applies to the board editor only; the topic editor gets awaited commits but no backup.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests. Cover at least:

- A failed board commit keeps the editor open with the draft intact and retries on the next Done press.
- A transient failure that succeeds on automatic retry saves without surfacing an error.
- The backup prompt restores or discards a newer-than-saved draft, and a successful commit clears the backup.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- With the network failing, pressing Done in either editor never loses the draft and never navigates away.
- After a reload mid-edit, reopening the board's edit URL offers to restore the unsaved draft.

## Follow-ups

_None._

## Implementation Notes

### What changed

- **Awaited commits.** `addBoard` and `updateBoard` (`src/boards/useBoards.ts`) and `updateTopic` (`src/topics/useTopics.ts`) are now async. Each performs the write first and applies the state update only on success, then resolves to `null` or the error message. The caller owns the failure UI, so a failed commit never touches `fail()` (no refetch-and-overwrite) and never shows in the global store banner.
    - `updateBoard` now takes the full `Board` instead of an id plus transform. The payload is always known, so the old silent return when the board is missing from the list is gone: the write always runs, and a board the list no longer holds is re-added on success.
    - `addBoard` with no active space or user resolves to an error message instead of returning silently.
- **Automatic retry.** `src/supabase/retry.ts` adds `writeWithRetries`: two retries with a 500 ms then 1500 ms backoff, rebuilding the query each attempt. It also catches thrown fetch errors (the Safari "Load failed" case), not just returned ones. Only the three commit functions use it; every optimistic write is untouched.
- **Editor saving state.** `BoardEditor` and `TopicEditor` take `onDone: (...) => Promise<string | null>`. Done shows "Saving…" and is disabled while in flight; a failure renders a `role="alert"` line under the header ("Couldn’t save: … press Done to retry") with the draft fully intact. `App.commit` and the topic `onDone` only drop the draft and navigate after a verified save.
- **Draft backup.** `src/editor/draftBackup.ts` persists the board draft to localStorage under `volleycoach-draft-<boardId>`, stamping `updatedAt` at write time. `BoardEditor` writes it on every draft change (skipping the untouched initial draft, so merely opening the editor never creates a backup). The backup is cleared on successful commit, cancel, and delete.
- **Restore prompt.** An effect in `App` checks once per edit entry, after boards have loaded: a backup newer than the saved board, or one for a board no list holds (a never-committed draft after a reload), triggers the existing confirm dialog. Restore seeds the editor from the backup; a `draftRevision` counter in the editor key forces a remount so the draft history re-seeds. Discard removes the backup. A stale backup (no newer than the saved row) is dropped quietly.

### Decisions worth knowing

- Commits are no longer optimistic: the list updates after the write succeeds. The editor stays on screen with a saving state during the await, so nothing reads the list mid-commit, and a failure leaves the store exactly as the server has it.
- Leaving the editor with the browser back button drops the draft (existing behaviour) but keeps the backup, since the spec clears it only on commit, cancel, and delete. The next edit of that board offers to restore, which turns the back button's silent discard into a recoverable one.
- The supabase test fake gained `failWrites(count, message)` so tests can exercise the retry and failure paths.

### Critical Issues

None known. All 318 tests and all diagnostics (Prettier, ESLint, tsc) pass.
