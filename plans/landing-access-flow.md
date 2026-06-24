# Landing Access Flow

## Implementation Agent Instructions

- **Role**: Frontend engineer comfortable across the React client, the auth/invite flows, and the landing surfaces.
- **Task**: Rework the logged-out landing access flow so Sign in, Sign up, Accept invite, and Decline are one consistent set of doors into a single shared auth surface, retire the leftover full-screen invite screen, and polish the Try-it sandbox chooser and export.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Reuse existing surfaces (`LoginForm`, `InviteAccept`, the request-access form, `BoardView`, `BoardEditor`, `LibraryCard`) and consolidate rather than duplicate. No leftover or parallel auth/invite screens.
    - Every new control renders through `src/ui/` wrappers and shared tokens.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/landing/LandingPage.tsx, @src/landing/SignInModal.tsx, @src/landing/InviteModal.tsx, @src/landing/RequestAccessDialog.tsx, @src/landing/Sandbox.tsx
    - @src/auth/LoginForm.tsx, @src/invites/InviteAccept.tsx, @src/invites/useInvitePreview.ts, @src/landing/useTryRoute.ts
    - @src/App.tsx (logged-out routing, the invite/share/grant gates)
    - @src/library/LibraryCard.tsx, @src/library/items.ts (the board card + `toLibraryItems`, for the sandbox chooser)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task. Re-read the section before declaring done and restate every item verbatim in your final message, each as `- [ ] <item>`. If it is `_None._`, write `Follow-ups: none.`

## Plan

### Open Issues

_None._

### Goals

- One consistent presentation of Sign in, Sign up, Accept invite, and Decline, each leading to the right screen.
- Honest invite-only framing: Sign up leads to an invite-only screen, never a promise of instant access.
- One shared auth surface behind every entry point, with no duplicate or leftover invite screens.
- A Try-it sandbox start chooser that reuses the real board card, and export presented as an available action rather than an up-front instruction.

### Non-goals

- No public sign-up: account creation stays invite-only, through redeeming an invite.
- No change to the signed-in app shell, the board/note model, or access-control rules.
- No change to share links or grant links.
- No change to the `access_requests` table, its RLS, or the `request-access` Edge Function. They are already in place; only the client dialog that calls the function changes.

### Requirements

#### One shared auth surface

- A single overlay auth surface with a **Sign in / Sign up** toggle replaces today's three parallel modals (`SignInModal`, `InviteModal`, `RequestAccessDialog`). Consolidate their content into it; reuse `LoginForm` (sign-in) and `InviteAccept`'s create-account/claim logic rather than re-implementing either.
- The **Sign in** side is the same everywhere: log into an existing account. With a valid invite present, a successful sign-in also claims the invite's grants.
- The **Sign up** side depends on context:
    - **No valid invite** → the invite-only screen: explains the app is invite-only, points to asking a coach or admin for a link, collects an email (required) and an optional message, submits through the existing request-access function, and confirms on success. It also offers a way into **Try it** ("try in the meantime").
    - **A valid invite** → create an account, claiming the invite's grants.
- The opening context picks the starting side: **Sign in** opens the sign-in side, **Sign up** and **Accept invite** open the sign-up side (a signed-in Accept is the one-click claim).
- The in-surface toggle is a clear Sign in / Sign up switch with a one-line tip, replacing the buried "Already have an account? Sign in" line.

#### Standard landing (no valid invite)

- Header: theme toggle, **Sign up**, **Sign in** — both open the shared surface on their side. Sign-in is always plainly visible in the header.
- The hero's primary call to action stays **Try it**. Per "one primary per view", Try it is the only primary; the header auth buttons are quiet.

#### Invite landing (valid invite, logged out)

- A single banner names the team and role and carries **Accept invite** (primary) and **Decline**. There is no second Accept action in the header. In invite mode Accept invite is the view's primary action and the hero Try it steps down to quiet.
- Accept opens the shared surface on the create-account/sign-in toggle, in the invite context.
- **Decline** dismisses to the standard landing and clears the token from the URL. Re-opening the link shows the invite again. Nothing is written server-side; the link stays valid.

#### Invite link while signed in

- No separate full-screen invite screen. The shared surface floats as an overlay over the app, naming what the link adds, with **Accept** (one-click claim) and **Decline**.
- Decline dismisses the overlay and clears the token from the URL, leaving the app untouched.
- The old full-screen `InviteAccept` route is retired so the signed-in and logged-out invite paths render the same component.

#### Invalid or expired invite

- While the preview resolves, show a neutral state (no banner). An invalid or expired token falls back to the standard landing, with a brief notice that the link is no longer valid.

#### Try-it sandbox polish

- The start chooser presents **Sample** and **Blank** as real board cards (reuse `LibraryCard` with `toLibraryItems`) so they track the live boards, instead of plain text buttons.
- Drop the up-front "then export as JSON or PDF" instruction. Export stays an available action in the board view (Copy/Download JSON and Print).
- Otherwise unchanged: one in-memory board, no Supabase reads or writes, and an Exit that returns to the landing page.

#### Copy

- User-facing copy on these surfaces reads naturally with plain punctuation: no em dashes or semicolons in visible strings.

### Constraints

