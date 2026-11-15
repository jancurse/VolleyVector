# 002 · Gemini on the whole video

Branch: `002-gemini-video` · Status: done

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

Gemini 4 Hydrogen on the whole clip, at 2 frames per second and low resolution with sound, finds 94% of the serves at ±3 s with 5% of its detections false, over all 14 clips. It finds 94% of the rally ends with 5% false. A set costs $0.38, against $1.34 for Opus at 90% and 10%.

### What was built

- [`auto-stats/002-gemini-video/`](../../../auto-stats/002-gemini-video/README.md) holds the scripts: uploads, one call per clip, the score report, a serve-by-serve comparison, and frame strips. Its README lists them and what the API accepted.
- The rallies prompt is task 001's, reworded for a video and asking for `MM:SS` times. One call covers the whole clip, so nothing is merged.

### Models and settings

Set 1 of each match (5 clips, 183 rallies, 162 scored serves), at ±3 s. Tokens and cost are per set at the paid prices of 2026-11-15.

| Model      | Settings              | Serve detections | Serves found | Serves false | Ends found | Ends false | Input tokens | Thinking tokens | Cost per set |
|------------|-----------------------|------------------|--------------|--------------|------------|------------|--------------|-----------------|--------------|
| Hydrogen   | low, 2 fps, sound     | 182              | 96%          | 4%           | 93%        | 7%         | 204k         | 8k              | $0.37        |
| Hydrogen   | low, 1 fps, sound     | 182              | 91%          | 9%           | 95%        | 5%         | 113k         | 5k              | $0.22        |
| Hydrogen   | low, 1 fps, no sound  | 179              | 91%          | 8%           | 89%        | 9%         | 79k          | 9k              | $0.19        |
| Hydrogen   | high, 1 fps, sound    | 173              | 90%          | 6%           | 90%        | 5%         | 325k         | 6k              | $0.54        |
| Carbon     | low, 2 fps, sound     | 193              | 94%          | 11%          | 92%        | 13%        | 204k         | 1k              | $0.43        |
| 3.8 Flash  | low, 2 fps, sound     | 204              | 87%          | 23%          | 84%        | 25%        | 168k         | 4k              | $0.15        |
| Flash-Lite | low, 2 fps, sound     | 330              | 83%          | 54%          | 85%        | 53%        | 168k         | 0               | $0.05        |
| Flash-Lite | low, 1 fps, sound     | 219              | 81%          | 32%          | 78%        | 36%        | 98k          | 0               | $0.03        |
| Opus (001) | frames at 1 fps       | 181              | 91%          | 9%           | 79%        | 22%        | 290k         |                 | $1.31        |

- **Hydrogen is the model to use.** Carbon does not beat it, so Argon was not run. Flash-Lite and 3.8 Flash invent rallies.
- **Carbon costs twice as much from 1 December 2026** ($0.85 a set), and 3.8 Flash from 1 January 2027.
- **Thinking is 16% of Hydrogen's cost**, so no lower thinking level was tried. Each answer is about 800 output tokens.
- **Agentic processing was tried on one clip.** It read 331k tokens of video for $0.60 and found the same serves as the $0.20 static pass. It only takes the plain string `"processing": "agentic"`.

What each setting changes, on Hydrogen:

- **Frame rate.** 2 fps lifts serves found from 91% to 96%. The gain is timing, not detection: both rates report the same serves, and 2 fps places them closer to the contact. With each clip's labels moved by one constant, both find 97% with 3% false.
- **Resolution.** High costs 2.5 times as much and finds no more. It reports fewer rallies (173 against 182).
- **Sound.** Without it the overall serve score is the same, but `llamas-vs-onyx` drops from 97% found to 81%, and rally ends fall from 95% to 89%. With sound at 1 fps, serves are timed up to a second earlier, which costs `qkx` at ±3 s (52% found, against 76% without sound).

### All 14 clips

Hydrogen at low resolution, 2 fps, with sound (505 serves reported for 518 rallies, 460 scored serves), beside Opus from task 001:

| Match                              | Sets | Serves found | Serves false | Ends found | Ends false | Opus serves found | Opus serves false | Opus ends found | Opus ends false |
|------------------------------------|------|--------------|--------------|------------|------------|-------------------|-------------------|-----------------|-----------------|
| `2025-11-09-f6-llamas-vs-onyx`     | 2    | 93%          | 7%           | 92%        | 5%         | 87%               | 12%               | 72%             | 27%             |
| `2025-11-qkx-vs-f6-llamas`         | 2    | 90%          | 7%           | 86%        | 10%        | 86%               | 15%               | 85%             | 16%             |
| `2026-10-30-onyx-vs-f6-pirates`    | 4    | 98%          | 4%           | 96%        | 5%         | 90%               | 12%               | 82%             | 21%             |
| `2026-11-07-f6-llamas-vs-bg-lions` | 3    | 90%          | 5%           | 93%        | 3%         | 91%               | 7%                | 86%             | 13%             |
| `2026-11-08-r1vals-vs-f6-pirates`  | 3    | 97%          | 2%           | 98%        | 2%         | 92%               | 5%                | 79%             | 18%             |
| All                                | 14   | 94%          | 5%           | 94%        | 5%         | 90%               | 10%               | 81%             | 19%             |

