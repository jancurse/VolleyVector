# Task 003 scripts

Scripts behind [the task's results](../../docs/auto-stats/tasks/003-rally-touches.md). Run them from this folder with the system `python3`: they need only the standard library and `ffmpeg`. They import the key, the uploads and the rallies call from [`../002-gemini-video/`](../002-gemini-video/README.md), and cache every answer in `auto-stats/cache/gemini/`, which git ignores.

## Scripts

| Script       | What it does                                                                                                    |
|--------------|-----------------------------------------------------------------------------------------------------------------|
| `touches.py` | Asks Gemini who serves each rally and for every touch with its side and skill, in one pass or two               |
| `report.py`  | Scores every cached run against the set files: serving side, touches found and false, rallies fully right, cost |
| `compare.py` | Compares two runs rally by rally                                                                                |
| `strips.py`  | Zoomed frame pages of rallies whose touch list differs from the labels, to check by eye                         |

## Example

```bash
python3 touches.py two gemini-4-hydrogen 2026-11-08-r1vals-vs-f6-pirates__set1 --fps 2 --thinking low
python3 report.py --skills two_gemini-4-hydrogen_2fps_think-low
python3 strips.py two_gemini-4-hydrogen_2fps_think-low ../cache/strips003
```

## What the scripts assume

- **Our side of the net** is set per match in `SIDES` in `touches.py`. The set files do not say. It was read off frames at labelled serves and receives: ours is the far half in the four `onyx-vs-f6-pirates` sets and the near half in every other clip.
- **A clip stored on its side** is listed in `SIDEWAYS` and sent as an upright copy. Sent as stored, the model mixes up the two teams.
- **Two passes** take the rallies from task 002's call on the whole clip, then send the same uploaded file once per rally with `start_offset` and `end_offset`, from 3 s before the serve to 2 s after the end. Nothing is cut or uploaded again.
- **Pass `--thinking low` with two passes.** At the default level a single rally can use 65,000 thinking tokens and come back unfinished.

## How a run is scored

- Rallies are paired by serve time with [`../score.py`](../score.py), after each clip's labels are moved by one constant (the median offset between detected and labelled serves).
- Inside a paired rally, the model's touches of our side are lined up with the labelled ones by order and skill, with the cheapest edit script. Time plays no part.
- A labelled touch is **found** when it lines up with a touch of the same skill. A touch of the model is **false** when it is not found.
- A rally is **fully right** when the two lists are the same.
