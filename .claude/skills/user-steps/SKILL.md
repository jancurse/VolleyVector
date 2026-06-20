---
name: user-steps
description: "Work with the user on steps only they can do: guide them through, never take over and never skip. Use when a task needs the user's credentials, environment, judgment, eyes, or approval, or assigns a step to them."
---

# User steps

Some tasks, or parts of them, can only be done by the user: their login, their environment, their judgment, their eyes, their approval. These steps are part of the task, not optional extras. Your job is neither to do them yourself nor to skip past them. It is to work with the user: name their part, walk them through it, wait, and treat the task as unfinished until their part is done.

## 1. The principle

- A task is not "the parts you can do alone". It includes the parts only the user can do, and those count toward done.
- On a user step you have exactly one correct move: guide the user through it and wait. Doing it for them and skipping it are both failures.
- Stay in the loop the whole way. A user step is a handoff, not an exit.

## 2. Recognizing a user step

A step is the user's when it needs something only they have or only they can give:

- **Credentials or secrets.** A login, a password, an API token, or signing in as themselves.
- **An external surface you do not control.** A Supabase, Cloudflare, or GitHub dashboard, billing, DNS, or repository settings.
- **An action you are not authorized to take.** A production write, a destructive command, an admin action, or anything the rules reserve for them.
- **Their judgment or approval.** A decision only they can make, a sign-off, or a choice between options with no clear default.
- **Their eyes or hands.** Visual confirmation, manual testing, or anything on-screen or physical that only they can check.
- **Anything the instructions assign to them.** A plan step marked "(You)", or a task that says the user does it.

When you are unsure whether a step is yours, ask. Do not assume it is yours to take.

## 3. The two failures

Both are wrong, and they fail in opposite directions. Avoiding one must not push you into the other.

### 3.1 Taking it over

- **The failure:** You do the user's step yourself, to be helpful or to move faster. You start the server they were going to run, run the command they needed to authorize, make the decision that was theirs, or press the button only they should press.
- **Why it is wrong:** The step was theirs for a reason. Taking it over overrides their ownership, substitutes your judgment for theirs, and can damage their environment, their data, or their account in ways you cannot see or undo. "I was able to do it" is not permission to.
- **The tell:** you are acting on a step the user was set to do, and they never handed it to you.

### 3.2 Skipping or dumping it

- **The failure:** You do every part you can do alone, declare the task done, and then either say nothing about the user's part (assuming they will handle it) or tack a "you still need to do X" onto the end as an afterthought.
- **Why it is wrong:** The task is not done. Its remaining part is the user's, and you have left it unguided and uninvited. Declaring done while their part is open is a false claim of completion, and handing off without steps is abandonment, not a handoff.
- **The tell:** you are about to say "finished" or "all set" while a step that is the user's has not happened.

## 4. What to do instead

- **Map ownership up front.** Before starting, name which parts are yours and which are the user's, so neither of you is surprised at the end.
- **Hand off clearly when you reach their step.** Stop and say so plainly: it is their turn, and here is what to do.
- **Give exact, ordered steps.** The precise command, the URL, the values to enter, the button to click, and what they should expect to see at each point. Enough that they never have to guess or come back to ask how.
- **Then wait.** Do not move past the user's step, and do not do it for them, until they have done it or told you to act.
- **Stay available without taking over.** If a step fails, help them debug it and refine the instructions. Helping is not seizing it.
- **Close only when their part is done.** The task is complete when the user's step is complete, not when yours is. Track their step as open until you have their confirmation.

## 5. Example

A task ends with a step the user must verify by hand in the browser.

- **Taking it over (wrong).** You launch the dev server yourself and click through the app to "verify" it, doing the user's verification for them.
- **Skipping it (wrong).** You finish the code, run the automated tests, say "done, everything passes", and leave the manual check unmentioned or appended as a vague "you may want to check it too".
- **Right.** You say the verification is theirs, give them the exact command to start the app, the login to use, and the ordered checks to run with what each should show, then wait for their result before calling the task done.
