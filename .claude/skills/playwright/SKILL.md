---
name: playwright
description: Read before driving the browser with Playwright. Browser use is rare and must earn its token cost — most changes are verified from the code alone. Covers when a visual check pays off, how to keep it cheap, and the dev-server and login facts it depends on.
---

# Verifying UI with Playwright

**Browser use is rare. The default for any change is no browser at all.** Most changes are verified by reading the code, the types, and the tests. Browser output (snapshots, screenshots) costs a lot of tokens and stays in context for the rest of the session, so it directly shortens how long the user can work with you. Open a browser only when a question genuinely cannot be answered from the code.

## When to check visually

Decide by where the change falls:

- **Skip it when the outcome is certain from the code.** A logic change, a refactor, or a small tweak covered by tests and types needs no screenshot. The same goes for a change that copies an existing element's classes or structure: it is correct by construction, and a screenshot proves nothing the code does not.
- **Skip it when a screenshot cannot answer the question.** Motion feel, drag behaviour, animation timing, and drawing quality need the user's eyes. Say so and ask them to look, instead of producing screenshots that decide nothing.
- **Use it only in the narrow middle**: when the outcome is uncertain from the code *and* a static screenshot or snapshot settles it — novel layout, theming interactions, a rendering regression. "Design work" is not by itself a reason; the question must be one the code cannot answer.

## When in the task

- Verify **once, at the end of the task or a coherent stage**, just before wrapping up and reporting. Do not check continuously while coding; that keeps the context small during the work.
- Exception: when the task itself is a live visual iteration with the user reviewing each round, inline checks are the point.

## Keeping it cheap

- **Any check needing more than two browser calls must run in a subagent** (Agent tool): it navigates, clicks, and screenshots in its own context and returns only the findings. Inline browser calls are for a single navigate-and-capture, nothing more. This is a rule, not a preference — "inline is faster" is how sessions balloon.
- **Never manufacture test data through the UI.** If the check needs content that is not on screen (topics, boards, members), do not click it into existence: screenshot the state that exists, or stop and tell the user what the check would cost and let them decide. Setup-by-clicking is the single biggest cost driver, and it also writes to the shared dev database.
- Screenshots are images and cost the most. Take one only when the question is visual; use `browser_snapshot` (text) to confirm structure or that an action landed. A `boxes: true` snapshot answers alignment and sizing questions numerically, without an image.
- Prefer one targeted snapshot over repeated full-page ones, and `browser_wait_for` over snapshot-polling.
- One focused session per verification: resize the viewport once if checking responsive behaviour, and close the browser when done.

## Repo facts

- The dev server is `npm run dev`, always bare — never `--port`, since a non-standard port is not in the Supabase auth redirect allow-list. Reuse a server that is already running instead of starting another.
- A dev build auto-logs-in as a default account (locally the seeded coach; against prod the first entry in `~/.config/volleyvector/dev.env`), so the browser opens past the login gate. To land on a different account, sign out and click its dev quick-sign-in button on the gate rather than typing credentials. Hitting the gate unexpectedly against prod means that file is missing; set it up per @docs/development.md.
- The hash routes outside the signed-in shell are `#/share/<token>` and `#/invite/<token>`.