- Follow the `frontend-design` skill for the new UI and the `react-testing` skill for tests.
- The `access_requests` table and the `request-access` Edge Function already exist and reach production through the CI-gated pipeline. This work only reshapes the client that calls the function.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- Standard landing: header shows Sign up + Sign in and the hero shows Try it; each auth button opens the shared surface on the correct side; the sign-up side shows the invite-only screen and submitting calls the request function with the email and optional message.
- The in-surface Sign in / Sign up toggle switches sides.
- Invite landing (logged out): a valid preview shows one banner with team and role plus Accept and Decline and no header duplicate; Accept opens the surface; Decline returns to the standard landing and clears the token.
- Signed-in invite link: the overlay offers Accept (claims) and Decline; no full-screen invite screen renders.
- Invalid preview: falls back to the standard landing.
- Sandbox: the chooser shows sample and blank board cards, entering each works, export actions are available, and no Supabase reads or writes occur.
- Update the existing landing and routing tests to the new structure.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- The standard landing shows Sign up and Sign in (both opening one shared surface) and Try it, with no action that promises access it cannot grant.
- An invite link shows a single Accept/Decline (a banner when logged out, an overlay over the app when signed in); Decline returns without touching the database and the link still works; accepting completes through the shared flow.
- No leftover or duplicate invite screen: the logged-in and logged-out invite paths use the same component.
- The sandbox chooser uses real board previews, export is an available action rather than an instruction, and no backend write occurs.

## Follow-ups

_None._

## Implementation Notes

One shared overlay surface now sits behind every door. The three parallel modals are gone and the
full-screen invite route is retired.

- **New `src/landing/AuthModal.tsx`**: the single surface. It carries the Sign in / Sign up switch and a
  one-line tip, and picks its body by context: a valid invite (or any signed-in claim) renders
  `InviteAccept`; otherwise the standard surface renders `LoginForm` (Sign in) or `RequestAccessForm`
  (Sign up). The opening control sets the starting side; the in-surface switch changes it.
- **New `src/auth/AuthTabs.tsx`**: the shared Sign in / Sign up switch, built on the `Tabs` wrapper so its
  chips read as `tab`s and never collide with a form's own "Sign in" submit. Used by both `AuthModal`
  (standard surface) and `InviteAccept` (invite surface), so the two render the identical switch.
- **`LoginForm` is now a chrome-less body** (fields plus the dev quick-sign-in); the surface owns the
  brand, switch, and card. Its `surface` prop is gone since it is only ever floated in `AuthModal` now.
- **New `src/landing/RequestAccessForm.tsx`**: the invite-only Sign up body, extracted from the old
  dialog. Email (required) plus an optional message, submitted through the existing `request-access`
  function, with a confirmation on success and a quiet "Try it in the meantime" link into the sandbox.
- **`InviteAccept` reworked**: it no longer fetches its own preview (the surface resolves it once and
  passes `state` in) and no longer renders full-screen. Its buried "Already have an account?" line is
  replaced by `AuthTabs`. It takes `initialMode` (from the opening side) and an `onDecline` that renders
  a Decline in the signed-in one-click-claim branch.
- **Deleted** `SignInModal.tsx`, `InviteModal.tsx`, `RequestAccessDialog.tsx`.
- **`LandingPage`**: header carries quiet Sign up and Sign in by default. A valid invite raises one banner
  (team and role) with Accept invite (primary) and Decline, drops Sign up from the header, and steps the
  hero Try it down to quiet, keeping one primary per view. Decline calls the new `clearInvite()` to drop
  the token from the URL (no server write, link stays valid). An invalid or expired token falls back to
  the standard landing with a brief "no longer valid" notice; while the preview resolves there is no
  banner.
- **`App`**: the `inviteToken && user` full-screen return is gone. A signed-in invite link instead floats
  `AuthModal` over the app (mounted only while a token is present, so Decline removes it rather than
  flipping its body mid-fade). `useInvitePreview(user ? inviteToken : null)` resolves the preview once for
  that overlay.
- **`Sandbox`**: the start chooser is two real `LibraryCard`s (sample and blank) via `boardToItem`, so
  they track the live boards. The up-front "export as JSON or PDF" instruction is dropped; export stays an
  available action in the board view.
- **Copy**: all visible strings on these surfaces use plain punctuation (no em dashes or semicolons),
  including the hero subtitle that previously had an em dash.
- **Tests**: `tests/landing/LandingPage.test.tsx`, `tests/landing/Sandbox.test.tsx`, and
  `tests/invites/InviteAccept.test.tsx` are updated to the new structure and add coverage for the
  in-surface switch, the signed-in invite overlay, and Decline clearing the token. Full suite: 620 passed.
  Prettier, ESLint, `tsc`, and `npm run build` are all clean.

### Critical Issues

- **None blocking.** One minor, intended behavior: a signed-in visitor opening an invite link at the bare
  root (`/#/invite/<token>`) sees "Loading…" behind the claim overlay, because the root-to-library
  redirect is gated off while a hash route is active. Accept reloads into the app and Decline clears the
  hash so the redirect runs, so both exits resolve to a loaded app. Opening the same link from any real
  in-app URL shows that page behind the overlay as expected.
