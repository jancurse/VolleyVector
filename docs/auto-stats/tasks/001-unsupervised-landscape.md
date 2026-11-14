# 001 · Unsupervised landscape

Branch: `001-unsupervised-landscape` · Status: done

## Goal

Find out which unsupervised approaches can detect serves in match video, and which can detect the end of a rally.
Survey what exists, test as much of it as possible, and recommend an approach for each milestone.

- **Milestone 1: serves.** A serve can show in both sound and picture. An approach must not depend on sound alone, because some videos have none.
- **Milestone 2: end of rally.** This is expected to be harder. Most rallies end without a whistle.

Unsupervised means no training on our own labels. The set files are used only to score results.

## Scope

Consider anything that may help, including:

- General-purpose video models such as Gemini.
- Claude on sampled frames. Test it with a cheap model (Sonnet 5.5).
- Building blocks such as ball detection, player detection and tracking, pose, motion and audio events.

Follow the decision in [../log.md](../log.md): an approach must work across cameras, venues, angles and video quality.

## Inputs

- [../data.md](../data.md): 14 set clips from 5 matches, each with a set file in clip seconds. Read `../data/clips/README.md` before using the labels.
- Baseline: Gemini (free tier) on one video. Every serve it reported was within ±1 s of a real one, and it found about two thirds of the serves.
- This machine: RTX 3060 Ti (8 GB), ffmpeg, and the current yt-dlp through `uvx`. No API keys for Gemini, OpenAI or Hugging Face are set.

## Scoring

- A serve counts as found when a detection lies within ±3 s of it (first set at ±1 s, widened on 2026-11-14 because the labels are hand-timed). Report the share of serves found and the share of detections that are false, per match and overall.
- The labels only hold our own team's touches. A rally they serve starts at our first touch, a moment after their serve, and a rally's end is its last touch, not the ball going dead. Decide how to score against that, state the rule in Results, and say how far it can be trusted.
- No target is set. This task reports what is realistic.

## Spending

- Test everything that is free first: local models on this machine and the free tiers of hosted ones.
- Spend no money and create no accounts. Where a paid service looks worth testing, say which account is needed and what a set would cost.

## Done when

- Results holds a survey of the approaches considered, each with what it needs and what it costs.
- Results holds a table of the approaches tested, with the share of serves found, the share of false detections and the cost per set.
- Results recommends an approach for each milestone, or says what is missing to choose one.
- Results lists the accounts worth creating for further testing, with the expected cost of each.
- One reusable script in `auto-stats/` at the repo root scores a list of detected serve and rally-end times against a clip's set file. The task's test scripts are in `auto-stats/001-unsupervised-landscape/`.

## Results

At ±3 s, Claude Sonnet on one frame per second finds 92% of the serves and 83% of the rally ends, with about a third of its detections false. No local approach comes close without firing far too often.

### What was built

- [`auto-stats/score.py`](../../../auto-stats/score.py) scores serve and rally-end times against a set file, from the command line or from Python.
- [`auto-stats/001-unsupervised-landscape/`](../../../auto-stats/001-unsupervised-landscape/README.md) holds one script per approach tested. Its README lists them and the setup.

### Scoring rule

`score.py` builds one serve and one rally end per rally from the set file. A detection matches at most one of them, and every unmatched detection is false. The tolerance T is 3 s.

- **Our serve** (a serve touch at time t, 266 of 518 rallies): found when a detection lies within ±T of t.
- **Their serve** (our first touch is a receive at t, 194 rallies): the serve is 0.5 to 2 s before t, so it is found when a detection lies between t - 2 s - T and t - 0.5 s + T.
- **Unknown serve** (58 rallies with no touch that times the serve): one detection in the gap is ignored, neither found nor false.
- **Rally end**: 507 of 516 rallies end on a touch or manual point that ends play. The ball is dead up to 3 s later, so the end is found when a detection lies between t - T and t + 3 s + T (t - 3 s - T to t + 1 s + T for a manual point, which is pressed after the ball is dead). The other 9 accept up to 10 s after the last touch.

