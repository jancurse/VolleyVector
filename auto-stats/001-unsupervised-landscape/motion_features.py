"""Motion features per clip from the 10 fps proxy, cached in cache/feat/<clip>.motion.npz.

moving  share of pixels that changed between consecutive frames (grey, long side 320)
grid    the same per cell of an 8x8 grid, to tell where the motion is
"""

import os

import cv2
import numpy as np

import common


def features(path):
    cap = cv2.VideoCapture(path)
    prev, moving, grid = None, [], []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        g = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(frame, None, fx=0.5, fy=0.5), cv2.COLOR_BGR2GRAY), (5, 5), 0)
        if prev is not None:
            changed = (cv2.absdiff(g, prev) > 12).astype(np.float32)
            moving.append(changed.mean())
            grid.append(cv2.resize(changed, (8, 8), interpolation=cv2.INTER_AREA).ravel())
        prev = g

    return dict(moving=np.array([0] + moving, np.float32), grid=np.array([np.zeros(64)] + grid, np.float32))


if __name__ == "__main__":
    for name, *_ in common.clips():
        out = os.path.join(common.CACHE, "feat", name + ".motion.npz")
        if not os.path.exists(out):
            np.savez_compressed(out, **features(common.proxy(name)))
            print("done", name)
