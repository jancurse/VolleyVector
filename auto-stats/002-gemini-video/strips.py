"""Frame strips around a run's false and missed serves, to check them by eye. Cut straight from the clips with ffmpeg.

Usage: strips.py RUN_DIR OUT_DIR [--limit N]
    RUN_DIR   a folder of <clip>.json detection files, e.g. cache/gemini/runs/<settings>
    --limit   write at most N strips of each kind, spread evenly over the clips (default 20)
Writes one image per time: frames from 4 s before to 3 s after, one per second, each stamped with its clip second.
A false serve is named false_<clip>_<second>.jpg and a missed labelled serve missed_<clip>_<second>.jpg.
Prints each with its distance to the nearest labelled serve or the nearest detection, and where it falls in the labels.
"""

import json
import os
import subprocess
import sys

import gemini


def strip(video, t, out, sideways):
    start = max(0, int(t) - 4)
    turn = "transpose=1," if sideways else ""
    stamp = f"drawtext=text='%{{eif\\:t+{start}\\:d}}':x=6:y=6:fontsize=28:fontcolor=yellow:box=1:boxcolor=black@0.6"
    chain = f"fps=1,{turn}scale=480:270,{stamp},tile=4x2"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", "8", "-i", video, "-vf", chain, "-frames:v", "1", "-q:v", "4", out], check=True)


def spread(items, limit):
    """At most limit items, taken evenly across the list."""
    return items if len(items) <= limit else [items[round(i * (len(items) - 1) / (limit - 1))] for i in range(limit)]


if __name__ == "__main__":
    run, out = sys.argv[1], sys.argv[2]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 20
    os.makedirs(out, exist_ok=True)
    false, missed = [], []
    for name, _, set_file, video in gemini.clips():
        path = os.path.join(run, name + ".json")
        if not os.path.exists(path):
            continue
        det = json.load(open(path))
        row = gemini.scorer.score(set_file, det["serves"], det["rally_ends"])
        serves, ends = gemini.scorer.truth(set_file)
        serve_t = [s["t"] for s in serves if s["t"] is not None]
        spans = [(s["t"], e["t"]) for s, e in zip(serves, ends) if s["t"] is not None and e["t"] is not None]
        for t in row["serve_false_times"]:
            nearest = min(serve_t, key=lambda s: abs(s - t))
            where = "inside a labelled rally" if any(a + 3 < t <= b for a, b in spans) else "between rallies"
            false.append((name, video, t, f"nearest labelled serve {nearest - t:+6.1f} s, {where}"))
        for t in row["serve_missed_times"]:
            nearest = min(det["serves"], key=lambda d: abs(d - t))
            missed.append((name, video, t, f"nearest detection {nearest - t:+6.1f} s"))
    print(f"{len(false)} false serves, {len(missed)} missed serves")
    for label, items in (("false", false), ("missed", missed)):
        for name, video, t, note in spread(items, limit):
            short = name.replace("__", "_")
            strip(video, t, os.path.join(out, f"{label}_{short}_{int(t):04d}.jpg"), "llamas-vs-onyx" in name)
            print(f"{label:6} {short} {t:6.0f}  {note}")
