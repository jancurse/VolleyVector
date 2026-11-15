# 003 · Touches inside a rally

Branch: `003-rally-touches` · Status: planned

## Goal

Find out how well Gemini lists what happens inside a rally: which team serves, and each touch of our team with its skill.
[Task 002](002-gemini-video.md) finds the rallies. This task fills them.

- **The running score.** The team that serves a rally won the one before it, so the serving team of every rally gives the score. The winner is not asked for.
- **The touch list.** Skill and order are what the tracker records by hand today, and the set files hold them for scoring.

## Scope

Gemini 4 Hydrogen at low resolution with sound, as task 002 recommends.

### What to ask for

- **Per rally**: the serve time and the side that serves.
- **Per touch**: the time, the side, and the skill, one of the tracker's seven (`serve`, `receive`, `set`, `attack`, `block`, `defense`, `freeball`).
- Ask for the touches of both sides, since a rally only makes sense as a whole. Only our side can be scored.
- Tell the model which side of the net is ours in each clip. Check whether the set file says, and note it by hand per clip if not.

### Out of scope

- **The player.** Who touched the ball needs player tracking, and is a later task.
- **The zone.**
- **Our own agent loop**, where the model asks for a closer look at a stretch of video. It is a follow-up if frame rate matters and single touches stay unclear.
- **The result** (`kill`, `dig23`, `on`, ...) is optional. Try it once on the best setting and report it apart.

### Settings

Two routes are compared, each from the video to the touch list:

- **One pass.** One call for the whole clip at 2 fps, with the touches added to task 002's prompt.
- **Two passes.** Find the rallies in the whole clip at 1 fps, with task 002's prompt as it is ($0.22 a set). Then cut a clip from 3 s before each serve to the rally's end, and send each at a higher frame rate (5 and 10 fps). Touches are a second apart or less, so 2 fps may not show them.
    - Task 002 holds 1 fps rallies for set 1 of each match only. Run the other 9 clips at 1 fps if this route goes to all 14.
    - Its cost per set is both passes together.
- **Agentic processing** (`"processing": "agentic"`) on one clip, where Gemini chooses how to read the video. Report its tokens and cost, and take it further only if it beats both routes.
- **Carbon** once, on the best setting, before its price doubles on 1 December 2026.

### Order

1. One clip on every setting, to drop what clearly fails.
2. Set 1 of each match (5 clips) on the settings still in the running.
3. All 14 clips on the best setting.
4. One set run twice, to see how much a run varies.

## Inputs

- [../data.md](../data.md): the 14 clips and their set files, with 518 rallies and 1,691 touches of our team. A rally holds 3 of them on average, and 50 rallies hold none.
- Task 002's scripts in `auto-stats/002-gemini-video/` (upload, call, report), its prompt, and its rallies for all 14 clips.
- [`auto-stats/score.py`](../../../auto-stats/score.py), which pairs detected serves with labelled rallies.
- The API key and Google's pages, as in task 002.

## Scoring

- **Pair the rallies first**, by serve time with `score.py`. A labelled rally that Gemini skips counts all its touches as missed. Report those apart from the touches missed inside a paired rally.
- **The serving side**: the share of paired rallies where it is right, and whether the score it gives matches the set's final score.
- **The touches**: inside each paired rally, line up Gemini's touches of our side with the labelled ones by order and skill, not by time. Report the share found and the share false, per skill and overall, and a table of which skills are mistaken for which.
- **Rallies fully right**: the share whose touch list matches the labels exactly.
- **Time** is a cross-check only, at ±3 s. The labels sit a second or two off the video.
- Check 20 wrong rallies by eye on frame strips, and sort them by kind: the model's error, a label error, or a real difference in judgment (`defense` against `freeball`).

## Spending

- Aim to stay under $15. The hard limit is the prepaid credit, about £25 on 2026-11-15. Do not add credit, and stop and report if a call fails for lack of it.
- Spend what the answer needs and no more. Drop a setting once it clearly fails, and stop comparing once one clearly wins. Do not run every setting on every clip for completeness. Run more if a result is too close to call.
- Count the tokens of every call, keep a running total, and report the cost per set.
- The other rules of task 002 hold: one paid project, no other accounts, never print or commit the key.

## Done when

- Results holds a table per setting: serving side right, touches found, touches false, rallies fully right, and cost per set.
- Results holds the table per skill and the table of mistaken skills for the best run on all 14 clips.
- Results says how much two runs of the same set differ.
- Results sorts the 20 checked rallies by kind.
- Results says whether the touch list is good enough to pre-fill the tracker, and which setting to use.
- The scripts are in `auto-stats/003-rally-touches/` with a README.

## Results

The session fills this in at the end: what was built, what worked, what didn't, and follow-ups.
Add anything that matters beyond this task to ../log.md.
