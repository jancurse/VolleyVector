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

- A serve counts as found when a detection lies within ±1 s of it. Report the share of serves found and the share of detections that are false, per match and overall.
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

No approach reaches a usable serve detector at ±1 s. Claude Sonnet on sampled frames comes closest, and part of its gap is the labels, not the model: in some matches the labels sit 1 to 2 s off the video.

### What was built

- [`auto-stats/score.py`](../../../auto-stats/score.py) scores serve and rally-end times against a set file, from the command line or from Python.
- [`auto-stats/001-unsupervised-landscape/`](../../../auto-stats/001-unsupervised-landscape/README.md) holds one script per approach tested. Its README lists them and the setup.

### Scoring rule

`score.py` builds one serve and one rally end per rally from the set file. A detection matches at most one of them, and every unmatched detection is false.

- **Our serve** (a serve touch at time t, 266 of 518 rallies): found when a detection lies within ±1 s of t.
- **Their serve** (our first touch is a receive at t, 194 rallies): found when a detection lies between t - 3 s and t + 0.5 s.
- **Unknown serve** (58 rallies with no touch that times the serve): one detection in the gap is ignored, neither found nor false.
- **Rally end**: 507 of 516 rallies end on a touch or manual point that ends play, so the end is found when a detection lies between 1 s before and 4 s after it (4 s before to 2 s after a manual point). The other 9 accept up to 10 s after the last touch.

How far to trust it:

- **The labels are offset by match.** Frame strips show the serve contact about 1.5 s after its label in `2025-11-09-f6-llamas-vs-onyx` and 1 to 1.5 s before it in `2025-11-qkx-vs-f6-llamas`. Detectors that share no code agree on the direction per clip. A ±1 s score against these labels understates every approach.
- The tables therefore give three readings: ±1 s as specified, ±2 s, and ±1 s after moving each clip's labels by one constant (the median offset to the nearest detections). The third is fitted to the detections, so it is an upper bound.
- A detector that fires often scores well on "found" by chance. Read the false share and the number of detections with it.
- Rally ends are scored against a key press, not the dead ball, and inherit the same offsets.

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

| Approach                       | Detections | Found ±1 s | False ±1 s | Found ±2 s | False ±2 s | Found, labels shifted | False, labels shifted |
|--------------------------------|------------|------------|------------|------------|------------|-----------------------|-----------------------|
| Whistle (hand-made) + 2.8 s    | 691        | 43%        | 66%        | 65%        | 52%        | 50%                   | 62%                   |
| Quiet, hit, stillness, whistle | 897        | 37%        | 77%        | 70%        | 60%        | 65%                   | 62%                   |
| SigLIP zero-shot               | 1225       | 24%        | 88%        | 41%        | 81%        | 30%                   | 85%                   |

Model-based approaches, on set 1 of each match (162 scored serves, 183 rallies):

| Approach                          | Detections | Found ±1 s | False ±1 s | Found ±2 s | False ±2 s | Found, labels shifted | False, labels shifted |
|-----------------------------------|------------|------------|------------|------------|------------|-----------------------|-----------------------|
| Claude Sonnet, 1 fps              | 240        | 37%        | 70%        | 78%        | 43%        | 71%                   | 46%                   |
| Claude Sonnet, 1 fps then 5 fps   | 217        | 43%        | 63%        | 75%        | 41%        | 77%                   | 35%                   |
| Tagger whistle + 2.6 s            | 98         | 28%        | 46%        | 38%        | 31%        | 32%                   | 36%                   |
| Pose: still, then moving          | 381        | 43%        | 77%        | 70%        | 66%        | 57%                   | 72%                   |
| Tagger whistle, timed by pose     | 98         | 25%        | 51%        | 39%        | 29%        | 31%                   | 41%                   |

Per match at ±1 s as specified, Claude with both passes found 8% (`llamas-vs-onyx`), 38% (`qkx`), 65% (`onyx-vs-pirates`), 59% (`bg-lions`) and 52% (`r1vals`), with 94%, 65%, 48%, 41% and 58% of detections false. The two worst matches are the two with the label offsets checked by eye. Every script prints the per-match rows.

