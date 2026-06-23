# Pre-launch review fixes

## Implementation Agent Instructions

This plan is executed by **many agents working in parallel**, one per task. Each task below names the persona, the exact files it owns, its dependencies, and its steps. An agent picks one task and implements only that task.

- **Role**: Senior engineer fixing a specific, scoped set of defects in the VolleyVector codebase.
- **Task**: Implement exactly one task from `## Plan` → your assigned `T#`/`D#`. Do not touch files another task owns.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make the minimal change that fixes the defect. Do not refactor beyond your task's stated scope.
    - Write clean, immutable, well-typed code that matches the surrounding style.
    - Add or update tests for the behaviour you change (see each task's Tests line and `### Testing`).
    - Run the `diagnostics` skill before declaring done; all of format, lint, and typecheck must pass.
    - Use the `react-testing` skill whenever you add or change a frontend test.
- **Required reading** (every agent reads these):
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md — the system your task sits in.
    - This plan's `### Execution model` and your own task section. Task-specific reading (skills, source files, doc sections) is listed inside each task.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, append your task's outcome to `## Implementation Notes` under a `### <task id>` heading, per that section's description. No "done" claim is valid until your entry is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of any task — do not implement them. If you uncover unplanned out-of-scope work, add it there (one feature per top-level bullet). Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message as `- [ ] <item>`.

## Plan

### Goals

- Fix every confirmed defect from the pre-launch review: 6 must-fix issues, the should-fix suggestions, and the low-risk hardening notes.
- Two issues are launch-blocking and must land before any users are invited: the access-list UPDATE privilege gap (T1) and the team-purge note data-loss (T1).
- Leave the codebase with all diagnostics green and the RLS regression test extended to cover the security fixes.

### Non-goals

- No new features. Password recovery and the cross-space note-subtree alignment are deferred (see `## Follow-ups`).
- Do not edit migration files that have already been applied. Schema and policy changes ship as **new** migrations.

### Execution model

- **File ownership is exclusive.** Each task lists the files it owns. No two tasks scheduled together edit the same file. Stay inside your owned files; if a fix seems to require touching another task's file, stop and flag it instead of reaching in.
- **Wave 1 (parallel):** T1–T8. These are file-disjoint and may all run at once.
- **Wave 2 (parallel, after Wave 1 is merged):** D1–D6. These are pure deduplication/token refactors over code Wave 1 has already corrected, so they must run after Wave 1 to avoid colliding on shared files. D1–D6 are file-disjoint from each other.
- **Cross-task contracts** (where two tasks must agree without sharing a file) are stated explicitly in the tasks involved. There are two: the draft-backup record shape (T3 ↔ T4a) and the overflow-menu action order (T3 ↔ T7).
- **SQL tasks:** the `supabase` skill is mandatory for any work under `supabase/`. New migrations get a fresh timestamped filename later than the latest existing one (`20260620121000_invite_quota.sql`). The local CLI never writes production; verify with `npm run test:rls` (needs Docker).

---

### Wave 1

#### T1 — Database security, lifecycle, and RLS test

- **Persona**: Backend/Postgres engineer. Load the `supabase` skill first.
- **Owns**: new files under `supabase/migrations/`, and `supabase/tests/rls_policies_test.sql`. Does **not** edit any already-applied migration.
- **Depends on**: none.
- **Task-specific reading**: `supabase/migrations/20260614215854_access_model.sql`, `20260616172655_outside_team_sharing.sql`, `20260614215856_content_versioning.sql`, `20260609000001_deletion.sql`, `20260606000001_init.sql`, and the existing `supabase/tests/rls_policies_test.sql`.
- **Steps** (may be one migration or a few; author them as one agent so timestamps and the test file stay coherent):
    1. **Access-list UPDATE bypass (launch-blocking).** `board_access_update` and `topic_access_update` (`access_model.sql:186`, `:203`) gate only on `capability_rank(...) >= 3` and omit the team-coach guard that the INSERT policies carry (`:184`, `:201`). Add the same guard to the UPDATE policies' `with check`: `and (team_id is null or public.is_team_coach(team_id) or public.is_admin())`. After the fix, an owner cannot repoint a grant onto a team they do not coach.
    2. **Team-purge note data-loss (launch-blocking).** `topics.team_id` is declared `references public.teams(id) on delete cascade` (`init.sql:43`), so `purge_expired()` deleting a team hard-deletes the note rows that team anchored — including notes shared out to other principals — with no grace window. Boards avoid this because they dropped `team_id`. Change the `topics.team_id` foreign key to `on delete set null` (drop and recreate the constraint, default name `topics_team_id_fkey`). Then a team purge nulls the anchor; the cascading `topic_access` team-grant deletions fire `archive_orphaned_topic`, which grace-archives only notes with no remaining grant and leaves shared notes alive — matching board behaviour. Verify the `topics_home_slug_key` index on `coalesce(team_id, created_by)` still holds after a team-wide set-null (guard against a slug collision; if a real risk surfaces, raise it rather than widening scope).
    3. **Outside-team grant silently no-ops and burns the link.** `redeem_access_link` (`outside_team_sharing.sql:121`), `grant_board_by_email` (`:164`), and `grant_topic_by_email` (`:196`) insert with `on conflict do nothing`, so a recipient who already holds a lower direct grant is never upgraded yet the call reports success (and the single-use link is consumed for nothing). Change all three to `on conflict ... do update` that raises capability only when the new one outranks the existing (`capability_rank`), so redemption always either grants or upgrades.
    4. **`commit_topic` writes the slug verbatim (note).** `commit_topic` (`content_versioning.sql:131`) stores `content->>'slug'` unvalidated. Add a server-side guard: reject empty/whitespace slugs and slugify/normalise as the client does, so a direct RPC call cannot persist an empty or malformed slug.
    5. **`created_by` can be nulled by any editor (note).** `enforce_board_guards` (`access_model.sql:245`) only raises when `new.created_by is not null`, so an editor may set it to null though the guard comment implies admin-only. Tighten the guard so a non-admin cannot change `created_by` at all (including to null). Mirror for the topic guard if one exists.
    6. **Extend the RLS regression test.** Add assertions for the gaps the current test misses:
        - Negative: a non-coach (player, and a coach of a different team) cannot `UPDATE` a `board_access`/`topic_access` row to repoint it onto a team they do not coach (covers step 1).
        - A note shared out of team T survives T's purge (covers step 2): grant it to another principal, purge T, assert the note row and the other grant remain and the note is not hard-deleted.
        - Redeeming a grant link or email grant for a recipient who already holds a lower grant raises the capability (covers step 3).
        - `grant_board_by_email`/`grant_topic_by_email` return nothing for both a matching and a non-matching email (no account-existence oracle), and run the owner check independent of the lookup.
        - `redeem_access_link` is single-use and binds to the redeemer; `admin_list_profiles` is rejected for a non-admin and is the only path returning `email`.
        - Negative: a non-coach is rejected inserting an `invites` row for a `team_id` they do not coach.
- **Note on stale comments**: the `shares_team` comment in the already-applied `20260606000002_rls.sql` overstates email exposure (a later migration revokes the column). Do **not** edit the applied file. If clarification helps, add a one-line comment in your new migration; otherwise leave it.
- **Tests**: `npm run test:rls` passes (needs Docker). The new assertions fail against the unfixed policies and pass after.
- **Done when**: all six steps land as new migrations, `npm run test:rls` is green, and diagnostics pass.

#### T2 — Edge function robustness

- **Persona**: Backend engineer (Deno/Supabase Edge Functions). Load the `supabase` skill.
- **Owns**: `supabase/functions/redeem-invite/index.ts`, `supabase/functions/delete-account/index.ts`.
- **Depends on**: none. Use compensating cleanup inside the function (not a new RPC), so this task stays independent of T1.
- **Task-specific reading**: both function files end to end, and `supabase/functions/send-invite/index.ts` for how the invite/quota helpers are called.
- **Steps**:
    1. **`redeem-invite` is non-transactional.** The sequence claim-link → createUser → upsert membership → `add_invite_quota` → record `used_by` has no rollback: a failure after the membership write calls `release()` (`index.ts:179`,`:193`) to reopen the link but leaves the membership (and, on the new-account path, an orphaned email-confirmed auth user) written, so a single-use link can be redeemed twice and accounts orphan. Make redemption all-or-nothing: on any failure after side effects begin, compensate — delete the just-created membership, and `deleteUser` the just-created auth user when `createdAccount` is true — before `release()`/returning the error. The link must end usable only if no durable side effect persisted.
    2. **`delete-account` flags the profile before the ban (note).** It stamps `profiles.deleted_at/deleted_by` (`delete-account/index.ts:102`) then bans the auth user (`:110`); a ban failure leaves a hidden-but-loginable account. Reorder so the ban succeeds first, then flag the profile — or compensate by unflagging if the ban fails — so the two never diverge into a still-loginable hidden account.
- **Tests**: add/extend function-level coverage if a harness exists; otherwise document the manual verification in Implementation Notes. Keep `--no-verify-jwt` behaviour unchanged.
- **Done when**: a forced post-membership failure leaves no membership and no orphaned auth user, and a forced ban failure leaves no hidden-but-loginable profile.

#### T3 — App shell, navigation, and crash hardening

- **Persona**: Frontend engineer (React, app shell & routing).
- **Owns**: `src/App.tsx`, `src/main.tsx`, `src/routing/route.ts`, `src/notes/AppearsIn.tsx`, and one new file `src/shell/ErrorBoundary.tsx`.
- **Depends on**: none.
- **Task-specific reading**: `src/routing/useRoute.ts`, `src/editor/draftBackup.ts` (read-only — do not edit; T4a owns it), `src/notes/useNotes.ts` (read-only) for `capabilityOf`.
- **Cross-task contract**: the draft-backup record keeps its current shape (`{ updatedAt, board }`); your draft-restore change in `App.tsx` must rely only on that shape, not on T4a internals. The note overflow menu order must match the shared action order in T7.
- **Steps**:
    1. **Malformed-URL white screen (issue).** `parsePath` (`route.ts:43`) maps `decodeURIComponent` with no guard, so a bad `%` escape throws in `useRoute`'s initializer and popstate, and with no error boundary the app blanks. Wrap the per-segment decode so a malformed segment yields `notFound` (honour the function's "pure and total" contract). Separately, add a top-level React **error boundary** (`src/shell/ErrorBoundary.tsx`) and render it around `<App />` in `main.tsx`, with a minimal recover/reload fallback built from `src/ui/` components. The error boundary is the one sanctioned class component (React offers no hook equivalent); note this in Implementation Notes.
    2. **Note edit mode not reconciled (issue).** `editingNoteId` (`App.tsx:139`) lives only in component state and is never reset on navigation, so leaving a note mid-edit discards the typing yet reopens the editor later and Back cannot exit it. Reconcile it the way the board draft is reconciled against the route (`App.tsx:199`): clear `editingNoteId` when navigating away from that note, so a stale edit session cannot silently resume.
    3. **Appears-in lists viewer-only notes (suggestion).** The "Add to note" action (`App.tsx:723`, list in `AppearsIn.tsx:27`) is gated only on space-level edit rights, so a note shared at viewer appears and then errors on `commit_topic`. Filter the addable list by per-note edit capability (editor/owner), matching how `NoteView`'s Edit is gated (`App.tsx:812`).
    4. **Board-delete copy is wrong (suggestion).** The confirm says "This cannot be undone." (`App.tsx:381`) but a deleted board is admin-recoverable for 3 months. Reword to match the app's account/team wording ("recoverable for 3 months").
    5. **Draft-restore cross-clock comparison (suggestion).** The restore decision compares a client-stamped `backup.updatedAt` against a server-stamped `saved.updatedAt` (`App.tsx:313`), so a lagging device clock silently discards genuine unsaved work. Make the freshness decision robust to clock skew within `App.tsx` only (e.g. decide by whether the backup content differs from the saved content rather than by cross-clock timestamps). Do not change the backup record shape.
    6. **Cross-space note NotFound flash (suggestion).** The note-view branch renders `NotFound` (`App.tsx:766`) without the `spaceReady` guard its board/print siblings use, so a valid cross-space note link paints one NotFound frame. Add the same `spaceReady` gate.
    7. **Note overflow menu order (design).** Reorder the note overflow menu (composed in `App.tsx`) to the shared action order defined in T7, so board and note menus present the same actions in the same order.
