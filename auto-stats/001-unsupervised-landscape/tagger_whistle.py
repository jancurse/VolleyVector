"""Serves from whistles found by the pretrained audio tagger (audio_tagger.py), timed by the hand-made whistle score.

The tagger says in which 2 s windows a whistle sounds. The whistle's start inside that window comes from the 50 Hz whistle
score. A serve is placed OFFSET seconds after a whistle that no other whistle follows within 6 s; a whistle that is
followed that soon is taken as the end of the previous rally.
"""

import os

import numpy as np

import common

OFFSET = 2.6


def whistle_times(name, threshold=0.05):
    ast = np.load(os.path.join(common.CACHE, "feat", name + ".ast.npz"))
    fine = np.load(os.path.join(common.CACHE, "feat", name + ".audio.npz"))["whistle"]
    p = ast["prob"][:, list(ast["labels"]).index("Whistle")]
    times, i = [], 0
    while i < len(p):
        if p[i] > threshold:
            j = i
            while j < len(p) and p[j] > threshold:
                j += 1
            lo, hi = int((ast["t"][i] - 1) * 50), int((ast["t"][j - 1] + 1) * 50)
            seg = fine[lo:hi]
            times.append((lo + int(np.argmax(seg > seg.max() - 6))) / 50)
            i = j
        else:
            i += 1

    return times


def detect(name):
    ws = whistle_times(name)
    serves, ends = [], []
    for k, w in enumerate(ws):
        if k + 1 < len(ws) and ws[k + 1] - w < 6:
            ends.append(w)
        else:
            serves.append(w + OFFSET)

    return serves, ends


if __name__ == "__main__":
    done = [name for name, *_ in common.clips() if os.path.exists(os.path.join(common.CACHE, "feat", name + ".ast.npz"))]
    common.report("tagger whistle + offset", {name: detect(name) for name in done}, verbose=True)
