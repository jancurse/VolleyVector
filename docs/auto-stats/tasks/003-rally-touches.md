# 003 · Touches inside a rally

Branch: `003-rally-touches` · Status: done

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

Gemini 4 Hydrogen names the serving side in 92% of rallies and finds 80% of our touches, with 22% of the touches it reports false, over all 14 clips. That is two passes at low thinking, for $0.67 a set. The touch list of a rally matches the labels in 47% of rallies, so it cannot record a set unattended. As a draft for a person to correct it helps: 76% of our touches get a time within 1.5 s, and two thirds of those already carry the right skill.

### What was built

- [`auto-stats/003-rally-touches/`](../../../auto-stats/003-rally-touches/README.md) holds the scripts: the calls for both routes, the score report, a run comparison, and zoomed frame pages. Its README says how a run is scored.
- **The second pass cuts nothing.** It sends the uploaded clip once per rally with `start_offset` and `end_offset`, from 3 s before the serve to 2 s after the end.
- **Our side is set by hand per match.** The set files do not say. Ours is the far half in the four `onyx-vs-f6-pirates` sets and the near half in the other ten.
- **Rallies are paired after moving each clip's labels by one constant**, the median offset of the serves. Unmoved, 486 of 518 rallies pair, and moved 498.

### Settings

One clip (`r1vals` set 1: 35 rallies, 102 touches of ours), every setting on Hydrogen unless named. The cost of two passes includes the rallies pass ($0.20).

| Route                               | Serving side right | Touches found | Touches false | Rallies fully right | Cost per set |
|-------------------------------------|--------------------|---------------|---------------|---------------------|--------------|
| One pass, 2 fps                     | 80%                | 80%           | 40%           | 37%                 | $0.42        |
| One pass, agentic                   | 97%                | 75%           | 27%           | 40%                 | $2.04        |
| Two passes, 5 fps, default thinking | 94%                | 75%           | 20%           | 43%                 | $3.45        |
| Two passes, 2 fps, low thinking     | 94%                | 82%           | 19%           | 51%                 | $0.60        |
| Two passes, 5 fps, low thinking     | 100%               | 83%           | 22%           | 49%                 | $0.73        |
| Two passes, 10 fps, low thinking    | 97%                | 87%           | 21%           | 43%                 | $1.00        |
| Carbon, two passes, 2 fps, low      | 86%                | 80%           | 29%           | 43%                 | $0.47        |

- **One pass fails.** It adds a second and third `defense set attack` to rallies that have none, and names our side as server in 7 rallies they served.
- **Thinking must be set to low.** At the default level the 35 rally calls used 393k thinking tokens, one of them 65k before it came back unfinished. Low thinking uses 30k and scores no worse.
- **Agentic processing read 1.1M tokens of video** and found fewer touches than two passes. It was not taken further.
- **Carbon does not beat Hydrogen**, and costs about $0.95 a set from 1 December 2026.
- **Frame rate does not change the touches.** On three set-1 clips (108 rallies), 2 fps finds 81% with 23% false and 5 fps 84% with 23% false. The two rates give the same touch list in 65 of 107 rallies.
- **5 fps may name the server better**: 103 of 103 paired rallies on those three clips, against 96 at 2 fps. It was not run on all 14.
- **A clip stored on its side must be turned upright.** `llamas-vs-onyx` is filmed in landscape and stored turned a quarter turn. Sent as stored, the serving side is right in 75% of rallies and 34% of the touches are false. Sent upright: 96% and 26%.

### All 14 clips

Two passes at 2 fps and low thinking, with `llamas-vs-onyx` upright: 498 of 518 rallies paired, 1,691 labelled touches.