- **Tests**: cover the route-decode guard (a malformed path yields NotFound, not a throw) and the note-edit-mode reset on navigation.
- **Done when**: a malformed URL shows NotFound (not a blank screen), navigating away from a note exits edit mode, viewer-only notes are absent from Add-to-note, and the cross-space note link no longer flashes NotFound.

#### T4a — Editor UX hardening

- **Persona**: Frontend engineer (board editor).
- **Owns**: `src/editor/BoardEditor.tsx`, `src/editor/StepStrip.tsx`, `src/editor/draftBackup.ts`, `src/editor/DescriptionEditor.tsx`.
- **Depends on**: none.
- **Cross-task contract**: keep the draft-backup record shape (`{ updatedAt, board }`) stable — T3 reads it.
- **Steps**:
    1. **Per-frame draft serialization (suggestion).** The backup effect (`BoardEditor.tsx:164`, deps `[draft, board]`) re-runs every drag frame because `replace` returns a fresh board per move, so `saveDraftBackup` does a synchronous full `JSON.stringify` + `localStorage.setItem` per frame (`draftBackup.ts:12`). Drive the backup off committed gestures or debounce it, so a drag does not serialize the whole board every frame. Preserve the record shape.
    2. **Step drag-reorder undo granularity (suggestion).** `StepStrip`'s live drag fires `onMove` once per slot crossed and `BoardEditor` wires it straight to `set(moveStep(...))` (`BoardEditor.tsx:559`), recording one undo entry per slot — unlike every other continuous gesture, which streams through `replace` and collapses to one entry at commit. Give step reorder the same replace-at-start / commit-at-end treatment so it is a single undo step.
    3. **Dead `compact` variant (suggestion).** `DescriptionEditor` exposes a `compact` prop that nothing passes; the step-instruction editor (`BoardEditor.tsx:593`) is the documented compact case. Either pass `compact` for the step-instruction editor (realising the documented smaller variant) or remove the dead prop. Prefer using it, to match `architecture.md`.
- **Tests**: cover the step-reorder undo collapsing to a single entry.
- **Done when**: dragging during edit no longer serializes per frame, a step drag-reorder is one undo step, and `compact` is either used or gone.

#### T4b — Model and court-engine hardening

- **Persona**: Frontend engineer (pure model/geometry; these files are unit-tested).
- **Owns**: `src/boards/rotation.ts`, `src/boards/operations.ts`, `src/court/geometry.ts`, `src/notes/operations.ts`, `src/supabase/rows.ts`.
- **Depends on**: none.
- **Task-specific reading**: existing tests under `tests/boards/`, `tests/court/`, `tests/notes/` for the patterns to extend.
- **Steps**:
    1. **`clampToLegal` inverts (suggestion).** For slots 3 and 6 the legal x-region can invert (`loX > hiX`) when the outer pair overlaps, and `clampToLegal` (`rotation.ts:244`) then collapses any cursor to the neighbour's x, teleporting the marker. Detect the inverted/empty region and hold the marker at its current position (or the region's true legal point) instead of snapping to a degenerate boundary.
    2. **`stepMarkers` crashes on a missing position (note).** `stepMarkers` (`operations.ts:91`) reads `step.positions[m.id]` with no presence check, so a marker missing a position yields `undefined` and crashes the render in `Marker`/`toSvgPoint`. Bench a missing position the way the bundle parser does (`parse.ts:422`), so the DB read path tolerates the same input class.
    3. **`nextLabel` can duplicate (note).** `nextLabel` (`operations.ts:27`) numbers by role count, so removing a lower-numbered marker then adding one re-mints an existing label. Number by the lowest free index for that role instead.
    4. **`snapToGrid` yanks a benched marker at grid=3 (note).** `snapAxis` (`geometry.ts:56`) violates its own docstring at grid=3, where the threshold pulls a benched marker (y≈1.07) onto the end line. Tighten so a benched marker is never snapped onto the court boundary, at any grid size.
    5. **Cyclic note chain recurses unbounded (note).** `subtreeIds`/`flattenNotes` (`notes/operations.ts:18`,`:26`) recurse over `parentId` with no visited set, so a corrupted cyclic parent chain stack-overflows on load. Add a visited guard so a cycle terminates gracefully instead of hanging the render.
    6. **`boardFromRevision` auto_arrows default (note).** `boardFromRevision` (`rows.ts:194`) defaults `auto_arrows` to `false` while every other read path defaults to `true`. Change to `?? true` to match the model default, so a history preview matches the live render.
