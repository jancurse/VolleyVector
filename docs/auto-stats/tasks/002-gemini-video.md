# 002 · Gemini on the whole video

Branch: `002-gemini-video` · Status: planned

## Goal

Find out how well Gemini detects serves and rally ends when it is given the video itself, picture and sound, instead of sampled frames.
Compare it with Claude Opus from [task 001](001-unsupervised-landscape.md), and say which model and settings to use.

- **A second model.** Task 001 rests on one hosted model. Where Gemini and Opus agree on a rally, it can be trusted. Where they differ, look.
- **A cheaper route.** Gemini should cost a fraction of Opus per set, and it takes a video without frames being cut first, which suits the app.

## Scope

Ask for rallies, each a serve and its end, as `claude_rallies.py` does. One pass over the full clip.

### Models

| Model                 | ID                      | Role                                               |
|-----------------------|-------------------------|----------------------------------------------------|
| Gemini 4 Hydrogen     | `gemini-4-hydrogen`     | Main candidate                                     |
| Gemini 4 Carbon       | `gemini-4-carbon`       | Ceiling                                            |
| Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite` | Floor                                              |
| Gemini 3.8 Flash      | `gemini-3.8-flash`      | One comparison run. Its price doubles on 1 January |
| Gemini 4 Argon        | `gemini-4-argon`        | Only if Carbon clearly beats Hydrogen              |

### Settings

Vary these on Hydrogen first, then carry the best to the other models:

- **Media resolution**: low (about 100 tokens per second of video) and high (about 300).
- **Frame rate**: the default 1 fps and one higher rate. The docs tie custom rates to a "static processing mode". Read what the other mode does before choosing.
- **Sound**: with and without, to see what it adds. Some videos have none.

### Order

1. Set 1 of each match (5 clips), all settings on Hydrogen.
2. The same 5 clips on Carbon and Flash-Lite with the best settings.
3. All 14 clips on the best model and settings.
4. One set run twice with the same prompt, to see how much a run varies.

### Optional second pass

Run it only if the best single pass still has more than 10% false serves.
Cut a short clip around each detected rally start, send it at 10 fps, and ask whether it holds a serve and when the contact is.
Report what it removes and what it loses. Its timing cannot be scored against the current labels.

## Inputs

- [../data.md](../data.md): the 14 clips and their set files. Upload the clips through the Files API. A YouTube link only works for a public video.
- [`auto-stats/score.py`](../../../auto-stats/score.py) and the rallies prompt in `auto-stats/001-unsupervised-landscape/claude_rallies.py`.
- Task 001's Opus result on all 14 clips: 90% of serves found with 10% false, 81% of rally ends found with 19% false, at $1.34 a set.
- The API key: `GEMINI_API_KEY` in `~/.config/volleyvector/auto-stats.env`, outside every repo. Never print it or commit it. Checked on 2026-11-15: sent in the `x-goog-api-key` header to `generativelanguage.googleapis.com/v1beta`, it reaches Hydrogen, Carbon, Argon, 3.8 Flash and 3.5 Flash-Lite.
- Google's own pages for models, prices and video input: <https://aistudio.google.com/docs/models>, <https://aistudio.google.com/docs/pricing>, <https://aistudio.google.com/docs/video-understanding>. Check them before the first run. Model names and prices change often.

## Scoring

- Score with `score.py` at ±3 s, per match and overall, as in task 001. Read the share found together with the share false.
- The labels are hand-timed and hold no dead-ball time, so rally ends and sub-second timing are not measured. Say so wherever a number depends on them.
- For the best run, check 20 false serves and 20 missed serves by eye on frame strips (`false_strips.py`), and sort them by kind.
- Compare with Opus rally by rally on the same clips: the share both find, the share only one finds, and what the disagreements are.

## Spending

- The budget is £16 of prepaid credit (about $20), with auto-reload off and a £25 monthly spend cap on the project. Stop and report if a run fails for lack of credit. Do not add credit.
- Thinking tokens are billed as output. Report them per call, and try a lower thinking level if they dominate the cost.
- Every call is paid: the key belongs to a project with billing, and Google does not use paid calls to improve its products. Do not create a second, free project.
- The balance can go slightly negative, because billing lags by about 10 minutes. At zero every call fails with HTTP 402.
- Run Carbon before 1 December 2026, when its price doubles.
- Count the tokens of every call and report the cost per set at paid prices, even for free-tier runs.
- Create no other accounts.

## Done when

- Results holds a table per model and setting: detections, serves found, serves false, rally ends found, rally ends false, and cost per set.
- Results holds the per-match table for the best run on all 14 clips, beside Opus's.
- Results says how much two runs of the same set differ.
- Results says what sound, resolution and frame rate each change.
- Results sorts the best run's false and missed serves by kind, and describes where Gemini and Opus disagree.
- Results recommends a model and settings, or says what is missing to choose.
- The scripts are in `auto-stats/002-gemini-video/` with a README, and read the key from the environment file.

## Results

The session fills this in at the end: what was built, what worked, what didn't, and follow-ups.
Add anything that matters beyond this task to ../log.md.
