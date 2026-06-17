# Team-members row layout fix

## Implementation Agent Instructions

- **Role**: Frontend engineer fluent in this app's React + Tailwind + Base UI conventions.
- **Task**: Fix the Team roster row so the member identity leads and the role control is sized to its content.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - The role control renders through the existing `src/ui/Select` wrapper; do not style a control ad hoc.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md (the two UI-control rules: size a control to its content; a list row leads with what identifies the item)
    - @src/team/MembersList.tsx
    - @src/ui/Select.tsx
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. Re-read the section before declaring done and restate every item verbatim in your final message as `- [ ] <item>`.

## Plan

### Open Issues

_None._

### Goal

The Team roster row currently renders the role `Select` at full width, which collapses the member name to near-zero width. The name is present in the markup but not visible, and the rarely-changed role control dominates the row. Make the row read identity-first with a compact role control.

### Requirements

- The member identity leads the row and is clearly visible: the display name, falling back to the email until a name is set (`memberLabel`), with the email as the existing quiet second line when both exist.
- The editable role control is sized to its content, not stretched across the row. It fits the role labels ("Coach" / "Player") plus its chevron.
- The read-only case is unchanged: a non-manager view, and a manager's own row, still show the `RoleChip`.
- The remove (X) action stays at the end of the row.
- Affects only `src/team/MembersList.tsx`. No `Select` API change unless the same bound is needed by a caller outside this file.

### Non-goals

- No redesign of the row beyond fixing the control width and restoring identity-first order.
- No change to roster data, roles, or the remove flow.

### Testing

Add or update unit tests in `tests/team/` for `MembersList` (use the `react-testing` skill): the row shows the member identity (display name, or email when no name), the editable role control is present for a manageable row, and the read-only chip shows for a non-manageable row. Do not test exact pixel widths.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill).
- In the running app, a manager sees each member's name leading the row, a compact role control on the right, and the X at the end; the name is no longer collapsed.

## Follow-ups

- Audit other list/table rows for short-value controls stretched to full width, and bound those that dominate a row the same way.
    - `src/sharing/AccessManager.tsx` (per-grant capability select).
    - `src/sharing/NoteAccessManager.tsx` (per-grant capability select).
    - Sweep `src/` for `<Select` and `<Input` inside list/table rows; bound the width where the value is a short enum in a panel row, leave full width where it is a form field or an intended full-width column.

## Implementation Notes

### What changed

- `src/team/MembersList.tsx`: the editable role `Select` now renders with `variant="quiet"` instead of the default `box`. The box trigger is `w-full`, which stretched the control across the row and collapsed the identity span; the quiet variant is `inline-flex` and content-sized, so it fits "Coach" / "Player" plus its chevron and leaves the identity span (already `flex-1`) the rest of the width.
- No row reordering was needed: identity already led the row (disc, then the name-over-email span). Restoring the control to content width is what makes the name visible again.
- `tests/team/MembersList.test.tsx` (new): renders the real component with props (it is presentational, so no Supabase mock). Covers identity-first display (name, and email when unnamed) with the read-only chip and no combobox for a non-manageable row, and the editable role control present for a manageable row while the manager's own row keeps the chip. No pixel-width assertions.

### Why `quiet` rather than a layout wrapper

- The two hard constraints were "render through the existing `Select` wrapper, no ad-hoc control styling" and "no `Select` API change unless a caller outside this file needs the bound." The box variant's `w-full` cannot be content-sized without either an API change or wrapping-plus-overriding the control's own width.
- The `Select` wrapper already documents `quiet` as "an inline, borderless trigger for in-flow metadata controls", and the style guide says to render a rarely-changed field as "quiet text or a compact control". A roster row's role is exactly that, so the quiet variant is the wrapper's intended tool here, requiring no API change and no ad-hoc class.

### Verification

- `npm run test` — 504 passed (45 files), including the 3 new `MembersList` tests.
- Diagnostics clean: Prettier (no changes), ESLint (0 issues), `tsc --noEmit` (0 errors).

### Critical Issues

- None.