- **Tests**: extend the relevant unit tests for each: inverted-region clamp, benched missing position, duplicate-free labelling, grid=3 bench snap, cyclic-chain termination.
- **Done when**: each pure function behaves per its docstring/model default, with tests proving it.

#### T5 — Sharing UX and access-manager fixes

- **Persona**: Frontend engineer (sharing surfaces).
- **Owns**: `src/sharing/AccessList.tsx`, `src/sharing/AccessManager.tsx`, `src/sharing/NoteAccessManager.tsx`, `src/sharing/OutsideTeamShare.tsx`, `src/sharing/GrantAccept.tsx`.
- **Depends on**: none. (The grant-capability upgrade lands server-side in T1; this task makes the client reflect the real outcome.)
- **Task-specific reading**: `src/sharing/grants.ts`, `src/ui/useConfirm.tsx`, and how other surfaces render a loading placeholder (`src/sharing/ShareView.tsx:83`, `src/team/MembersList.tsx:54`).
- **Steps**:
    1. **One-click leave/remove (issue).** The grant-row trash `IconButton` (`AccessList.tsx:124`) calls `onRemove` directly, including the owner's own "Leave" row, and removing the last grant grace-archives the content with admin-only recovery. Route removal through `useConfirm` like every other destructive action, with copy that distinguishes "Remove access" from "Leave" and warns when it is the user's own last grant.
    2. **Grant redemption shows a stale capability (issue, client half).** After T1 makes redemption upgrade-or-grant, ensure `GrantAccept` and `OutsideTeamShare` reflect the actual resulting capability and surface a clear outcome (granted vs already-had-equal-or-higher), rather than always asserting access was added. Read the real grant state after the RPC instead of assuming success means a new lower→higher change.
    3. **Access manager has no loading state (suggestion).** `AccessManager`/`NoteAccessManager` start with `grants=[]` and `AccessList` renders the empty array as "nobody has access" (not even the owner) until the fetch resolves (`AccessManager.tsx:44`, `AccessList.tsx:101`). Add a loading state and render the shared "Loading…" placeholder while fetching.
    4. **Manager dialog scaffold duplicated (suggestion).** `AccessManager` and `NoteAccessManager` share near-identical state, open-effect (down to a verbatim comment), `apply`/`run`, and Dialog+AccessList wiring (`AccessManager.tsx:44`–, `NoteAccessManager.tsx:48`–). Factor the shared scaffold into one component or hook parameterised by the access-table adapter (the per-board vs per-subtree write and the grant-link/email fns), so both managers route through it. `fetchAccess` already parameterises the table — extend that pattern.
    5. **Share caption hyphen (note).** The caption "Permanent link - anyone can view" (`AccessManager.tsx:130`) uses a spaced ASCII hyphen; change to a colon to match house prose style.
- **Tests**: cover the confirm-gated removal (removal does not fire until confirmed) and the loading placeholder.
- **Done when**: leaving/removing requires confirmation, the manager shows a loading state, redemption reflects the true capability, and the two managers share their scaffold.

#### T6 — Team, admin, account, and invite UX