- **The worst sets** are `bg-lions` set 3 (74% of serves found) and `qkx` set 1 (79%). Eleven of the 14 find 94% or more.
- **At ±5 s** it finds 97% with 2% false, and at ±1 s 73% with 25% false (Opus: 40% and 56%).
- **Rally ends are still not measured.** The labels hold the last touch or a key press, never the dead ball, and the window is 9 s wide.
- False serves are under 10%, so the second pass was not run.

### Two runs of the same set

Two sets were run twice with the same prompt and settings (`qkx` set 1 and `llamas-vs-onyx` set 1).

- **The runs agree on 73 of 78 serves.** One run reports 3 serves the other lacks, the other 2.
- **The score moves more than the detections.** `qkx` set 1 went from 79% found to 72%, and `llamas-vs-onyx` set 1 from 100% to 95%. Shared serves shift by a second between runs, and in `qkx` the labels sit 2 s off, so a second decides whether a serve falls inside ±3 s.

### False and missed serves

The 14-clip run has 24 false and 27 missed serves. 20 false and 21 missed were checked on frame strips (`strips.py`). The strips are one frame per second, so a contact is judged from the players and the ball's flight.

| False serves (20 checked)                              | Count |
|--------------------------------------------------------|-------|
| A real serve, with its label more than 3 s away        | 7     |
| A real serve the labels do not time                    | 4     |
| Live play in a rally (two of them a serve timed late)  | 6     |
| Dead time: players standing or the ball rolled back    | 3     |

| Missed serves (21 checked)                                             | Count |
|------------------------------------------------------------------------|-------|
| Reported, but more than 3 s from its label                             | 8     |
| Reported 4 to 7 s late, inside the rally                               | 2     |
| Two labelled serves in one unbroken rally                              | 3     |
| Reported within 2 s, but matched to another label by the scorer        | 1     |
| Not reported: the rally is skipped, or merged with the one before it   | 7     |

- **About half of both lists are the labels, not the model.** 11 of the 20 false serves are real serves, and 12 of the 21 missed ones were reported or are doubtful labels.
- **The real misses are whole rallies.** `bg-lions` set 3 has six: Gemini reports 32 rallies for 38 and joins two of them into one of 51 s.
- **Few are inventions.** 3 of 20 fall in dead time.

### Gemini against Opus

Serves of the two models within 4 s of each other count as the same serve. All 14 clips:

| Serves             | Count | Near a labelled serve | In an unscored gap | Neither |
|--------------------|-------|-----------------------|--------------------|---------|
| Both report        | 477   | 428                   | 44                 | 5       |
| Only Gemini        | 28    | 16                    | 4                  | 8       |
| Only Opus          | 32    | 10                    | 3                  | 19      |

- **A serve both report is almost always real.** 472 of 477 lie near a labelled serve or in a rally the labels do not time.
- **Opus's extras are mostly false, Gemini's mostly real.** 19 of Opus's 32 lie away from any serve, against 8 of Gemini's 28.
- **They miss different serves.** Only 3 of 460 labelled serves have no detection from either within 5 s. In `bg-lions` set 3, Opus reports six labelled serves that Gemini skips.
- Gemini's times are a median 0 to 1 s before Opus's.

### Recommendation

Use Gemini 4 Hydrogen on the whole clip at low resolution, 2 fps, with sound: $0.38 a set, a quarter of Opus's cost, with half its false serves. At 1 fps it costs $0.22 and reports the same serves a little further from the contact.

Missing before it is firm:

- **A dead-ball label.** Rally ends, and any timing finer than 3 s, cannot be scored.
- **The skipped rallies.** One set in 14 lost six. A second run or the Opus pass would catch them, since the models miss different serves.
- **Variation.** Only two sets were run twice.

### Spending

The runs come to about $14.80 at paid prices, counted from the tokens of each call. Google's own bill was not checked. No call failed for lack of credit.

### Follow-ups

- Mark the dead ball by hand in one set, so rally ends and serve timing can be scored.
- Run each set twice, or Hydrogen and Opus together, and look at the rallies only one reports.
- Fix the labels the strips showed wrong: two serves in one rally (`qkx` set 1 at 68 s and 398 s, `llamas-vs-onyx` set 2 at 179 s) and serves labelled 4 to 5 s off.
- Test a video without re-uploading 0.1 to 1.1 GB per set: a downscaled copy, or a YouTube link for a public video.