How far to trust it:

- **The tolerance started at ±1 s and was widened to ±3 s.** The labels are hand-timed, and in two matches they sit off the video by a constant: frame strips show the serve contact about 1.5 s after its label in `2025-11-09-f6-llamas-vs-onyx` and 1 to 1.5 s before it in `2025-11-qkx-vs-f6-llamas`. The tables keep the ±1 s figure for comparison.
- **A window of 6 s is wide.** Rallies start about every 28 s, so a detector that fires twice per rally finds a third of the serves by chance. Read "found" together with the false share and the number of detections.
- A false detection can still be a real serve: a warm-up serve in a break, or one after the set's last labelled rally.

### Approaches considered

| Approach                                          | Needs                                    | Cost per set                                   | Status                                                |
|---------------------------------------------------|------------------------------------------|------------------------------------------------|-------------------------------------------------------|
| Gemini on the whole video (picture and sound)     | A Google AI Studio key                   | Free tier, or roughly $0.10 to $0.20 paid      | Not tested: no key. Baseline: two thirds found, none false |
| Claude Sonnet 5.5 on 1 fps contact sheets         | The `claude` CLI login, or an API key    | $1.13 list price, $0 on the Max plan           | Tested                                                |
| Claude second pass at 5 fps around each serve     | The same                                 | $1.87 more at list price                       | Tested                                                |
| Local vision-language model (Qwen3-VL 8B, SmolVLM2) | A 6 GB model download                  | Free, slow                                     | Not tested                                            |
| SigLIP zero-shot prompts on frames                | A 0.8 GB model                           | Free, 3 minutes                                | Tested                                                |
| Whistle from a hand-made spectral detector        | Sound                                    | Free, seconds                                  | Tested                                                |
| Whistle from a pretrained AudioSet tagger (AST)   | Sound, a 0.3 GB model                    | Free, 2 to 5 minutes                           | Tested                                                |
| Quiet, hit, stillness and cheer cues, hand-fused  | Sound and a still camera                 | Free, seconds                                  | Tested                                                |
| Player tracking and pose (YOLO11 pose, ByteTrack) | A still camera                           | Free, 8 minutes                                | Tested                                                |
| Ball detection with a generic COCO detector       | Full-resolution frames                   | Free                                           | Checked on 60 frames a match                          |
| Volleyball ball trackers (VballNet, TrackNetV3)   | Weights from personal repos              | Free                                           | Not tested: needs your OK to download                 |
| Open-vocabulary temporal action localisation      | Research code, larger GPU                | Free                                           | Not tested                                            |

Gemini prices and free-tier limits come from third-party pages that disagree with each other. Check Google's pricing page before relying on them.

### Results on serves

Hand-made signals, on all 14 clips (460 scored serves, 518 rallies):

| Approach                       | Detections | Found ±3 s | False ±3 s | Found ±1 s | False ±1 s |
|--------------------------------|------------|------------|------------|------------|------------|
| Whistle (hand-made) + 2.8 s    | 691        | 77%        | 42%        | 43%        | 66%        |
| Quiet, hit, stillness, whistle | 897        | 81%        | 54%        | 37%        | 77%        |
| SigLIP zero-shot               | 1225       | 55%        | 75%        | 24%        | 88%        |

Model-based approaches, on set 1 of each match (162 scored serves, 183 rallies):

| Approach                        | Detections | Found ±3 s | False ±3 s | Found ±1 s | False ±1 s |
|---------------------------------|------------|------------|------------|------------|------------|
| Claude Sonnet, 1 fps            | 240        | 92%        | 31%        | 37%        | 70%        |
| Claude Sonnet, 1 fps then 5 fps | 217        | 88%        | 26%        | 43%        | 63%        |
| Tagger whistle + 2.6 s          | 98         | 44%        | 19%        | 28%        | 46%        |
| Pose: still, then moving        | 381        | 83%        | 60%        | 43%        | 77%        |
| Tagger whistle, timed by pose   | 98         | 45%        | 16%        | 25%        | 51%        |