| Match                              | Sets | Rallies paired | Serving side right | Touches found | Touches false | Rallies fully right |
|------------------------------------|------|----------------|--------------------|---------------|---------------|---------------------|
| `2025-11-09-f6-llamas-vs-onyx`     | 2    | 77/86          | 96%                | 86%           | 26%           | 55%                 |
| `2025-11-qkx-vs-f6-llamas`         | 2    | 68/75          | 88%                | 80%           | 26%           | 41%                 |
| `2026-10-30-onyx-vs-f6-pirates`    | 4    | 136/136        | 87%                | 78%           | 21%           | 49%                 |
| `2026-11-07-f6-llamas-vs-bg-lions` | 3    | 107/109        | 95%                | 83%           | 18%           | 48%                 |
| `2026-11-08-r1vals-vs-f6-pirates`  | 3    | 110/112        | 93%                | 75%           | 23%           | 43%                 |
| All                                | 14   | 498/518        | 92%                | 80%           | 22%           | 47%                 |

- **The 20 unpaired rallies hold 39 touches**, so 78% of all labelled touches are found.
- **The score is right in 1 set of 14.** One wrong server moves it by a point, and a set has three. The side is right in 96% of the rallies we serve and 87% of those they serve.
- **Time agrees.** 91% of the found touches lie within 3 s of their label.

Per skill, inside paired rallies:

| Skill      | Labelled | Found | Reported | False |
|------------|----------|-------|----------|-------|
| `serve`    | 262      | 96%   | 288      | 13%   |
| `receive`  | 191      | 86%   | 185      | 11%   |
| `set`      | 400      | 85%   | 409      | 17%   |
| `attack`   | 377      | 84%   | 395      | 20%   |
| `block`    | 84       | 14%   | 62       | 81%   |
| `defense`  | 292      | 79%   | 306      | 25%   |
| `freeball` | 46       | 26%   | 62       | 81%   |

Labelled skill (rows) against the skill Gemini gives the touch lined up with it (columns). The last column is a labelled touch with none lined up, and the last row a reported touch with no label.

| Labelled   | `serve` | `receive` | `set` | `attack` | `block` | `defense` | `freeball` | None |
|------------|---------|-----------|-------|----------|---------|-----------|------------|------|
| `serve`    | 251     | 1         | 1     | 3        | 0       | 0         | 0          | 6    |
| `receive`  | 5       | 165       | 3     | 1        | 0       | 6         | 0          | 11   |
| `set`      | 6       | 2         | 339   | 3        | 3       | 4         | 7          | 36   |
| `attack`   | 5       | 0         | 1     | 315      | 12      | 2         | 27         | 15   |
| `block`    | 1       | 1         | 3     | 19       | 12      | 5         | 3          | 40   |
| `defense`  | 0       | 2         | 11    | 2        | 9       | 231       | 3          | 34   |
| `freeball` | 0       | 0         | 1     | 13       | 0       | 19        | 12         | 1    |
| None       | 20      | 14        | 50    | 39       | 26      | 39        | 10         |      |

- **Blocks and freeballs are not found.** Half the labelled blocks get no touch at all, and a labelled freeball is called an attack or a defense.
- **The four common skills hold**, at 79% to 96% found.

### Against a guess

A guess that knows who serves and reports `serve` when we serve and `receive set attack` when they do, without the video, is fully right in 41% of rallies. It finds 48% of the touches with 19% false.

| Labelled touches in the rally | Rallies | Gemini fully right | Guess fully right |
|-------------------------------|---------|--------------------|-------------------|
| 0                             | 43      | 21                 | 0                 |
| 1                             | 141     | 104                | 123               |
| 2 to 3                        | 147     | 67                 | 82                |
| 4 to 6                        | 105     | 37                 | 0                 |
| 7 or more                     | 62      | 6                  | 0                 |

- **Gemini is worse than the guess on short rallies**, where it adds touches, and right in a quarter of the long ones.
- Its lists follow the pattern `defense set attack` closely. Much of what it gets right is what a rally usually holds.

### As a draft to correct

The aim is to save the recorder work, not to record a set unattended. So the same run is scored by time alone (`report.py --times`): over the whole clip, each touch is matched to the nearest label, each label at most once, whatever its skill.

