"""Shared helpers for the task 001 test scripts: the clip list, cache paths, and scoring a method over every clip."""

import collections
import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import score as scorer  # noqa: E402

CLIPS = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "clips"))
CACHE = os.path.join(ROOT, "cache")


def clips():
    """Yield (name, match, set file, clip video) for every labelled clip."""
    for set_file in sorted(glob.glob(os.path.join(CLIPS, "*", "set*.json"))):
        match = os.path.basename(os.path.dirname(set_file))
        name = f"{match}__{os.path.basename(set_file)[:-5]}"
        yield name, match, set_file, set_file[:-5] + ".mp4"


def proxy(name):
    return os.path.join(CACHE, "proxy", name + ".mp4")


def audio(name):
    return os.path.join(CACHE, "audio", name + ".wav")


def label_shift(set_file, serves):
    """The constant by which this clip's serve labels sit off the detections: the median offset of the nearest ones."""
    import numpy as np

    truth, _ = scorer.truth(set_file)
    off = [min(serves, key=lambda d: abs(d - s["t"])) - s["t"] for s in truth if s["t"] is not None and serves]
    off = [o for o in off if abs(o) < 4]

    return float(np.median(off)) if off else 0.0


def report(title, detections, verbose=False):
    """Print per-match and overall scores. detections maps clip name to (serves, rally_ends).

    Readings: the agreed +-3 s, then +-1 s, +-2 s, and +-1 s after moving each clip's labels by one constant.
    """
    print(f"== {title}")
    for reading in ("±3 s", "±1 s", "±2 s", "±1 s, labels shifted per clip"):
        by_match = collections.defaultdict(list)
        for name, match, set_file, _ in clips():
            if name in detections:
                serves, ends = detections[name]
                shift = label_shift(set_file, serves) if "shifted" in reading else 0.0
                row = scorer.score(set_file, serves, ends, tolerance=float(reading[1]) if "shifted" not in reading else 1.0, shift=shift)
                by_match[match].append(row)
                if verbose and "shifted" in reading:
                    print(f"    {name}: label shift {shift:+.1f} s")
        if reading == "±3 s":
            for match, rows in by_match.items():
                print(f"  {match}: {scorer.summary(scorer.total(rows))}")
            first = scorer.total([r for rs in by_match.values() for r in rs])
        print(f"  ALL ({reading}): {scorer.summary(scorer.total([r for rs in by_match.values() for r in rs]))}")

    return first


def frames(name, fps=2.0):
    """Yield (seconds, upright BGR frame) from the proxy at about the given rate."""
    import cv2

    cap = cv2.VideoCapture(proxy(name))
    step, i = round(10 / fps), 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % step == 0:
            # The portrait match was filmed with the phone on its side: the picture is stored turned by 90 degrees.
            yield i / 10, cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE) if "llamas-vs-onyx" in name else frame
        i += 1


def in_rally(set_file, times):
    """True for each time that lies between a rally's serve and its last event, as far as the labels tell."""
    import numpy as np

    serves, ends = scorer.truth(set_file)
    live = np.zeros(len(times), bool)
    for s, e in zip(serves, ends):
        if s["t"] is not None and e["t"] is not None:
            live |= (times >= s["t"]) & (times <= e["t"] + 1)

    return live
