"""Serves from the tagger's whistles, timed by the players: all local, sound and picture together.

For every whistle that allows a serve (tagger_whistle.py), the serve is where the tracked people start moving after
standing still (pose_serves.py), searched from 0.5 to 8 s after the whistle. Without such a moment it is whistle + 2.6 s.
"""

import os

import numpy as np

import common
from pose_serves import RISE, STILL, speed
from tagger_whistle import OFFSET, whistle_times


def detect(name):
    v, ws = speed(name), whistle_times(name)
    serves = []
    for k, w in enumerate(ws):
        if k + 1 < len(ws) and ws[k + 1] - w < 6:
            continue
        lo, hi = int((w + 0.5) * 10), min(len(v), int((w + 8) * 10))
        seg = v[lo:hi]
        still = np.flatnonzero(seg < STILL)
        rise = np.flatnonzero(seg > RISE)
        rise = rise[rise > still[0]] if len(still) else rise[:0]
        serves.append((lo + rise[0]) / 10 - 0.5 if len(rise) else w + OFFSET)

    return serves, []


if __name__ == "__main__":
    feat = os.path.join(common.CACHE, "feat")
    done = [name for name, *_ in common.clips() if all(os.path.exists(os.path.join(feat, f"{name}.{k}.npz")) for k in ("ast", "pose"))]
    common.report("tagger whistle, timed by pose", {name: detect(name) for name in done}, verbose=True)
