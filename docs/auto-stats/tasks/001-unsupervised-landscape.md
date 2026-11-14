# 001 · Unsupervised landscape

Branch: `001-unsupervised-landscape` · Status: planned

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

The session fills this in at the end: what was built, what worked, what didn't, and follow-ups.
Add anything that matters beyond this task to ../log.md.
