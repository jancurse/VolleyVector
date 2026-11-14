# Log

Dated decisions and learnings, newest first.
Start each entry with **Decision** or **Learning**, and link the task it came from when there is one.

## 2026-11-14 · Decision · Score serves and rally ends at ±3 s

The labels are hand-timed and sit up to 2 s off the video in some matches, so ±1 s measured the labels more than the detectors. `auto-stats/score.py` uses ±3 s by default.
A 6 s window is wide: always read the share found together with the share of false detections.
Task: [tasks/001-unsupervised-landscape.md](tasks/001-unsupervised-landscape.md)

## 2026-11-14 · Learning · A hosted vision model finds serves, local signals do not yet

Claude Sonnet on one frame per second found 92% of the serves and 83% of the rally ends at ±3 s, with about a third of its detections false. Whistles, stillness, single-frame prompts and a generic ball detector each fell well short or fired far too often.
Task: [tasks/001-unsupervised-landscape.md](tasks/001-unsupervised-landscape.md)

## 2026-11-07 · Decision · Don't fit approaches to one video

Approaches must work across cameras, venues, angles and video quality, not only the footage at hand.
Don't rely on details of a single video, such as a fixed camera or a known court position, unless that requirement is stated and checked.

<!--
## 2026-11-07 · Decision · <title>
What was decided and why. Alternatives considered. Task: tasks/001-....md
-->
