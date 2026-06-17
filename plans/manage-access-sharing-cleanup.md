# Tidy the Manage-access sharing sections

## Implementation Agent Instructions

- **Role**: Frontend engineer with an eye for UI consistency, working in the React + Tailwind client.
- **Task**: Clean up the "Share outside your teams" and "View-only link" sections of the Manage-access dialog: cut filler copy, normalize the oversized/jargon link button, shorten its caption, make the two link affordances visually consistent, and reduce the section's vertical footprint.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Style only through the `src/ui/` wrappers and `src/ui/styles.ts`. Never add ad-hoc control classes (style guide, "UI Controls").
    - No behaviour change to sharing itself: the grant-link, by-email, and view-only-link actions keep working exactly as before. This is presentation only.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - `src/sharing/OutsideTeamShare.tsx` (issues 1–3, 5; shared by both managers)
    - `src/sharing/AccessManager.tsx` (the board's view-only-link footer; issue 4)
    - `src/sharing/NoteAccessManager.tsx` (the note's footer; confirms the shared vs board-only split)
    - `src/sharing/AccessList.tsx` (the inner UI that composes the picker, `OutsideTeamShare`, and the footer `children`)
    - `src/ui/styles.ts` and `src/ui/Button.tsx` (button variants/sizes; why the link button stretches)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Problem

In the Manage-access dialog the "Share outside your teams" and "View-only link" sections are visually and editorially heavier than the access list they sit beneath, which is the dialog's primary content. Specific defects:

- A redundant subline under the "Share outside your teams" heading restates the heading and adds a vague privacy reassurance with no actionable content.
- The "Create grant link" button stretches to full width (it is the sole child of a `flex flex-col`), so it dwarfs every other button in the dialog, which are sized to their labels. Its label also uses the internal term "grant".
- The caption beneath that button is long enough to wrap to two lines and reads awkwardly.
- The board's "View-only link" footer and the "By link" grant-link control are styled differently (inline quiet button + caption vs a full-width block button), even though both produce a shareable link.
- The combined result is a tall block that pushes the access list up and dominates the dialog.

### Requirements

- **Cut the redundant subline.** Remove the "For someone who isn't on your teams. Neither way reveals their email." paragraph from `OutsideTeamShare.tsx`. The heading carries the meaning.
- **Normalize the link button.** The grant-link button is sized to its label like every other button (Add, Share, Copy link), not stretched full width. It renders through the standard `Button` wrapper with an existing variant/size; no new style strings.
- **Relabel the link button to "Create share link"**, dropping the internal term "grant". The same label serves both the board and note managers, since the button lives in the shared `OutsideTeamShare`.
- **Shorten the link caption** to one line: "Single-use: the first person to open it gets access." (Colon, not a dash, per the writing rules.)
- **Make the two link affordances a matched pair** (board dialog): the "By link" share-link control and the "View-only link" footer use the **same button treatment and layout** (an inline, label-sized ghost button beside its caption). Their labels and headings must clearly distinguish the two: one **shares** access (the grant link, single-use, carries the chosen capability), the other is **view-only** (the reusable read-only token). Consistency is visual only — their created states may differ (the share link reveals its one-time URL to copy; the view-only link copies its reusable token directly). Do not merge them into one control.
- **Keep the layout change minimal.** The fixes above (subline cut, button un-stretched, caption shortened) carry the vertical-space reduction. Leave the "Access level" select where it is; do not re-layout the rest of the block.
- **No functional change.** Creating a share link, sharing by email, and copying the view-only link behave exactly as today, including the revealed-URL and "Copied"/"Copy" states.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests. This is a presentational change; query by accessible role/label/text. If the link button is relabeled, update any test that selects it by its old label.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- The redundant subline is gone from both the board and note Manage-access dialogs.
- The link button is sized to its label (not full width) and reads "Create share link", in both managers.
- The link caption reads "Single-use: the first person to open it gets access."
- In the board dialog, the share-link and view-only-link affordances use the same button treatment, and their labels/headings clearly mark one as share and the other as view-only.
- No change to sharing behaviour: share link, by-email, and view-only-link actions work as before.

## Follow-ups

_None._

## Implementation Notes

All changes are presentational and confined to two files; sharing behaviour is untouched.

- **`src/sharing/OutsideTeamShare.tsx`** (shared by both managers, so the relabel and copy edits land in board and note dialogs at once):
    - Cut the redundant subline. The heading is now a bare `PANEL_TITLE` span instead of a heading-plus-paragraph stack, removing the `flex flex-col gap-1` wrapper.
    - Un-stretched the link button by wrapping the un-created state in a `flex items-center gap-2` row (button + caption side by side). Previously the button was the sole child of a `flex flex-col`, so flexbox stretched it full width. It already used the standard `Button variant="ghost"`; no new style strings were added.
    - Relabelled "Create grant link" → "Create share link", dropping the internal term "grant".
    - Moved the caption inline beside the button and shortened it to "Single-use: the first person to open it gets access." (colon per the writing rules). In the created (revealed-URL) state the caption gives way to the URL + Copy row, matching the view-only footer's pattern and trimming vertical space.
    - Renamed the revealed input's `aria-label` from "Grant link" to "Share link" to stay in step with the button.
- **Matched pair (board dialog):** the "By link" un-created control and the `AccessManager.tsx` "View-only link" footer now share the same treatment — an inline label-sized `ghost` button beside its caption in a `flex items-center gap-2` row. `AccessManager.tsx` was already in this shape, so no edit was needed there; the change was bringing `OutsideTeamShare` into line. Labels/headings keep them distinct: "By link" / "Create share link" (single-use, carries the chosen capability) vs "View-only link" / "Copy link" (reusable read-only token). Their created states still differ as specified.
- **Test:** `tests/sharing/AccessManager.test.tsx` updated to select the button by "Create share link" and the revealed input by "Share link". `npm run test` (sharing suite), `format`, `lint`, and `typecheck` all pass.

**Design follow-up (post-review with the user).** Two further refinements after seeing the rendered dialog:

- **Buttons never wrap.** Added `whitespace-nowrap` to `BUTTON_BASE` in `src/ui/styles.ts` (the systemic place, not a per-button class). "Create share link" had wrapped to two lines while "Copy link" stayed one, so they read as different sizes. Now every button keeps its label on one line, and the two link buttons ("Create share link" / "Copy link") are the same `ghost` Button differing only in label.
- **Access level visibly governs both methods.** The "By email" and "By link" methods now sit in one group indented under a left rule (`border-l-2 ... pl-4`) that descends from the "Access level" select above them, so the design itself shows the one capability applies to both paths. The email action button was changed from `primary` to `ghost` so the two methods read as an equal, parallel pair under that shared setting rather than one loud and one quiet (also avoids a second primary button in the dialog). No behaviour change.

### Critical Issues

None.
