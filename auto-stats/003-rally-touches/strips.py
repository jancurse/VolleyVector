"""Frame strips of rallies whose touch list differs from the labels, to check them by eye.

Usage: strips.py SETTINGS OUT_DIR [--limit N] [--longest SECONDS] [--fps N] [--match TEXT]
    SETTINGS    a folder name under cache/gemini/touches/
    --limit     write at most N strips, spread evenly over the clips (default 20)
    --longest   skip rallies longer than this, to keep the pages few (default 6)
    --fps       frames per second in a strip (default 3)
    --match     only clips whose name holds this text
Writes <clip>_r<rally>_<page>.jpg: frames from 1 s before the serve to 2 s after the end, cropped to the court, 12 to a
page, each stamped with its clip time in tenths of a second.
Prints for each the labelled touches with their times (moved by the clip's label shift) and the model's touches of both sides.
"""

import json
import os
import subprocess
import sys

import report

t = report.t


# The part of the picture that holds the court, per match, as fractions (width, height, left, top).
CROPS = {
    "2025-11-09-f6-llamas-vs-onyx": (1.0, 0.4, 0.0, 0.35),
    "2025-11-qkx-vs-f6-llamas": (1.0, 0.45, 0.0, 0.28),
    "2026-10-30-onyx-vs-f6-pirates": (1.0, 0.47, 0.0, 0.18),
    "2026-11-07-f6-llamas-vs-bg-lions": (1.0, 0.45, 0.0, 0.25),
    "2026-11-08-r1vals-vs-f6-pirates": (0.8, 0.42, 0.12, 0.24),
}


def strip(video, start, length, out, match, fps):
    """Pages of 12 frames, cropped to the court. out is a pattern with %d for the page number."""
    turn = "transpose=1," if "llamas-vs-onyx" in match else ""
    w, h, x, y = CROPS[match]
    stamp = f"drawtext=text='%{{eif\\:(t+{start})*10\\:d}}':x=4:y=4:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6"
    chain = f"fps={fps},{turn}crop=iw*{w}:ih*{h}:iw*{x}:ih*{y},scale=660:-2,{stamp},tile=3x4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", f"{length:.2f}", "-i", video, "-vf", chain, "-q:v", "3", out], check=True)


if __name__ == "__main__":
    run, out = sys.argv[1], sys.argv[2]
    opt = lambda name, default: float(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default
    limit, longest, fps = int(opt("--limit", 20)), opt("--longest", 6), opt("--fps", 3)
    only = sys.argv[sys.argv.index("--match") + 1] if "--match" in sys.argv else ""
    os.makedirs(out, exist_ok=True)
    items = []
    for name, _, set_file, video in t.gemini.clips():
        path = os.path.join(t.OUT, run, name + ".json")
        if not os.path.exists(path) or only not in name:
            continue
        det = json.load(open(path))
        shift = report.label_shift(set_file, [r["serve"] for r in det["rallies"] if r["serve"] is not None])
        truth = {r["index"]: r for r in report.labels(set_file, shift)}
        for w in report.score(set_file, det)[3]:
            if w["end"] is not None and w["end"] - w["serve"] <= longest:
                items.append((name, video, w, truth[w["rally"]]))
    print(f"{len(items)} differing rallies of at most {longest:g} s")
    step = max(1, len(items) // limit)
    for name, video, w, lab in items[step // 2 :: step][:limit]:
        start = max(0, w["serve"] - 1)
        strip(video, start, w["end"] + 2 - start, os.path.join(out, f"{name}_r{w['rally']:02d}_%d.jpg"), name.split("__")[0], fps)
        print(f"\n{name} rally {w['rally']} ({lab['serving']} serve), strip from {start:.0f} s, stamps in tenths of a second")
        print("  labels: " + ", ".join(f"{e['timestamp']:.1f} {e['stat']}" for e in lab["touches"]))
        print("  model:  " + ", ".join(f"{x['t']:.1f} {x['side']} {x['skill']}" for x in w["all"] if x["t"] is not None))
