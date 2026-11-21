# 005 · Cheaper ways to run Gemini

Branch: `005-cheaper-gemini` · Status: planned

## Goal

Find out how much of the research can run without paying per token.
Tasks 002 and 003 paid for every call through the API, and task 003 spent $20.81.

The same test answers a question for the app: whether a coach can get a usable draft from the Gemini app with no key ([task 004](004-app-integration.md)'s paste route).

## Scope

### Routes to check

- **The Gemini app** on the user's AI Pro plan, with a YouTube link and with an uploaded set.
- **AI Studio** in the browser, with the same prompt and video.
- **A free-tier API key**, if the models and limits cover a set.
- **Batch mode** on the paid API, for runs that need no answer at once.
- **Antigravity or the Gemini CLI** on the plan's quota, if either can read a video.

### What to find out for each

- What it costs, and its limits: video length, file size, and calls per day.
- Which of task 003's settings it allows: the model, the frame rate, the resolution, low thinking, and a start and end inside the video.
- Whether it can be run from a script, or only by hand.
- Whether Google may train on what is sent. The user decides whether that is acceptable for these videos.

Read Google's own pages first. Nothing here is known yet: the list of routes is from memory.

### The test

- One set, `r1vals` set 1, with task 003's prompt as it is.
- Score each route's answer against the labels, and against task 003's cached run of the same set.
- A route counts as usable for research when its score is close to the cached run and its settings can be held fixed between runs.

### Out of scope

- Other providers and other models.
- Improving the prompt.
- Building anything in the app.

## Inputs

- [Task 003](003-rally-touches.md): the prompt, the scoring scripts, and the cached run of `r1vals` set 1.
- [../data.md](../data.md): the clip and the YouTube video it was cut from.
- The user's AI Pro plan. The steps in the Gemini app and AI Studio are the user's to do, with the prompt and the video handed to them.

## Spending

- The aim is $0. Batch mode is the one paid route: test it on one set, about $0.35.
- The rule in [../CLAUDE.md](../CLAUDE.md) holds.

## Done when

- Results holds a table of the routes: cost, limits, settings allowed, scriptable or by hand, and the score on the test set.
- Results says which route to use for research from now on, and what it cannot do.
- Results says whether the Gemini app gives a draft good enough for task 004's paste route, with the prompt used.

## Results

The session fills this in at the end: what was built, what worked, what didn't, and follow-ups.
Add anything that matters beyond this task to ../log.md.
