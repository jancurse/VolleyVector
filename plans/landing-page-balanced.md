# Landing Page Prompt — Balanced

Build a landing page for VolleyVector: the page a logged-out visitor sees at the root URL before signing in. This variant sits **in the middle**: between the calm minimal version and the lively energetic one.

## Before you write any code

Study the existing app in great detail so the landing page is an extension of it, not a separate-looking site.

- Read `docs/architecture.md` and the relevant modules (`src/court/`, `src/editor/`, `src/library/`, `src/theme/`, `src/ui/`, `src/auth/`, `src/App.tsx`).
- Reuse the real design language: the same fonts, colour tokens, theme handling (light/dark), `BrandMark`/`BrandLockup`, and the `src/ui/` controls. Do not invent a parallel visual system.
- Render a real board through the actual `Court` component. Do not fake it with screenshots or a hand-drawn mock.

## What to build

- **A hero plus one short second beat.** Lead with a hero that fills the first screen. One brief scroll may reveal a single supporting moment (for example the same board mid-animation, or one tight line about building plays step by step). Stop there. No long marketing page, no feature tour.
- **One message: you build volleyball tactics and drills on the board.** That is the whole point of the app, so the page is about exactly that. Do not cover notes, teams, sharing, history, or any other feature. One idea, shown well, with just enough room to breathe and show motion.
- **A live, interactive board is the centrepiece.** Run the real `Court` component through a short animated sequence (a clear, legible play) that a visitor can watch and nudge. It should look alive on load, with motion that has some life to it without being flashy. Keep the content correct and uncluttered: a few markers, one clear movement, nothing that needs explaining.
- **A single "Sign in" button is the only call to action.** There is no public sign-up. Newly invited users arrive through their own invite link (`#/invite/<token>`), which already routes to account setup, so the landing page needs nothing for them. Be honest about being invite-only. Do not add fake "Get started" or "Sign up free" buttons or any growth-hack framing.

## Tone

Balanced: clean and confident, with a little warmth and movement, but never loud. A headline, a short supporting line or two, the live board, and the button. No AI slop, no overselling, no big promises, no buzzwords. If a sentence sounds like marketing, cut it.

## Placement and wiring

- The page replaces what a logged-out visitor currently sees, sitting in front of the login gate at the root, with the existing auth flow reachable from the Sign in button.
- A logged-in user never sees it and goes straight to the app. Share links and invite links keep their precedence.
- Decide with me whether "Sign in" reveals the existing login form inline or navigates to it, before building that part.