| Touches taken     | Within | Labelled touches with a touch nearby | Of those, same skill | Reported touches with no label nearby | Median offset |
|-------------------|--------|--------------------------------------|----------------------|---------------------------------------|---------------|
| Given to our side | 1 s    | 69%                                  | 68%                  | 33%                                   | 0.35 s        |
| Given to our side | 1.5 s  | 76%                                  | 67%                  | 26%                                   | 0.40 s        |
| Given to our side | 2 s    | 80%                                  | 67%                  | 22%                                   | 0.42 s        |
| Of either side    | 1.5 s  | 92%                                  | 51%                  | 54%                                   | 0.32 s        |

- **Three of four touches come placed in time.** The recorder would delete about one drafted touch in four and add the missing quarter, mostly blocks, freeballs and last digs.
- **The times are close.** The median offset is 0.4 s, and the labels are themselves hand-timed, so part of it is theirs.
- **Two thirds of the placed touches need no skill typed.** Serve, receive, set, attack and defense hold. A block or a freeball nearly always needs fixing.
- **The loss is the team, not the touch.** 92% of our touches have a touch of either side within 1.5 s. Some of that is chance, since a rally has a touch every second or so. A wrong serving side gives a whole rally's touches to the other team.
- **Not measured:** whether correcting a draft is faster than recording from nothing. That depends on how cheap deleting and retyping are in the tracker.

### Two runs of the same set

`r1vals` set 1 was run twice, both passes.

- Both runs report the same 35 rallies.
- The serving side is the same in 33, and the list of our touches in 27.
- 93 of 106 touches agree. Both runs find 82%, with 19% and 14% false.

### 20 wrong rallies checked by eye

20 rallies of at most 6 s, spread over all 14 clips, on frame pages at 3 fps cropped to the court (`strips.py`). Longer rallies were left out, so this says little about them.

| Kind                                                                  | Count |
|-----------------------------------------------------------------------|-------|
| The model's error: the wrong serving side, the server out of picture  | 5     |
| The model's error: a `set` and `attack` that did not happen           | 3     |
| The model's error: a block or a last dig missed                       | 3     |
| A label error: a touch or a serve of ours not recorded                | 3     |
| A difference in judgment: `block` against `defense` or `attack`       | 2     |
| Not settled on the frames: a block attempt, or the far side too small | 4     |

- **11 of 20 are the model's.** No case was `defense` against `freeball`.
- **A wrong serving side spoils the whole rally**: the touches are then given to the wrong teams.

### Recommendation

Offer the touch list as a draft the recorder corrects, on top of the rallies from task 002. Do not use it unattended: half the rallies need a correction.

- **The setting** is Hydrogen in two passes at low thinking, 2 fps per rally, with the clip upright: $0.67 a set.
- **What the draft gives**, in falling order of trust: each rally's start and end (task 002), the serving side (92%), a time for three of four touches, and the skill of the common ones.
- **What the recorder still does:** the player and the result of every touch, the blocks and freeballs, deleting about one drafted touch in four, and checking the serving side.
- **Fix the serving side first.** It is the largest single loss, and 5 fps got it right in 103 of 103 rallies on three clips for about $0.15 more a set.

### Spending

The runs come to $20.81 at paid prices, counted from the tokens of each cached answer, against the $15 aimed for. A call that timed out and one clip that may have run twice could add $1.40. Google's own bill was not checked.

- $5.50 went on two tests that failed: default thinking ($3.45) and agentic processing ($2.04).
- The result was not asked for (`kill`, `dig23`, ...), to save the cost.
- Task 002's cached rallies were gone with its worktree, so all 14 clips were uploaded and run at 1 fps again ($3.02, and 80 minutes of upload). The cache now lives in `../data/cache/`, outside every worktree ([data.md](../data.md#cache)).

### Follow-ups

- Load a draft into the tracker and time a recorder correcting it against recording from nothing.
- Run 5 fps on all 14 clips for the serving side alone, or ask for the server in a call of its own on the seconds around the serve.
- Derive the score from the serving sides with a check that it must rise by one point per rally, and see how many sets it repairs.
- Test whether the touches improve when the model is told the serving side and the rally's length, or is asked to describe each ball crossing before it names touches.
- Record in each set file which half is ours and whether the video is stored on its side.
- Fix the labels the strips showed wrong: `bg-lions` set 1 rally 34, set 2 rally 14 and set 3 rally 24.
