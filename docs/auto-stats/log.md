# Log

Dated decisions and learnings, newest first.
Start each entry with **Decision** or **Learning**, and link the task it came from when there is one.

## 2026-11-14 · Learning · Label times sit up to 2 s off the video

In some matches every label is offset from the video by a constant: about 1.5 s early in `2025-11-09-f6-llamas-vs-onyx`, and 1 to 1.5 s late in `2025-11-qkx-vs-f6-llamas`.
Measure a match's offset before scoring anything at ±1 s against its labels.
Task: [tasks/001-unsupervised-landscape.md](tasks/001-unsupervised-landscape.md)

## 2026-11-14 · Learning · Hosted vision models find serves, local signals do not yet

Claude Sonnet on sampled frames found about three quarters of the serves once label offsets were allowed for. Whistles, stillness, single-frame prompts and a generic ball detector each fell well short.
Task: [tasks/001-unsupervised-landscape.md](tasks/001-unsupervised-landscape.md)

## 2026-11-07 · Decision · Don't fit approaches to one video

Approaches must work across cameras, venues, angles and video quality, not only the footage at hand.
Don't rely on details of a single video, such as a fixed camera or a known court position, unless that requirement is stated and checked.

<!--
## 2026-11-07 · Decision · <title>
What was decided and why. Alternatives considered. Task: tasks/001-....md
-->
