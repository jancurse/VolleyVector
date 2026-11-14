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

- [../data.md](../data.md): the footage and the set files. 14 sets have both video and labels.
- Each set file has `rallies` with `startTime` and `endTime` in video seconds.
    - Only our own serves are recorded as touches, so an opponent-served rally starts at the receive.
    - A rally's `endTime` is its last touch, not the moment the ball goes dead.
- Baseline: Gemini (free tier) on one video. Every serve it reported was within ±1 s of a real one, and it found about two thirds of the serves.
- This machine: RTX 3060 Ti (8 GB), ffmpeg, yt-dlp. No API keys for Gemini, OpenAI or Hugging Face are set.

## Open questions

- Scoring: which tolerance counts as a hit, and which hit rate is good enough for milestone 1?
- Spending: free and local tests only, or a paid API key with a cap for this task?
- Output: is the report below the right shape?

## Done when

- Results holds a survey of the approaches considered, each with what it needs and what it costs.
- Results holds a table of the approaches tested, with hit rate, false alarms and cost per set.
- Results recommends an approach for each milestone, or says what is missing to choose one.
- Results lists the accounts worth creating for further testing, with the expected cost of each.

## Results

The session fills this in at the end: what was built, what worked, what didn't, and follow-ups.
Add anything that matters beyond this task to ../log.md.