What the numbers say:

- **Claude finds the serves but times them loosely.** At 1 fps it puts 89 to 100% of our serves within ±3 s in every match. The 5 fps pass cuts false detections from 46% to 35% once the label offset is removed.
- **Many of Claude's false detections are timing, not invention.** In the one set checked, most false detections sat 2 to 5 s from a missed serve. `llamas-vs-onyx` is the exception: 58 serves reported for 41 rallies.
- **The whistle is precise but incomplete.** The tagger rarely fires without a whistle, and a serve follows 2 to 4 s later. It reports 13 to 29 whistles a set for 34 to 41 rallies, so it cannot be the detector, and some videos have no sound.
- **Stillness finds serves and much else.** Players also stand still during time-outs and talks, which gives twice as many detections as rallies.
- **Single frames carry little.** SigLIP separates rally frames from the rest with an AUC of 0.73, too weak to place a serve.
- **A generic ball detector is unreliable.** It saw a ball in 8%, 50%, 55%, 88% and 100% of rally frames by match, and the 100% includes spare balls on a bench.

### Results on rally ends

| Approach                         | Clips | Detections | Found | False | Found, labels shifted | False, labels shifted |
|----------------------------------|-------|------------|-------|-------|-----------------------|-----------------------|
| Claude Sonnet, 1 fps             | 5     | 246        | 45%   | 66%   | 69%                   | 48%                   |
| Cheer (rise in loudness)         | 14    | 1062       | 69%   | 66%   | 66%                   | 68%                   |
| SigLIP zero-shot, falling edge   | 14    | 1226       | 60%   | 75%   | 60%                   | 75%                   |
| Whistle followed by another      | 14    | 180        | 6%    | 84%   | 6%                    | 83%                   |

- Claude reports about the right number of rally ends (246 for 183 rallies) and places them a median 1.5 to 4 s after the label.
- The referees rarely whistle a rally dead in these matches, so the whistle is no rally-end cue.
- The cheer and SigLIP rows fire two to three times per rally. Their "found" share is mostly chance.

### Recommendation

- **Milestone 1, serves.** Use a hosted vision-language model in two passes: a cheap pass over the whole set for candidates, then a dense pass around each candidate for the contact. Claude Sonnet does this at 77% found and 35% false under the lenient reading. Test Gemini on the same clips before choosing: it reads sound and full-rate video, costs about a tenth, and its baseline had no false detections. No local approach is good enough yet.
- **Milestone 2, rally ends.** Nothing can be chosen yet. Claude is the only approach that reports about one end per rally, but half its detections miss the window. The labels cannot settle it, because they mark a key press and not the dead ball.

Missing before either choice is firm:

- Label offsets per match, measured and removed, so that ±1 s means something.
- A Gemini run on the same five sets.
- A volleyball-specific ball tracker, the one local cue that could time both the serve and the dead ball.

### Accounts worth creating

| Account                 | For                                               | Expected cost                                                        |
|-------------------------|---------------------------------------------------|----------------------------------------------------------------------|
| Google AI Studio API key | Gemini on whole videos, on the same scripts      | Free tier with a small daily request limit, else about $0.10 to $0.20 a set |
| Anthropic API key       | Claude without the CLI, with batch pricing        | About $3 a set for both passes at list price. Not needed while the Max plan covers the CLI |
| Hugging Face token      | Gated local models and faster downloads           | Free                                                                 |

### Follow-ups

- Measure each match's label offset and store it with the data, or fix the set files in the collection.
- Run Gemini on set 1 of each match with the same prompts, and score it with `score.py`.
- Test VballNet or TrackNetV3 weights for ball tracking, after you approve the downloads.
- Iterate the Claude prompts: the first prompt was the only one tried.
- Detect a sideways video automatically. `llamas-vs-onyx` is stored turned by 90°, and the scripts turn it by name.
