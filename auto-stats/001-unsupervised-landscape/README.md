# Task 001 test scripts

Scripts behind [the task's results](../../docs/auto-stats/tasks/001-unsupervised-landscape.md). Run them from `auto-stats/` with `.venv/bin/python`. Everything they compute is cached in `auto-stats/cache/`, which git ignores.

## Setup

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python numpy scipy pandas scikit-learn opencv-python-headless torch torchvision ultralytics open_clip_torch transformers pillow
./001-unsupervised-landscape/prep.sh
```

`prep.sh` writes a 10 fps proxy video and mono audio per clip (about 25 minutes for all 14).

## Scripts

Each detector prints the scores of [`../score.py`](../score.py) per match and overall.

| Script              | What it does                                                             | Needs                 |
|---------------------|--------------------------------------------------------------------------|-----------------------|
| `common.py`         | The clip list, cache paths, upright frames, and the score report         |                       |
| `audio_features.py` | Whistle, onset and loudness features at 50 Hz                            | `prep.sh`             |
| `motion_features.py`| Share of changed pixels per proxy frame                                  | `prep.sh`             |
| `audio_whistle.py`  | Serves from a hand-made whistle detector                                 | `audio_features.py`   |
| `signal_fusion.py`  | Serves from quiet, hit, stillness and whistle cues; rally ends from cheers | both feature scripts |
| `audio_tagger.py`   | A pretrained AudioSet tagger (AST) over 2 s windows                      | `prep.sh`, GPU        |
| `tagger_whistle.py` | Serves from the tagger's whistles                                        | `audio_tagger.py`     |
| `clip_embed.py`     | SigLIP embeddings of frames at 2 fps                                     | `prep.sh`, GPU        |
| `clip_zeroshot.py`  | Rally or not from text prompts, frame by frame                           | `clip_embed.py`       |
| `pose_features.py`  | YOLO11 pose with tracking on the proxy (8 minutes a clip)                | `prep.sh`, GPU        |
| `pose_serves.py`    | Serves where the tracked people stand still, then move                   | `pose_features.py`    |
| `whistle_pose.py`   | The tagger's whistles, timed by the people's movement                    | tagger and pose       |
| `ball_check.py`     | How often a generic COCO detector sees the ball in rally frames          | GPU                   |
| `claude_frames.py`  | Claude Sonnet on 1 fps contact sheets, through the `claude` CLI          | `prep.sh`, CLI login  |
| `claude_refine.py`  | A second Claude pass at 5 fps around each serve                          | `claude_frames.py`    |
| `refine.py`         | Scores detection files, or first moves serves to a local audio or motion cue | feature scripts   |
| `offsets.py`        | How far a detection file's times lie from the labels                     |                       |
| `false_strips.py`   | Frame strips around a detection file's false serves, to check by eye      | `prep.sh`             |
| `claude_rallies.py` | Claude asked for rallies (a serve and its end), with any CLI model       | `prep.sh`, CLI login  |
