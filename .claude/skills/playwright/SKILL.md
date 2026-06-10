---
name: playwright
description: Read before driving the browser with Playwright — when a visual check actually pays off, how to keep its token cost contained, and the dev-server and login facts it depends on.
---

# Verifying UI with Playwright

Look and motion are core to this product, so checking changes on screen matters. But browser output (snapshots, screenshots) is expensive and stays in context for the rest of the session, so every check must earn its cost.

## When to check visually

Never drive the browser for its own sake. Decide by where the change falls:

- **Skip it when you are confident without it.** A logic change, a refactor, or a small tweak covered by tests and types needs no screenshot.
- **Skip it when a screenshot cannot answer the question.** Motion feel, drag behaviour, animation timing, and drawing quality need the user's eyes. Say so and ask them to look, instead of producing screenshots that decide nothing.
- **Use it in the middle**: when a static screenshot or snapshot genuinely settles the question — layout, spacing, theming, a control's presence or state, a rendering regression.

## When in the task

- Verify **once, at the end of the task or a coherent stage**, just before wrapping up and reporting. Do not check continuously while coding; that keeps the context small during the work.
- Exception: when the task itself is a live visual iteration with the user reviewing each round, inline checks are the point.

## Keeping it cheap

- **Delegate multi-step verification to a subagent** (Agent tool): it navigates, clicks, and screenshots in its own context and returns only findings. Drive the browser inline only for a quick one-or-two-call check.
- Screenshots are images and cost the most. Take one only when the question is visual; use `browser_snapshot` (text) to confirm structure or that an action landed.
- Prefer one targeted snapshot over repeated full-page ones, and `browser_wait_for` over snapshot-polling.
- One focused session per verification: resize the viewport once if checking responsive behaviour, and close the browser when done.

## Repo facts

- The dev server is `npm run dev`, always bare — never `--port`, since a non-standard port is not in the Supabase auth redirect allow-list. Reuse a server that is already running instead of starting another.
- A dev build auto-logs-in from `~/.config/volleycoach/dev.env`, so the browser opens past the login gate. Hitting the gate means that file is missing; set it up per @docs/development.md rather than logging in by hand.
- The hash routes outside the signed-in shell are `#/share/<token>` and `#/invite/<token>`.
