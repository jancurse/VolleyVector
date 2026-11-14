"""Serves from the referee's whistle: the serve follows the whistle that allows it.

whistle+offset  serve = whistle + 2.8 s
whistle+hit     serve = the loudest sudden sound 0.8 to 7 s after the whistle (the serve contact), else whistle + 2.8 s
A whistle followed by another within 6 s is taken as the end of the previous rally and gives no serve.
Rally ends: a whistle that follows a serve by more than 2 s and comes before the next serve whistle.
"""

import os

import numpy as np

import common

HOP = 0.02


def whistles(w, thr=33.0, min_frames=6, bridge=10):
    """Start times of stretches where the whistle score stays above thr for at least min_frames."""
    on, out, i = w > thr, [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and on[j : j + bridge].any():
                j += 1
            if on[i:j].sum() >= min_frames:
                out.append(i * HOP)
            i = j
        else:
            i += 1

    return np.array(out)


def detect(name, mode):
    a = np.load(os.path.join(common.CACHE, "feat", name + ".audio.npz"))
    ws = whistles(a["whistle"])
    serves, ends = [], []
    for k, w in enumerate(ws):
        if k + 1 < len(ws) and ws[k + 1] - w < 6:
            ends.append(w)
            continue
        t = w + 2.8
        if mode == "hit":
            lo, hi = int((w + 0.8) / HOP), int((w + 7) / HOP)
            seg = a["onset"][lo:hi]
            if len(seg) and seg.max() > 12:
                t = (lo + int(np.argmax(seg > 0.6 * seg.max()))) * HOP
        serves.append(t)

    return serves, ends


if __name__ == "__main__":
    for mode in ("offset", "hit"):
        common.report(f"whistle+{mode}", {name: detect(name, mode) for name, *_ in common.clips()})
