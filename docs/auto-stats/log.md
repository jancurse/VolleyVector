# Log

Dated decisions and learnings, newest first.
Start each entry with **Decision** or **Learning**, and link the task it came from when there is one.

## 2026-11-16 · Learning · Gemini's touch list is too weak to pre-fill the tracker

Hydrogen, asked per rally for every touch, finds 80% of our touches with 22% false on all 14 clips, and matches the labelled list in 47% of rallies. A guess without the video matches 41%. It names the serving side in 92% of rallies, and misses blocks and freeballs almost entirely.
Task: [tasks/003-rally-touches.md](tasks/003-rally-touches.md)

## 2026-11-16 · Learning · Set low thinking, and send every clip upright

A call on one rally can use 65,000 thinking tokens at the default level. Low thinking costs a tenth and scores no worse. A clip stored turned a quarter turn makes Gemini mix up the two teams: the serving side is right in 75% of rallies as stored and 96% upright.
Task: [tasks/003-rally-touches.md](tasks/003-rally-touches.md)

## 2026-11-15 · Learning · Gemini on the whole video beats Opus on frames, at a quarter of the cost

Gemini 4 Hydrogen at 2 fps, low resolution, with sound found 94% of the serves at ±3 s with 5% false on all 14 clips, for $0.38 a set (Opus: 90%, 10%, $1.34). About half of its remaining errors are labels that sit off the video. Its real misses are whole rallies skipped, and Opus misses different ones.
Task: [tasks/002-gemini-video.md](tasks/002-gemini-video.md)

## 2026-11-14 · Decision · Score serves and rally ends at ±3 s

The labels are hand-timed and sit up to 2 s off the video in some matches, so ±1 s measured the labels more than the detectors. `auto-stats/score.py` uses ±3 s by default.
A 6 s window is wide: always read the share found together with the share of false detections.
Task: [tasks/001-unsupervised-landscape.md](tasks/001-unsupervised-landscape.md)

## 2026-11-14 · Learning · A hosted vision model finds serves, local signals do not yet

Claude on one frame per second, asked for rallies, found 90% of the serves at ±3 s with 10% of detections false (Opus, all 14 clips). Sonnet had 19% false on five sets. Whistles, stillness, single-frame prompts and a generic ball detector each fell well short or fired far too often.
Task: [tasks/001-unsupervised-landscape.md](tasks/001-unsupervised-landscape.md)

## 2026-11-07 · Decision · Don't fit approaches to one video

Approaches must work across cameras, venues, angles and video quality, not only the footage at hand.
Don't rely on details of a single video, such as a fixed camera or a known court position, unless that requirement is stated and checked.

<!--
## 2026-11-07 · Decision · <title>
What was decided and why. Alternatives considered. Task: tasks/001-....md
-->
