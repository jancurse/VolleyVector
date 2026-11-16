# Task 002 scripts

Scripts behind [the task's results](../../docs/auto-stats/tasks/002-gemini-video.md). Run them from this folder with the system `python3`: they need only the standard library and `ffmpeg`. Everything they fetch is cached in `../data/cache/gemini/`, beside the data and outside every worktree ([data.md](../../docs/auto-stats/data.md#cache)).

## Setup

- Put `GEMINI_API_KEY=...` in `~/.config/volleyvector/auto-stats.env`. The scripts read it from there and send it only in the `x-goog-api-key` header.
- Every call is paid. `gemini_rallies.py` prints the tokens and the cost of each call, and never repeats a call whose answer is cached.
- Google deletes an uploaded file after 48 hours. `gemini.py` uploads a clip again when its upload is older than 46 hours.

## Scripts

| Script              | What it does                                                                                                       |
|---------------------|--------------------------------------------------------------------------------------------------------------------|
| `gemini.py`         | The key, the clip list, HTTP calls, and uploads through the Files API                                              |
| `gemini_rallies.py` | One call per clip asking for rallies, with the model, resolution, frame rate, sound and processing mode as options |
| `report.py`         | Scores every cached run with [`../score.py`](../score.py), overall and per match, with tokens and cost per set     |
| `compare.py`        | Compares two folders of detection files serve by serve: Gemini against Opus, or two runs                           |
| `strips.py`         | Frame strips around a run's false and missed serves, to check by eye                                               |

## Example

```bash
python3 gemini.py upload 2026-11-08-r1vals-vs-f6-pirates__set1
python3 gemini_rallies.py gemini-4-hydrogen 2026-11-08-r1vals-vs-f6-pirates__set1 --fps 2
python3 report.py --match
```

## The API, as it worked on 2026-11-15

- Calls go to `POST /v1beta/interactions`, with the video part first and the prompt after it.
- The video part takes `"resolution": "low"` or `"high"`, and `"processing": {"type": "static", "fps": 2}` for a custom frame rate.
- Agentic processing is the plain string `"processing": "agentic"`. The object form is rejected.
- There is no switch for sound. `--nosound` uploads a copy of the clip with the sound track removed and the picture untouched.