- **Persona**: Frontend engineer (team/admin/account flows).
- **Owns**: `src/team/useMembers.ts`, `src/team/MembersList.tsx`, `src/team/TeamPage.tsx`, `src/team/InviteDialog.tsx`, `src/admin/AdminPage.tsx`, `src/workspace/useWorkspace.ts`, `src/invites/InviteAccept.tsx`.
- **Depends on**: none.
- **Task-specific reading**: `src/boards/useBoards.ts` for the error-state pattern; `src/auth/SetPassword.tsx` for the password-validation pattern to mirror.
- **Steps**:
    1. **Member load failures shown as empty (suggestion).** `useMembers` (`useMembers.ts:71`) ignores `.error` on both queries and falls through to an empty roster, indistinguishable from a genuinely empty team. Add an error state to the hook (mirror `useBoards`) and surface it in `MembersList`/`TeamPage` instead of "No members yet."
    2. **Admin team-create gives no feedback (suggestion).** `AdminPage.create` (`AdminPage.tsx:157`) only branches on success; a failed `create_team` leaves the error stranded in `workspace.error`, which this surface never renders. Surface the create failure in the admin panel.
    3. **Email invite leaves a stale quota count (suggestion).** `InviteDialog.send` (`InviteDialog.tsx:138`) consumes a quota slot but, unlike `make()`, never re-reads availability, so "N invites left" and the enabled Send button go stale. Refresh availability after a successful email send.
    4. **`createStatus` never clears (note).** `AdminPage.create` sets "Created X" (`AdminPage.tsx:158`) and nothing ever clears it. Clear it on input change or after a short timeout so it does not linger.
    5. **Create-team silently switches space (note).** `workspace.createTeam` (`useWorkspace.ts:186`) appends the new team as a coach membership and switches the active space, while the admin stays on `/admin`; this contradicts the documented "creating a team adds no membership" and silently repoints the library. Align behaviour with the documented intent (the new team lands in the admin's "Other teams" without becoming the active space and without a coach membership), or, if the membership is intentional, update the doc in T8 — coordinate via Implementation Notes which way you chose.
    6. **InviteAccept password validation (suggestion).** `InviteAccept.signUp` (`InviteAccept.tsx:70`) sends the password with no length or confirm-match check, unlike the parallel `SetPassword` screen. Add the same inline validation (min length and a confirm field) so a typo cannot create an unusable account.
- **Tests**: cover the member-load error surfacing and the InviteAccept password validation (too-short and mismatch are blocked client-side).
- **Done when**: load failures are visible, admin create failures are surfaced, the invite quota count stays accurate, and InviteAccept validates the password like SetPassword.
- **Note**: if step 5's resolution requires a doc change, it belongs to T8 — record the decision so T8 can reflect it.

#### T7 — UI tokens and design consistency

- **Persona**: Frontend/design-systems engineer. Load the `frontend-design` skill.
- **Owns**: `src/ui/styles.ts`, `src/ui/Dialog.tsx`, `src/ui/AlertDialog.tsx`, `src/ui/Tooltip.tsx`, `src/ui/SidePanel.tsx`, `src/ui/Popover.tsx`, `src/shell/AvatarMenu.tsx`, `src/notes/NoteView.tsx`, `src/editor/BoardActionsMenu.tsx`.
- **Depends on**: none.
- **Cross-task contract**: define the canonical overflow-menu action order here and state it in Implementation Notes so T3 can match the note menu. Suggested order: **Manage access… → History… → Print… → Copy JSON → Download JSON → [board only: Replace from JSON…] → Delete** (board-specific Copy/Move sits after History). Pick the final order and record it.
- **Steps**:
    1. **Overlay chrome re-inlined (suggestion).** `Dialog.tsx:19`, `AlertDialog.tsx:23`, and `Tooltip.tsx:20` hand-write the same border/fill/shadow chrome that `OVERLAY_SURFACE` (`styles.ts:124`) already defines and `Popover`/`Combobox` compose. Compose `OVERLAY_SURFACE` in all overlays so the surface token has one definition.
    2. **Backdrop scrim duplicated + drifted (suggestion).** The modal backdrop string is copy-pasted in `Dialog.tsx:15`, `AlertDialog.tsx:19`, and `SidePanel.tsx:16` (the last drifted to `duration-200`). Add a shared backdrop token to `styles.ts` and use it; keep SidePanel's longer duration only if it is intentionally matched to its slide — otherwise unify.
    3. **Disabled opacity drift (style).** `ICON_BASE` uses `disabled:opacity-35` while `BUTTON_BASE`/`TOGGLE_PILL` use `opacity-40` (`styles.ts:60`,`:16`,`:85`). Unify on one value.
    4. **AvatarMenu hand-rolled dividers (design).** `AvatarMenu` defines its own full-bleed `DIVIDER` (`AvatarMenu.tsx:38`) instead of the inset shared `MenuSeparator` (`ui/Menu.tsx:62`). Use `MenuSeparator`.
    5. **Note Edit weight (design).** Note view renders Edit as `ghost` (`NoteView.tsx:88`) while the parallel board view renders it `primary`. Make the note's primary edit affordance `primary` to match.
    6. **`SUBTOPIC` constant name (note).** Rename the leftover `SUBTOPIC` constant in `NoteView.tsx:34` to the current note/subnote vocabulary.
    7. **Board overflow menu order (design).** Reorder `BoardActionsMenu` to the canonical order from the cross-task contract; T3 matches it for notes.
- **Tests**: none required beyond existing snapshots/behaviour; rely on diagnostics. Do not introduce arbitrary style values — every dimension/colour/shadow comes from `styles.ts`/`index.css` tokens.
- **Done when**: overlays compose the shared surface/backdrop tokens, disabled opacity is uniform, AvatarMenu uses `MenuSeparator`, note Edit is `primary`, `SUBTOPIC` is renamed, and both overflow menus share one order.

#### T8 — Documentation accuracy

- **Persona**: Technical writer/engineer. Follow the Markdown rules in AGENTS.md (one sentence per line; no hard-wrapping).
- **Owns**: `docs/architecture.md`, `AGENTS.md`.
- **Depends on**: none. (If T6 step 5 changes create-team behaviour, reflect that here too — check Implementation Notes before finalising.)
- **Steps**:
    1. **Arrows "derived, never authored" is false (suggestion).** `architecture.md:157`/`:164` say arrows are only derived, but the app ships manual arrow annotations (`court/types.ts:46`) and a board-level `autoArrows` toggle (`boards/types.ts:60`, wired through `CourtSettings`/`BoardEditor`/`BoardView`). Correct the motion/arrows section to describe both derived arrows and the manual arrow annotation plus the auto-arrows toggle.
    2. **Board type omits `autoArrows` (suggestion).** The `Board` type illustration (`architecture.md:46`) lists `rotationStrict` but omits `autoArrows`, which the real type, the bundle format, and the board-creator skill all carry. Add it.
    3. **Module map omits `src/routing/` and `src/shell/` (note).** `AGENTS.md:17`–`:27` and `architecture.md:307` attribute navigation/shell entirely to `App.tsx`, omitting the real `src/routing/` and `src/shell/` modules. Add them to the module map, proportional to the surrounding entries.
- **Tests**: none (docs). The Markdown auto-format hook runs on save.
- **Done when**: the three doc gaps are corrected without over-expanding the surrounding sections.

---

### Wave 2 — deduplication and token consolidation (after Wave 1)

These refactor code Wave 1 has corrected; they must run after Wave 1 merges. D1–D6 are file-disjoint from each other.

#### D1 — Unify the hash-route token hooks

- **Owns**: `src/sharing/useShareRoute.ts`, `src/sharing/useGrantRoute.ts`, `src/invites/useInviteRoute.ts`, `src/bundle/useDraftPreviewRoute.ts`, and one new shared hook (e.g. `src/routing/useHashRoute.ts`).
- **Steps**: the three token hooks are byte-identical except the prefix constant, and the draft-preview hook is the same shape specialised to a boolean. Extract one `useHashToken(prefix)` (and a `useHashMatch(hash)` for the preview case) and reduce all four to thin wrappers. Behaviour unchanged.
- **Tests**: existing route tests pass; add one for the shared hook if none covers it.

#### D2 — Unify the space-scoped stores

- **Owns**: `src/boards/useBoards.ts`, `src/notes/useNotes.ts`, and any new shared store helper.
- **Steps**: `capabilityOf`, `fail`, `refetch`, the mount-fetch effect, and the insert-row-then-insert-owner-grant-with-orphan-cleanup flow are near-identical across the two stores. Factor the shared scaffolding into a `useSpaceStore` primitive or shared helpers parameterised by table/join/mapper, keeping each store's public API identical. Do not change behaviour or error handling.
- **Tests**: existing `useBoards`/`useNotes` tests pass unchanged.

#### D3 — Unify the revision-loading hooks

- **Owns**: `src/history/useRevisions.ts`.
- **Steps**: `useBoardRevisions` and `useNoteRevisions` are structurally identical apart from table, id column, row mapper, and diff fn. Collapse into one generic hook (or shared helper) parameterised by those four. Behaviour unchanged.
- **Tests**: existing history tests pass.

#### D4 — Extract the Edge-Function error-unwrap helper

- **Owns**: `src/supabase/deleteAccount.ts`, `src/supabase/restoreAccount.ts`, `src/invites/invites.ts`.
- **Steps**: the error-unwrap block (read `error.context.json()`, prefer `body.error`, fall back to `error.message`) is implemented as `invokeFunction` in `invites.ts` and re-implemented inline in the two account helpers. Promote one shared `invokeFunction` (e.g. into `src/supabase/`) and route all three through it.
- **Tests**: existing tests pass; add coverage for the shared helper if absent.

#### D5 — Extract the clipboard-copy-with-label helper

- **Owns**: `src/sharing/AccessManager.tsx`, `src/sharing/OutsideTeamShare.tsx`, `src/team/InviteDialog.tsx`, and one new helper (e.g. `src/ui/useCopyLabel.ts` / `copyToClipboard`).
- **Steps**: the "copy to clipboard, flip the label to Copied for 1500ms" block is hand-rolled in all three dialogs (and `useBundleExport` already encapsulates the same idea). Extract one helper and route the three dialogs through it. Behaviour unchanged.
- **Tests**: existing dialog tests pass; add one for the helper.

#### D6 — Page-width token

- **Owns**: `src/ui/styles.ts` (the `PAGE` token), `src/App.tsx`, `src/editor/BoardView.tsx`, `src/editor/BoardEditor.tsx`, `src/notes/NoteEditor.tsx`, `src/history/BoardHistory.tsx`.
- **Steps**: the shared `max-w-[1320px]` column constraint is hardcoded at six call sites despite the `PAGE` token. Define one named width class in `styles.ts` and have all six compose it (keeping each surface's own flex/grid/gap). No visual change.
- **Tests**: none beyond diagnostics; verify no layout shift.

### Testing

- Each task adds or updates only the unit tests its change requires, following the `react-testing` skill for frontend tests and mirroring the `tests/` structure.
- T1 extends `supabase/tests/rls_policies_test.sql`; verify with `npm run test:rls` (needs Docker).
- Wave 2 tasks are behaviour-preserving: the existing suite must pass unchanged, plus a focused test for each new shared helper.

### Acceptance Criteria

- All unit tests pass (`npm run test`), and the RLS regression test passes (`npm run test:rls`).
- All diagnostics pass (use the `diagnostics` skill): format, lint, and typecheck are clean across all changed files.
- The two launch-blocking issues are fixed and proven by new RLS assertions: an owner cannot repoint a grant onto a team they do not coach, and a note shared out of a purged team survives with a grace window.
- A malformed URL shows NotFound rather than a blank screen, and a top-level error boundary is in place.
- No destructive action (including leaving/removing access) fires without confirmation.
- No applied migration file was edited; all schema/policy changes are new migrations.

## Follow-ups

- [ ] **Self-service password recovery.** Add a "Forgot password?" flow: a reset route and UI, `supabase.auth.resetPasswordForEmail` in the auth layer, and the user-only Supabase/Resend email-template configuration. Currently a user who forgets their password needs manual dashboard intervention.
- [ ] **Align cross-space note-subtree grant computation.** The note access-manager picker derives the subtree from the client's in-memory, space-scoped note tree, while the email/link grant paths walk a server-side recursive CTE over `topics.parent_id`. They diverge only when one logical subtree is shared across multiple spaces and a co-owner adds a subnote in another space. Make the picker path use the same server-side recursive subtree so all sharing routes agree.
- [ ] **Re-key the note home-slug uniqueness for team purge.** After the `topics.team_id` change to `on delete set null` (T1), two live notes by the same creator that share a slug, one anchored to a purged team and one elsewhere, would collide on the set-null and abort that team-row's purge. Re-key `topics_home_slug_key` on a stable anchor that does not change on a team purge, so a purge can never be blocked by a slug clash.

## Implementation Notes

Per-task notes recorded by the implementation agents (one `### <task id>` entry each), plus an integration entry and the critical-issues verdict. These do not restate the plan.

### T1

All six steps land in one new migration `supabase/migrations/20260623120000_access_lifecycle_hardening.sql`; the RLS test gained fixtures plus sections 14–19.

Decisions / things a future reader needs:

- **One migration, not several.** The five DDL/function changes are small and interdependent (the upgrade-or-grant rewrite and the slug guard both `create or replace` functions), so they read cleaner as one file. Timestamp is later than the last existing migration (`20260620121000`).
- **`on conflict` needed the partial-index predicate.** `board_access`/`topic_access` user uniqueness is a *partial* index (`where user_id is not null`). The old `on conflict do nothing` inferred nothing, but the new `do update` must name the arbiter index, so each clause is `on conflict (board_id, user_id) where user_id is not null do update ... where <new outranks old>`. The trailing `where` makes an equal-or-lower grant a true no-op (no downgrade), so redemption is strictly upgrade-or-grant.
- **`redeem_access_link` needed `#variable_conflict use_column`.** Its OUT columns are named `board_id`/`topic_id`, which collide with the access-table columns in the `on conflict` inference list (Postgres read them as PL/pgSQL variables and errored "ambiguous"). The pragma resolves a bare ambiguous name to the column; all `claimed.*` references stay explicitly qualified.
- **Slug guard mirrors the existing SQL slugify, not the JS one.** Step 4 adds `public.normalize_slug(text)` reusing the `translate()` accent set from `20260609000003_slugs.sql`'s `pg_temp.slugify` (the established server-side fold), returning NULL on empty so `commit_topic` raises `slug cannot be empty`. The client `slugify` falls back to `"untitled"`; server-side we reject instead, per the task. `commit_topic` writes the normalized slug to both the row and the revision snapshot (`content || jsonb_build_object('slug', clean_slug)`) so history matches the row.
- **No topic created_by guard exists.** Step 5 tightened `enforce_board_guards` (now forbids *any* non-admin change to `created_by`, including to null). There is no `boards`-style guard trigger on `topics` (confirmed: only `boards_guards` exists), so there is nothing to mirror; I did not add a new topic guard (out of scope — the plan says "if one exists").
- **Step 2 slug-collision handling.** After `topics.team_id` → `on delete set null`, the `topics_home_slug_key` index (`coalesce(team_id, created_by), slug`) was made partial `where deleted_at is null` so an archived sibling can never block the set-null during a purge. A residual risk remains: two *live* notes by one creator, one anchored to the purged team and one elsewhere, sharing a slug, would collide on set-null and abort that purge row. Creator-null cases never collide (NULLs are distinct in the index). This is narrow (requires the shared-out + purge combination AND a same-slug live sibling); per the task I did not widen scope to re-key — flagged as a follow-up.
- **Test ordering quirk.** New section 15 purges Team A (`delete_team` then age `deleted_at` 4 months, then `purge_expired()` as `service_role`), which deletes Team A and its memberships. Every later section (16–19) deliberately uses only out-of-team principals (coachA, coachA2, coachB, admin) and non-team-A content, so the purge does not disturb them. Section 19 relies on coachA coaching no surviving team after the purge.
- **Negative-test proof.** Confirmed section 14 fails without the migration (access-UPDATE bypass) and section 15 fails with the FK left as `on delete cascade` (shared-out note hard-deleted) — both reverted back to the full fix afterward.

### T2

**redeem-invite (Step 1).** Compensation is in-function (no new RPC, per the T1-independence constraint). The `release` helper was widened: before reopening the link it now deletes the just-created membership and `deleteUser`s the just-created auth user, in reverse order. Two flags gate it so it only ever rolls back side effects this redemption made:

- `createdAccount` (already existed) — set only when `createUser` succeeds, so the create-failure `release()` and the signed-in-caller path never delete an account.
- `addedMembership` (new) — set from the upsert's returned rows (`.select("user_id")`), which is empty when `ignoreDuplicates` skips a pre-existing membership. So a stale link re-adding an existing member, followed by a later (quota) failure, does **not** delete that pre-existing membership.

`userId` and `createdAccount` were hoisted above `release` (the later `let createdAccount` was removed). The additive `add_invite_quota` grant is not compensated: the only step after it is the un-checked finalize update, which never calls `release()`, so no `release()` path leaves an applied quota grant.

**delete-account (Step 2).** Chose **reorder** over compensate: ban first, then flag. A flag failure after a successful ban leaves a banned-but-unflagged account — hidden from login, just not yet in the recovery list — never the hidden-but-loginable divergence the plan names. Reorder needs no rollback path, so it's simpler than unflag-on-ban-failure.

**Verification.** No edge-function test harness exists (only client-side tests reference these functions; no Deno tests, no Deno binary, and `supabase/` is outside the project tsconfig). Verified by reasoning over the control flow + confirming every supabase-js call matches existing usage elsewhere (`deleteUser` in purge-expired, `.delete().eq()` in send-invite, `.upsert()` in this same file). `--no-verify-jwt` behaviour unchanged (no auth/JWT code touched).

### T3

- **Error boundary class component.** `src/shell/ErrorBoundary.tsx` is the one sanctioned class component (React has no hook equivalent for catching render errors). It wraps `<App/>` in `main.tsx`, outside `AuthProvider`, with a Try again / Reload fallback built from `Button` + shared tokens. Its full-screen `BG` mirrors App's gate background.
- **Draft-restore content comparison (step 5).** Added a module-scope `sameBoardContent(a, b)` in App.tsx that JSON-compares two boards after stripping the volatile/server-stamped fields named in the contract (`updatedAt`, `currentRevisionId`). The restore prompt now fires whenever the backup content differs from the saved board, instead of comparing a client clock to a server clock. `draftBackup.ts` shape is untouched; only `loadDraftBackup` returning a `Board` is relied on.
- **Note overflow menu (step 7 / cross-task contract with T7).** `<ExportMenu>` hardcodes Copy/Download JSON to the top and is still used by the Library menu, so I could not reorder it there. Composed a new module-scope `NoteActionsMenu` component *inside App.tsx* (a second component in the file, required because `useBundleExport` is a hook and cannot be called inline in JSX) using `Menu`/`MenuItem`/`MenuSeparator` + `useBundleExport`. Canonical order: Manage access (owner) → History → sep → Print → Copy JSON → Download JSON → sep → Delete note (owner). Trigger label "Note actions" and item labels unchanged, so existing App tests still match.
- **editingNoteId reset (step 2).** Reconciled during render (not an effect), right after the board-draft reconciliation, by clearing it whenever the route's `selection` is not the note being edited. Mirrors the existing draft pattern.
- **Appears-in gate (step 3).** Filtered the addable list in `AppearsIn.tsx` itself (it already holds the full `Note` objects carrying `capability`), keeping only editor/owner notes.
- **Note NotFound spaceReady (step 6).** Note branch now renders the loader while `!spaceReady || notes.loading`, only falling to `NotFound` once the space has settled — matching the board/print branches.

### T4a

- **Step 1 (backup debounce).** Debounced the existing backup `useEffect` with a 400ms `setTimeout` cleared on each draft change, so a drag (which churns `draft` every `replace` frame) serializes only the settled draft, never every intermediate frame. Kept `draftBackup.ts` untouched: the record shape (`saveDraftBackup` writes `{ ...draft, updatedAt: Date.now() }`, `loadDraftBackup` returns a `Board`) and the signatures are unchanged, as T3 reads them. Did **not** add a flush-on-unmount effect: with deps `[draft, board]` its cleanup fires every frame and defeats the debounce; with `[]` it captures a stale draft. The 400ms window only loses work on an abrupt close within that window, which a real crash/reload flush belongs to `beforeunload`, out of scope here.
- **Step 2 (single-entry step reorder).** Mirrored the marker-drag pattern: `StepStrip` now takes `onMove` (a mid-gesture reorder frame, wired in `BoardEditor` to `replace(moveStep)`) plus a new `onMoveEnd` (wired to `commit`). The drag streams `onMove` per slot crossed and fires `onMoveEnd` once at `endDrag` (only when it actually dragged), collapsing the whole drag to one undo entry. The Shift+Arrow keyboard reorder calls `onMove` then `onMoveEnd` per press, so each key press stays its own discrete undo entry (unchanged granularity for that path) while routing through the same replace/commit plumbing.
- **Step 3 (compact variant).** Realised the documented compact case: passed `compact` to the step-instruction `DescriptionEditor` (matches architecture.md). `DescriptionEditor`/`Textarea` already fully supported the prop (it was only never passed), so this was a one-prop change, no removal needed.
- **Tests.** `tests/editor/StepStrip.test.tsx` wires `StepStrip` to `useDraftHistory` in a small harness and drives a real pointer drag across three slots, asserting the order changed, undo is enabled, and a **single** undo restores the original order (and disables undo) — proving one entry, not one per slot. happy-dom returns 0 for `getBoundingClientRect().left`/`offsetWidth`, so the test mocks per-chip geometry on a 100px grid so the drag can target distinct slots.

### T4b

- **clampToLegal** now clamps per-axis: when a slot's region inverts (`lo > hi`, the slot-3/6 outer-pair overlap), that axis holds at `positions[markerId]` (the marker's current point) instead of collapsing onto the neighbour's coordinate. The other axis still clamps normally. Relies on the marker being assigned (guaranteed when `legalRegion` returns non-null).
- **stepMarkers** mirrors `parse.ts`: it accumulates `placed` markers and benches any missing position via `benchPosition(placed)`, so the bench slot a missing marker takes accounts for already-placed markers on the same step (identical semantics to the bundle parser).
- **nextLabel** numbers by lowest free index. It parses each same-role sibling's label to an index (the bare `code` counts as index 1; otherwise `Number(label.slice(code.length))`), then picks the smallest integer ≥ 1 not taken. A sibling with an unparseable custom label yields `NaN` in the taken-set (never collides with an integer) but still forces numbering via `taken.size > 0`. All four pre-existing nextLabel cases keep their exact output.
- **snapAxis** returns the value unchanged whenever `value < 0 || value > 1`, so a benched/off-court coordinate is never pulled onto the 0 or 1 boundary at any grid size. This is the simplest fix honouring the docstring; in-court snapping is untouched.
- **subtreeIds / flattenNotes** take an optional `seen: Set<string>` (defaults to a fresh set) threaded through recursion; a re-visit returns `[]`. Public call sites pass no set, so each top-level call starts fresh. Note: `flattenNotes` from `null` is structurally cycle-free (a single-parent forest reachable from root has no cycles), so its cycle test enters at a cycle node directly (the public signature allows a `parentId` arg); `subtreeIds` is called with arbitrary ids and genuinely overflowed without the guard.
- **boardFromRevision** auto_arrows default changed `?? false` → `?? true`. New test file `tests/supabase/rows.test.ts` (no prior rows/supabase test dir existed).

### T5

- **Shared scaffold = a hook, not a component.** `src/sharing/useAccessManager.ts` owns the grants/profiles/candidates/error/loading state, the open-effect (with the verbatim concurrent-error comment), `apply`, and the optimistic `run`-after-write. It is parameterised by an adapter `{ table, idColumn, id, add, changeCapability, remove, createLink, grantByEmail }`, extending the `fetchAccess` table-parameterisation. A hook (not a wrapper component) keeps each manager owning its own Dialog/AccessList JSX and its manager-specific trailing block (the board's view-only link, the note's subtree caption), so the per-manager differences stay local.
- **Confirm gating lives in `AccessList`, not the managers.** The trash button and the `currentUserId`/`entityNoun`/`grants` it needs to choose copy all live in `AccessList`, so `useConfirm` is wired there and its `{dialog}` is rendered inside the section. "Own last grant" = `grant.user_id === currentUserId && grants.length === 1`; the warning ("recoverable only by an admin for 3 months") fires whenever it is the **last** grant regardless of whose, since removing any last grant archives the content.
- **Redemption outcome (step 2), no T1 return-shape dependency.** `redeem_access_link` returns only `(board_id, topic_id)` (T1 only changes its `on conflict` to upgrade-or-grant, not the return columns), so `GrantAccept` reads the resulting access itself via the already-exposed `board_capability`/`topic_capability` security-definer RPCs (reading your own access is no oracle). Accept now shows an outcome screen ("You now have <edit> access" when the link granted/upgraded, vs "You already had <owner> access" when an existing grant outranked the link's offer) with an explicit "Open <noun>" button, instead of silently navigating. When the capability read is unavailable (e.g. the test fake has no such RPC), it falls back to the link's offered capability, which the link grants at least — so the outcome is honest in both prod and tests.
- **OutsideTeamshare email message stays oracle-safe.** The email grant must read identically whether or not an account matched, so it does **not** read the recipient's real state. It now names the capability the *owner chose* ("it can now view/edit/own this board"), which the recipient holds at least; it never reflects the recipient's true (possibly higher) grant. This is the only oracle-safe way to "reflect the resulting capability" for the email path.
- **Existing sharing tests updated (not helpers).** The three `tests/sharing/*` files were updated to the new behaviour: removal is confirm-gated (find the `alertdialog`, click "Remove"), the email message wording changed, and `GrantAccept` is now a two-step accept→open flow. Body-interacting queries that ran synchronously were switched to `findBy*` because the manager now renders a "Loading…" placeholder until the access fetch resolves. `tests/helpers/*` and `tests/setup.ts` were not touched.

### T6

- **Create-team decision (step 5): aligned code to the existing doc.** `useWorkspace.createTeam` no longer appends a coach membership to `teams` and no longer switches the active space; the new team is pushed to `otherTeams` (the admin's "Other teams" disclosure). No doc change needed (T8 makes none).
- **Server-side divergence remains and needs a migration (out of T6's ownership).** The `create_team` RPC (`20260620121000_invite_quota.sql:195`) still `insert`s the creator's coach membership server-side. So on the next workspace reload the freshly-created team surfaces as a *coach membership* in `teams`, not in `otherTeams`, re-introducing the divergence the client fix papers over for the current session only. Fully honouring "creating a team adds no membership" requires dropping that membership insert from the RPC in a new migration — that belongs to the SQL task (T1), not T6. Flagged as a follow-up.
- **AdminPage create feedback (step 2):** `onCreateTeam` only returns `string | null` to this surface (the real error is stranded in `workspace.error`, unreachable here), so a null result surfaces a generic `Could not create <name>.` in the existing `actionError` line. `create` clears `actionError` before attempting.
- **`createStatus` clear (step 4):** cleared on team-name input change (the cleaner of the two plan options — no dangling timer). Not auto-cleared on a timeout.
- **InviteDialog quota refresh (step 3):** after a successful email send, a non-admin re-reads `inviteAvailability()` (mirroring `make()`), so the quota note and Send button stay live. Admins are unlimited and skip the refresh.
- **InviteAccept validation (step 6):** length+confirm validation runs only on the account-creation (`signUp`) path, mirroring `SetPassword` (MIN_LENGTH=8, "The passwords do not match."). The sign-in path applies no such check, matching `Login.tsx`. A `Confirm password` field renders only when `creating`, and the submit is disabled until it is filled.
- **Shared-test edits:** `tests/workspace/useWorkspace.test.ts` create-team test rewritten for the new contract (lands in `otherTeams`, active space unchanged). `tests/App.test.tsx` "an admin creates a team through the admin panel…" still asserts the OLD behavior (new team directly visible in the switcher) and now FAILS; it is a shared file actively edited by a sibling (App.tsx is T3-owned), so I did not touch it — see blockers.

### T7

**Canonical overflow-menu action order (T3 matches this for notes), verbatim:**
(1) Manage access… [owner only] (2) History… (3) [board only] Copy to… / Move to… (the CopyToMenu children) — separator — (4) Print… (5) Copy JSON (6) Download JSON (7) [board only] Replace from JSON… [editable only] — separator — (8) Delete… (Delete board…/Delete note…, editable/owner only).
`BoardActionsMenu` already followed this exactly; verified and left untouched (separators sit after the Copy/Move children group and before Delete).

**Backdrop-scrim duration decision:** unified the shared `BACKDROP` token on `duration-150` (the Dialog/AlertDialog value). SidePanel's backdrop had drifted to `duration-200`; that was scrim drift, not a deliberate match to its slide. The panel's slide transition stays `duration-200` (untouched) — only the scrim fade unified.

**Disabled opacity:** unified `ICON_BASE` from `disabled:opacity-35` to `disabled:opacity-40` (the BUTTON_BASE/TOGGLE_PILL majority value).

**Overlay surface composition:** Dialog/AlertDialog/Tooltip now compose `OVERLAY_SURFACE` instead of re-inlining `rounded-lg border border-border bg-overlay shadow-overlay outline-none`. They override the token's `z-20`/`rounded-lg` with their own `z-40` (dialogs, modal layer) / `z-30`+`rounded-sm` (tooltip). Verified via the Tailwind v4 compiler that `.z-40` and `.z-30` are emitted after `.z-20`, and `.rounded-sm` after `.rounded-lg`, so the local override always wins the cascade regardless of class-string order — same pattern Popover/Combobox/Select already rely on (their Positioner z-index overrides the popup's `z-20`).

**SUBTOPIC rename:** renamed to `SUBNOTE` (current vocabulary; the button label is "+ Subnote", nav `aria-label="Subnotes"`).

**AvatarMenu:** dropped its hand-rolled full-bleed `DIVIDER` (`my-1 h-px bg-border`) for the inset shared `MenuSeparator` (`mx-1 my-1 h-px bg-border`); separators are now inset like every other menu.

No new tests (token/cosmetic refactor). Existing `tests/notes/NoteView.test.tsx` still passes (5/5).

### T8

- Confirmed exact names before editing: the board field is `autoArrows: boolean` (boards/types.ts:60, default true), and the manual arrow is the `arrow` annotation kind (court/types.ts:46, `from`/`to` with an optional `via` quadratic bend). The toggle is shown only for a Sequence and lives in the court-settings popover (CourtSettings.tsx, label "Auto arrows").
- Step 1: rewrote the "Motion and playback" intro to say movement is shown two ways (derived + hand-drawn), kept the existing "Derived movement arrows" bullets, added one bullet there for the `autoArrows` gate, and added a short new `### Hand-drawn arrows` subsection for the manual `arrow` annotation. Did not duplicate the annotation model already documented under "Annotations"; linked to it instead.
- Step 3: added `src/routing/` and `src/shell/` to both module maps. In AGENTS.md, also trimmed the `src/App.tsx` bullet from "the top-level shell" to "the top-level component … wires the stores into the shell", since the shell now has its own entry. In architecture.md I added the two modules as a lead bullet under "Navigation and the app shell" (the existing prose section), proportional to its bullets, rather than starting a new section.
- Per the resolved cross-task contract, made NO create-team doc change (T6 aligns code to the existing "Creating a team adds no membership" wording, which stays correct).

### D1

Extracted two primitives into the new `src/routing/useHashRoute.ts`:

- `useHashToken(prefix: string): string | null` — returns `decodeURIComponent(hash.slice(prefix.length))` when `window.location.hash` starts with `prefix`, else null; resubscribes via a `prefix`-keyed effect (the four call sites pass a module-constant prefix, so the dep never changes in practice). Backs `useShareRoute` (`#/share/`), `useGrantRoute` (`#/grant/`), `useInviteRoute` (`#/invite/`).
- `useHashMatch(hash: string): boolean` — exact `window.location.hash === hash`; backs `useDraftPreviewRoute` (`#/preview`).

The four existing hooks are now thin wrappers that keep their exact export name, signature, return shape, and original explanatory comment + PREFIX/HASH constant. Behaviour is byte-equivalent to the originals: lazy `useState` initializer for the initial value, single `hashchange` listener, no `popstate` (the originals never listened for popstate — the task's mention of popstate does not apply to these hooks; only `useRoute.ts`, not owned here, uses popstate). No SSR guarding existed before and none was added (all four already read `window` directly at init).

Test: `tests/routing/useHashRoute.test.ts` (renderHook, parametrized) covers prefix match/miss/empty-token/URL-decoding for `useHashToken` and exact-match/miss plus live `hashchange` reaction for both hooks.

Verification: `npx vitest run` on `tests/routing/{useHashRoute,route}.test.ts` (49 passed), `tests/sharing tests/invites tests/auth/inviteLanding.test.ts tests/bundle` (80 passed), and `tests/App.test.tsx` (74 passed, run twice). One earlier `tests/App.test.tsx` run showed a single flaky async-timing failure ("mints an invite link"); it passed cleanly on two isolated re-runs and is unrelated to a hash-route change (likely concurrency contention from sibling agents in the shared worktree).

### D2

Lifted the shared scaffolding into `src/supabase/useSpaceStore.ts`:

- `useSpaceStore<Row, Item>(config)` — a primitive owning the three pieces of state (`items`/`loading`/`error`), the `capabilityOf` derivation, a `mapRows` wrapper, `refetch`, the mount-fetch effect (the async-IIFE with the `active` guard — no synchronous setState-in-effect), and `fail` (set error + refetch). It returns `{ items, setItems, loading, error, setError, refetch, fail }`. Parameterised by `read(space, userId)` (the space read query) and `map(rows, capabilityOf)` (row→model with derived capability). Each store passes `space/isAdmin/activeRole/user` plus its own memoised `read`/`map`, then destructures `items`→`boards`/`notes` and `setItems`→`setBoards`/`setNotes`.
- `insertOwnerGrant(accessTable, grant, { rpc, args })` — the shared "insert the owner grant with retries (23505→success), and on failure fire the admin-only orphan-cleanup RPC, returning the error or null" flow. `addBoard` and `useNotes.insertNote` both route through it. The note-specific slug-collision retry on the *row* insert stays in `insertNote` (it is note-only and not lifted).

Behaviour-preservation details a future reader needs:
- `read`/`map` MUST be wrapped in `useCallback` in each store (empty deps): they sit in the primitive's effect/refetch dependency arrays, so an unstable identity would re-run the mount fetch every render. The original `mapRows` was a `useCallback`; this keeps the same stability.
- The primitive's mount effect uses `setItems(mapRows(data ?? []))` where the originals used `mapRows(data as ...)`. The `?? []` is only reached on the unreachable `error == null && data == null` case (Supabase returns `[]`, not null, on success); output is identical for every reachable input and never crashes.
- `useState` setters (`setItems`/`setError`) are stable, but ESLint cannot prove a destructured `store.setItems` is stable, so they appear in the dependent callbacks' dep arrays. Adding a stable fn to deps is behaviourally inert (callback identity unchanged when other deps are).
- `useNotes`'s `latest` ref + its sync effect stay in `useNotes` (call order: `useSpaceStore` before the `latest` effect, so the ref still trails `notes` exactly as before).

Public API is byte-for-byte unchanged: `useBoards` returns `{ boards, loading, error, addBoard, deleteBoard, updateBoard }`; `useNotes` returns `{ notes, loading, error, addNote, insertNotes, updateNote, removeNote, reparentNote, reorderNote }`. `COMMIT_CONFLICT` export and all signatures unchanged.

No focused primitive test added: the two existing store test files already exercise every primitive path (load + grace-archive exclusion, capability derivation, orphan cleanup via `insertOwnerGrant`, error-then-refetch) end-to-end through the real stores, so a separate test would duplicate coverage.

### D3

Collapsed `useBoardRevisions`/`useNoteRevisions` into one internal generic hook `useRevisions<TItem extends {id:string}, TRow, TEntry>(item, config)` in `src/history/useRevisions.ts`. The two public hooks are now one-line wrappers that pass module-level `BOARD_REVISIONS`/`NOTE_REVISIONS` config constants; their exported names, signatures, and `RevisionState<…Entry>` return shapes are unchanged.

The config (`RevisionConfig`) carries the five things that differed, not four: table, idColumn, `fromRevision` row→item mapper, `diff` fn, and a `toEntry(id, version, meta)` that places the versioned item under its own key (`board` vs `note`) — the fifth difference the plan didn't call out. `EntryMeta` ({authorName, createdAt, summary}) is built once in the shared hook and spread into the entry by `toEntry`.

The config constants are module-level (stable identity), so adding `config` to the effect deps is inert. `fromRevision` is `boardFromRevision`/`noteFromRevision` passed directly (their `(row, item)` signature already matches). The Supabase client is typed `any`, so the dynamic `config.table`/`config.idColumn` strings type-check exactly as the prior string literals did. The new generic hook is internal (not exported); both branches are already covered end-to-end by the existing tests, so no extra helper test was added.

### D4

Extracted the Edge-Function error-unwrap block into the new shared `invokeFunction(name, body)` in `src/supabase/invokeFunction.ts`, copied faithfully from the `invites.ts` reference (read `error.context.json()`, prefer `body.error`, else `error.message`; same signature `(name: string, body: Record<string, unknown>) => Promise<{ error: string | null }>`).

Routed all three callers through it:
- `src/invites/invites.ts`: deleted the local `invokeFunction`, imported the shared one. `supabase` import stays (still used by `createInvite`/`invitePreview`/`inviteAvailability` for `.from`/`.rpc`).
- `src/supabase/deleteAccount.ts` / `restoreAccount.ts`: replaced the inline unwrap with `return invokeFunction(name, body)`. Both went from `async function` to plain functions returning the promise (behaviour-identical — they never threw synchronously — and matches the existing `sendEmailInvite`/`redeemInvite` style in `invites.ts`). Public exports/signatures unchanged: `deleteAccount(userId?: string)`, `restoreAccount(userId: string)`.

Body construction stays at each caller (`userId ? { userId } : {}` for delete, `{ userId }` for restore), so the helper is purely the invoke-and-unwrap.

Added `tests/supabase/invokeFunction.test.ts` (mocks `../../src/supabase/client`, mirroring `InviteDialog.test.tsx`): covers success, the `body.error` path, and three `error.message` fallbacks (no error field, no context, unreadable JSON).

### D5

Extracted the clipboard-copy-with-label block (`navigator.clipboard.writeText` then flip a label to "Copied" for 1500ms, then back) into `src/ui/useCopyLabel.ts`, modelled on `useBundleExport`'s effect-based timeout.

- Shape: `useCopyLabel(): { copied, copy, reset }`. `copy(text)` writes `text` and flips `copied` true; an effect clears it after 1500ms (all three call sites already agreed on 1500ms). `copy` swallows clipboard rejection like the originals. Each call site derives its own base label (`copied ? "Copied" : <base>`), matching how `ExportMenu` consumes `useBundleExport`.
- `reset()` is the one addition beyond `{ copied, copy }`. `InviteDialog` imperatively reset its label to "Copy" in three places (close, switch method, mint a new link) where it also nulls `link`, so the copy button unmounts. Because the hook state lives in the parent (not the unmounted button), a stale `copied` could otherwise survive a remint within the 1500ms window and show "Copied" on a fresh link. `reset()` preserves the original "a freshly minted link always reads Copy" guarantee. `AccessManager`/`OutsideTeamShare` had no such resets and use only `{ copied, copy }`.
- Call-site behaviour, exact label text, and timing are unchanged. Existing dialog tests (which assert the "Copy share link"/"Copied" button names) pass unmodified.
- Test: `tests/ui/useCopyLabel.test.ts` (renderHook + fake timers + faked clipboard) covers the flip, the 1500ms clear, `reset()`, and a rejected write leaving `copied` false.

### D6

Extracted the repeated page-width literal into one named token. New constant `PAGE_WIDTH = "w-full max-w-[1320px]"` in `src/ui/styles.ts` (just above `PAGE`). Chose the width-only fragment (with `w-full`) rather than `mx-auto w-full max-w-[1320px]` because the App.tsx error banner has `w-full max-w-[1320px]` but no `mx-auto` — a width-only fragment composes cleanly at all six sites without injecting a stray utility. `PAGE` itself now composes the constant via `cx`.

All six sites compose `PAGE_WIDTH` through the existing `cx` helper (`parts.filter(Boolean).join(" ")`), keeping each surface's own flex/grid/gap/animation utilities:
- `src/ui/styles.ts` PAGE token, `src/App.tsx:1073`, `src/notes/NoteEditor.tsx`, `src/editor/BoardView.tsx`, `src/editor/BoardEditor.tsx`, `src/history/BoardHistory.tsx`.

Behaviour-preserving: `cx` space-joins, so five sites are byte-identical class strings. The one exception is BoardEditor, where original order was `...w-full min-w-0 max-w-[1320px]...` and now reads `...min-w-0 w-full max-w-[1320px]...` — same Tailwind class set (no conflicting utilities), rendering-equivalent since classes form an unordered set.

Added `cx, PAGE_WIDTH` imports to NoteEditor, BoardEditor, BoardHistory (no prior ui/styles import); added `PAGE_WIDTH` to BoardView's and App's existing ui/styles imports. No new test (pure token extraction; no test asserts these class strings). `grep -rn 'max-w-[1320px]'` now matches only the PAGE_WIDTH definition.

### Integration (orchestrator)

Cross-wave decisions and fixes the integrator made while merging the parallel tasks into one green tree.

- **Create-team (T6 step 5) reversal, flagged.** T6 first aligned the code to the architecture doc ("creating a team adds no membership"). On review that doc is stale: the `SpaceSwitcher`'s "New team" action is unconditional and `createTeamAndOpen` switches the creator in, i.e. open team creation (issue #30) where the creator must become the team's coach. Aligning to the stale doc would strand a non-admin creator with no access to their own new team. So the integrator took the plan's sanctioned alternative ("if the membership is intentional, update the doc"): `useWorkspace.createTeam` now keeps the creator-as-coach membership (`setTeams(... role: "coach")`) and drops only the silent active-space switch the plan flagged (no `setActiveSpace`). The admin panel stays on `/admin`; the switcher's `createTeamAndOpen` still opens the new team explicitly. Updated `architecture.md` (the create-team prose and the "Create a team" permissions row to yes/yes/yes) and the two affected tests (`tests/workspace/useWorkspace.test.ts`, `tests/team/MembersList.test.tsx`). This resolves both of T6's flagged follow-ups: the `create_team` RPC's coach-membership insert is now intended (not a bug to drop), and `createTeamAndOpen` navigating into the new team is the desired open-creation behaviour.
- **MembersList test.** T6 made `MembersListProps.error` required but left `tests/team/MembersList.test.tsx` un-updated (a type error); the integrator added `error: null` to its render base.
- **useAccessManager lint.** T5's new `src/sharing/useAccessManager.ts` called `setLoading(true)` synchronously in an effect (`react-hooks/set-state-in-effect`); the integrator wrapped the fetch in an async IIFE, mirroring `useBoards`.
- **Style pass.** Re-ran the project formatter over the few files the per-file write hook had missed (`src/App.tsx`, `src/sharing/AccessManager.tsx`).
- **Final gate (whole tree):** Prettier and ESLint clean, the production compile and bundle clean (tsc plus Vite), the full unit suite green at 632/632, and the RLS regression test reporting "ALL RLS TESTS PASSED". One App test ("mints an invite link") flaked once under heavy parallel agent load but passes deterministically in clean runs; this is pre-existing load sensitivity, not a regression.

### Critical Issues

No critical issues. Every task (T1-T8, D1-D6) landed end-to-end; the formatter, the linter, the production compile and bundle, the full unit suite (632/632), and the RLS regression test all pass. The one deviation from the plan's literal wording is the flagged create-team reversal recorded under "Integration": T6 step 5 was delivered through the "membership is intentional, update the doc" branch (open team creation) rather than "align code to the doc", because the latter breaks the open-creation UX. If the product intent is instead to restrict team creation to admins, that is a separate change (gate the `SpaceSwitcher` action and the `create_team` RPC), after which the two doc edits would revert.
