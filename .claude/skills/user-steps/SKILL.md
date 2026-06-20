---
name: user-steps
description: "Guide the user through a step only they can do, one at a time, and see their part through before the task is done. Use when a plan or the user assigns a step to them, or a step needs their login, environment, judgment, or eyes."
---

# User steps

## Overview

A user step is one a plan or the user said they would do, alone or together with you: their login, their environment, their judgment, their eyes, their sign-off. It is part of the task and counts toward done. Do not do it for them, and do not skip it: walk them through it, and the task is not done until their part is.

## Instructions

### What not to do

- **Don't take over.** The step is the user's for a reason. Running their command, making their call, or pressing their button overrides them and can break things you cannot see. "I could do it" is not permission to.
- **Don't dump.** Finishing your part, declaring done, and tacking on "now you need to do X" leaves the task open and the user unguided. The task is done when their part is, not when yours is.

### What to do instead

When you reach a user step, hand it over with instructions good enough that they never have to come back to ask how.

- **Give the next action, not the assignment.** Not "set the secret yourself" but the exact command to run, the URL to open, the values to enter, the button to click, and what they should see when it works.
- **One step at a time when it is interactive.** If they must act, see a result, then act again, give the first step and wait for what they report. Do not hand them the whole chain up front. Send the next step once you know the last one worked.
- **Be ready for follow-ups.** Read what they report, debug a failure with them, and refine the instructions. Helping is not taking over.
- **Close only on their confirmation.** Keep their step open until they say it is done, then finish.

## Examples

### Supabase secret

The last step is the user setting a function secret in the Supabase dashboard, after which you redeploy and verify.

- **Wrong:** "The code is done. You'll need to set `SUPABASE_X` in the dashboard and redeploy." Done is declared, and the user is left to figure their part out.
- **Right:** "Your turn for one step: open the Supabase dashboard, go to Project Settings → Edge Functions → Secrets, add `SUPABASE_X` with the value below, and save. Tell me when it is saved and I'll redeploy and test." Then wait, and continue from what they report.

### User app check

This is a visual check of the running app, specifically assigned to the user: they will run `npm run dev` and click through it themselves, because their eyes catch what your smoke test cannot. (Unassigned, you would smoke-test it yourself with Playwright as usual: that is the normal way to verify UI.)

- **Wrong:** because you can drive the browser, you run `npm run dev`, click through with Playwright as a stand-in, and call the review done. The check assigned to the user is exactly the one you took over.
- **Right:** tell them to run `npm run dev` (it auto-signs-in) and use the `visual-review-summary` skill to give them the list of what to inspect. Then wait for what they find and continue from there.
