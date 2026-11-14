"""Frame strips around each false serve detection of a detection file, to check them by eye.

Usage: false_strips.py DETECTIONS.json OUT_DIR
Writes one image per detection: frames from 4 s before to 3 s after, one per second, the detection's second marked.
Prints each detection with its distance to the nearest labelled serve and the time since the last labelled rally end.
"""

import json
import os
import sys

import cv2
import numpy as np

import common

if __name__ == "__main__":
    path, out = sys.argv[1], sys.argv[2]
    name = os.path.basename(path).split(".")[0]
    set_file = {c[0]: c[2] for c in common.clips()}[name]
    det = json.load(open(path))
    false = common.scorer.score(set_file, det["serves"], det["rally_ends"])["serve_false_times"]
    serves, ends = common.scorer.truth(set_file)
    serve_t, end_t = [s["t"] for s in serves if s["t"]], [e["t"] for e in ends if e["t"]]
    frames = dict(common.frames(name, 1))
    for t in false:
        tiles = []
        for o in range(-4, 4):
            f = cv2.resize(frames.get(float(int(t) + o), np.zeros((360, 640, 3), np.uint8)), (480, 270))
            cv2.putText(f, f"{int(t) + o}", (5, 25), 0, 0.8, (0, 255, 255) if o else (0, 0, 255), 2)
            tiles.append(f)
        cv2.imwrite(os.path.join(out, f"{name[:13]}_{int(t):04d}.jpg"), np.vstack([np.hstack(tiles[:4]), np.hstack(tiles[4:])]), [cv2.IMWRITE_JPEG_QUALITY, 75])
        nearest = min(serve_t, key=lambda s: abs(s - t))
        last_end = max([e for e in end_t if e <= t], default=0)
        print(f"{name[:13]} {t:6.0f}  nearest labelled serve {nearest - t:+6.1f} s  last rally end {t - last_end:5.1f} s ago")
