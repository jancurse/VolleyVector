"""Serves from tracked people (pose_features.py): everyone stands still before a serve, then play starts.

speed  the 75th percentile of the tracked people's speed (box centre, in body heights per frame), over the clip's median
A serve is placed where the speed first rises above RISE after staying below STILL for at least 1.5 s.
"""

import os

import numpy as np
import pandas as pd
from scipy.ndimage import uniform_filter1d

import common

STILL, RISE = 0.7, 1.6


def speed(name):
    d = np.load(os.path.join(common.CACHE, "feat", name + ".pose.npz"))
    order = np.lexsort((d["frame"], d["id"]))
    frame, ids, box = d["frame"][order], d["id"][order], d["box"][order]
    same = (ids[1:] == ids[:-1]) & (frame[1:] - frame[:-1] == 1) & (ids[1:] >= 0)
    step = np.linalg.norm(box[1:, :2] - box[:-1, :2], axis=1) / np.maximum(box[1:, 3], 1e-3)
    q = pd.Series(step[same]).groupby(frame[1:][same]).quantile(0.75).reindex(range(frame.max() + 1)).interpolate().fillna(0).values
    q = uniform_filter1d(q, 5)

    return q / (np.median(q) + 1e-9)


def detect(name):
    v = speed(name)
    serves, still_since = [], None
    for i, x in enumerate(v):
        if x < STILL:
            still_since = i if still_since is None else still_since
        elif x > RISE:
            if still_since is not None and i - still_since >= 15 and (not serves or i / 10 - serves[-1] > 6):
                serves.append(i / 10 - 0.5)
            still_since = None

    return serves, []


if __name__ == "__main__":
    done = [name for name, *_ in common.clips() if os.path.exists(os.path.join(common.CACHE, "feat", name + ".pose.npz"))]
    common.report("pose: still, then moving", {name: detect(name) for name in done}, verbose=True)