Claude Sonnet at 1 fps, per match at ±3 s:

| Match                              | Serves found | Serve detections false | Rally ends found | End detections false |
|------------------------------------|--------------|------------------------|------------------|----------------------|
| `2025-11-09-f6-llamas-vs-onyx`     | 92%          | 38%                    | 83%              | 44%                  |
| `2025-11-qkx-vs-f6-llamas`         | 86%          | 42%                    | 75%              | 51%                  |
| `2026-10-30-onyx-vs-f6-pirates`    | 94%          | 33%                    | 88%              | 35%                  |
| `2026-11-07-f6-llamas-vs-bg-lions` | 91%          | 18%                    | 92%              | 23%                  |
| `2026-11-08-r1vals-vs-f6-pirates`  | 97%          | 17%                    | 74%              | 35%                  |

Every script prints the per-match rows for its approach.

What the numbers say:

- **Claude finds the serves in every match**, including the sideways portrait video. It needs no sound.
- **Its false detections are mostly early or mid-rally, not missed labels.** See [Claude's false serves](#claudes-false-serves).
- **The 5 fps second pass is not worth its cost at ±3 s.** It drops a few false detections and loses a few serves.
- **The whistle is precise but incomplete.** The tagger rarely fires without a serve following (19% false), but it reports 13 to 29 whistles a set for 34 to 41 rallies, and some videos have no sound.
- **Stillness and the hand-made cues fire too often.** They report 1.7 to 2.4 detections per rally, so much of their "found" share is chance.
- **Single frames carry little.** SigLIP separates rally frames from the rest with an AUC of 0.73.
- **A generic ball detector is unreliable.** It saw a ball in 8%, 50%, 55%, 88% and 100% of rally frames by match, and the 100% includes spare balls on a bench.

### Claude's false serves

All 74 false serve detections of the 1 fps pass were sorted by where they fall in the labels, and 20 of them were checked by eye on frame strips (`false_strips.py`).

| Where the detection falls           | Count | What the strips show                                                                                   |
|-------------------------------------|-------|--------------------------------------------------------------------------------------------------------|
| 3 to 16 s before a labelled serve   | 36    | Players line up, or the server walks out of the picture with the ball. The real serve follows, and Claude reports it too |
| Inside a labelled rally             | 23    | Live play in a long rally (one lasts 61 s with 25 touches and drew four detections)                     |
| In a break, away from any serve     | 14    | A ball rolling back, a server whose serve is called off for a substitution, a real serve the labels do not time |
| After the set's last labelled rally | 1     | A server walking to serve                                                                              |

- **Most are doubles, not inventions.** 59 of 74 sit just before a real serve or inside its rally, where another detection already matched the serve.
- **The near-side server is often out of the picture.** Claude then guesses the serve from the players lining up, several seconds early.
- **Only one checked detection was a real serve the labels miss** (`qkx` at 676 s, inside a rally recorded without touches).
- **Pairing with Claude's own rally ends does not fix it.** Keeping only the last serve before each detected end gives 90% found and 28% false, and keeping the first gives 87% and 30%. The fix has to come from the prompt: one serve per rally, lining up is not a serve, and a rally can be long.

### Results on rally ends

| Approach                       | Clips | Detections | Rallies | Found ±3 s | False ±3 s |
|--------------------------------|-------|------------|---------|------------|------------|
| Claude Sonnet, 1 fps           | 5     | 246        | 183     | 83%        | 39%        |
| Cheer (rise in loudness)       | 14    | 1062       | 518     | 83%        | 60%        |
| SigLIP zero-shot, falling edge | 14    | 1226       | 518     | 78%        | 67%        |
| Whistle followed by another    | 14    | 180        | 518     | 8%         | 77%        |

- The window for a rally end is 9 s wide, so the cheer and SigLIP rows, which fire more than twice per rally, score mostly by chance.
- Claude reports 1.3 ends per rally and places them a median 1.5 to 4 s after the label.
- The referees rarely whistle a rally dead in these matches, so the whistle is no rally-end cue.

### Recommendation

- **Milestone 1, serves.** Use a hosted vision-language model on one frame per second. Claude Sonnet finds 92% with 31% false in a single pass. Test Gemini on the same clips before settling: it reads sound and full-rate video, costs about a tenth, and its baseline had no false detections but missed a third.
- **Milestone 2, rally ends.** The same single pass gives rally ends at 83% found and 39% false, so one call can serve both milestones. It is less settled than serves: the labels mark a key press and not the dead ball, and the window is wide.

Open before either is firm:

- A prompt that stops the double detections before a serve and inside long rallies.
- A Gemini run on the same five sets.
- A volleyball-specific ball tracker, the one local cue that could replace a hosted model.

### What is seriously wrong

- **One serve detection in three is false.** A coach would get about 1.3 serves per rally. Most are doubles of a real serve, so this is a prompt and pairing problem, not a seeing problem.
- **Rally ends are not measured.** The labels hold the last touch or a key press, never the dead ball, and the window is 9 s wide. The 83% found says little.
- **The evidence is thin.** Five sets, one prompt, one run each. How much a second run of the same prompt differs is unknown.
- **Everything depends on one hosted model.** No local approach is close, so there is no fallback and no cross-check.

### Closing the gap

1. Ask for rallies, not events: each answer is a list of (serve, end) pairs. That forces one serve per rally and removes both main kinds of double. Tell the model that lining up is not a serve and that the near server can be out of the picture.
2. Merge the overlapping windows by rally, and drop a rally shorter than a second or one that starts inside another.
3. Use the whistle where there is sound. The tagger's whistles are rarely false (19%), so a whistle 2 to 4 s before a candidate confirms it and a candidate without one in a refereed match is suspect.
4. Fix the measurement: run all 14 clips, run each twice, and mark the dead ball by hand in one set so rally ends can be scored.
5. Run a second model on the same clips. Where two models agree, trust the rally. Where they differ, look.

### Other models to try

| Model                                   | Access                                                        | Why                                                                                         |
|-----------------------------------------|---------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| Gemini (current Flash and Pro)          | Google AI Studio API key. Free tier, paid needs billing set up | Reads the video and its sound directly, and takes a YouTube link, which every match here has |
| Claude Opus 5.5 or Fable 5.2            | The same `claude` CLI on the Max plan. No new key             | Same script with `MODEL` changed. Shows whether a stronger model drops the doubles          |
| GPT (current vision model)              | OpenAI API key, paid. A ChatGPT subscription does not cover it | Frames like Claude, as a second opinion                                                     |
| Qwen3-VL through a host                 | OpenRouter API key, paid, about $0.15 to $0.25 per million input tokens | Trained for timing events in video. Cheap                                            |
| Qwen3-VL 8B on this machine             | A free Hugging Face download of about 6 GB                    | The only route to a local fallback. Slow on 8 GB                                            |
| Twelve Labs Pegasus                     | Twelve Labs account, about $1.75 per hour of video            | Built for video search and timing, priced by the hour                                       |

Model names, prices and free-tier limits come from third-party pages and were not checked against the providers. An Anthropic API key is only needed to run Claude without the CLI.

### Follow-ups

- Rewrite the Claude prompt against the two main kinds of false serve, and run it again on the same five sets.
- Run Gemini on set 1 of each match with the same prompts, and score it with `score.py`.
- Run Claude on the other nine clips. Only set 1 of each match was tested.
- Test VballNet or TrackNetV3 weights for ball tracking, after you approve the downloads.
- Detect a sideways video automatically. `llamas-vs-onyx` is stored turned by 90°, and the scripts turn it by name.
