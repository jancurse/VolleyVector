"""Print how far detections lie from the labelled serves and rally ends, to tell a timing error from a miss.

Usage: offsets.py DETECTIONS.json ...   (files named <clip>.<anything>.json or <clip>.json, as the test scripts write them)
"""

import json
import os
import sys

import numpy as np

import common

if __name__ == "__main__":
    sets = {name: set_file for name, _, set_file, _ in common.clips()}
    for path in sys.argv[1:]:
        name = os.path.basename(path).split(".")[0]
        det = json.load(open(path))
        serves, ends = common.scorer.truth(sets[name])
        print(name)
        for label, truth, found in (
            ("exact serves", [s["t"] for s in serves if s["kind"] == "exact"], det.get("serves", [])),
            ("their serves (first touch)", [s["t"] + 1.2 for s in serves if s["kind"] == "approx"], det.get("serves", [])),
            ("rally ends", [e["t"] for e in ends if e["kind"] == "tight"], det.get("rally_ends", [])),
        ):
            if not truth or not found:
                continue
            off = np.array([min(found, key=lambda d: abs(d - t)) - t for t in truth])
            within = [f"±{w}s {100 * np.mean(np.abs(off) <= w):.0f}%" for w in (1, 2, 3, 5)]
            print(f"  {label}: nearest detection, median offset {np.median(off):+.1f} s, {', '.join(within)}")
