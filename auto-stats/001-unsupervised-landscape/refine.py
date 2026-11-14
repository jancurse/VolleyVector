"""Second stage: move each coarse serve detection to the best local cue near it, and each rally end by a fixed shift.

Usage: refine.py MODE DETECTIONS.json ...    MODE is audio (quiet, then a hit), motion (stillness, then movement), both,
or none (only score the files as they are)
A coarse detector that sees one frame per second reports a serve late, so the search runs from 4 s before to 1.5 s after.
"""

import json
import os
import sys

import numpy as np
from scipy.ndimage import uniform_filter1d

import common
from signal_fusion import A, M, load, serve_score


def motion_rise(motion):
    smooth = uniform_filter1d(motion, 5)
    after = np.roll(uniform_filter1d(smooth, 15), -8)
    before = np.roll(uniform_filter1d(smooth, 15), 8)

    return np.clip(after - before, -1, 1) - before


def refine(name, serves, mode, lo=4.0, hi=1.5):
    if mode == "none":
        return list(serves)
    a, motion = load(name)
    audio_score, hit = serve_score(a, motion, ["quiet", "hit"])
    audio_score = np.where(hit > 3, audio_score, audio_score - 2)
    rise = motion_rise(motion)
    out = []
    for d in serves:
        ta = np.arange(max(0, int((d - lo) * A)), min(len(audio_score), int((d + hi) * A)))
        if len(ta) == 0:
            continue
        score = np.zeros(len(ta))
        if mode in ("audio", "both"):
            score += audio_score[ta]
        if mode in ("motion", "both"):
            score += np.interp(ta / A, np.arange(len(rise)) / M, rise)
        out.append(ta[int(np.argmax(score))] / A)

    return out


if __name__ == "__main__":
    mode, paths = sys.argv[1], sys.argv[2:]
    for label in ("coarse", f"refined by {mode}"):
        det = {}
        for path in paths:
            name = os.path.basename(path).split(".")[0]
            d = json.load(open(path))
            det[name] = (d["serves"], d["rally_ends"]) if label == "coarse" else (refine(name, d["serves"], mode), d["rally_ends"])
        common.report(label, det, verbose=True)
