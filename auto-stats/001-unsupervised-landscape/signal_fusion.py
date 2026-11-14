"""Serves and rally ends from hand-made audio and motion cues, with one fixed set of thresholds for every clip.

Serve: a sudden sound (the contact) after about a second of quiet and stillness, more likely a few seconds after a whistle.
Rally end: the cheer, a rise in loudness after a rally, placed 1.5 s before the rise.
Run with a list of cue names to switch them on: quiet hit still whistle (default: all).
"""

import os
import sys

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d

import common
from audio_whistle import whistles

A, M = 50, 10  # audio and motion frames per second


def load(name):
    a = np.load(os.path.join(common.CACHE, "feat", name + ".audio.npz"))
    m = np.load(os.path.join(common.CACHE, "feat", name + ".motion.npz"))["moving"]

    return a, m / (np.median(m) + 1e-9)


def before(x, rate, lo, hi):
    """Mean of x over the window [t - lo, t - hi] for every t."""
    n = int((lo - hi) * rate)

    return np.roll(uniform_filter1d(x, n, mode="nearest"), int((lo + hi) / 2 * rate))


def serve_score(a, motion, cues):
    loud, onset = a["loud"], a["onset"]
    n = len(loud)
    quiet = np.median(loud) - before(loud, A, 1.3, 0.15)
    hit = (onset - np.median(onset)) / (1.4826 * np.median(np.abs(onset - np.median(onset))) + 1e-9)
    still = 1 - np.interp(np.arange(n) / A, np.arange(len(motion)) / M, before(motion, M, 2.0, 0.0))
    ws = whistles(a["whistle"])
    whistle = np.zeros(n)
    for w in ws:
        whistle[int((w + 1) * A) : int((w + 6) * A)] = 1
    score = np.zeros(n)
    if "quiet" in cues:
        score += np.clip(quiet / 6, -1, 2)
    if "hit" in cues:
        score += np.clip(hit / 8, 0, 1.5)
    if "still" in cues:
        score += np.clip(still, -1, 1) * 1.5
    if "whistle" in cues:
        score += whistle

    return score, hit


def pick(score, rate, threshold, spacing):
    """Peaks above threshold, strongest first, at least spacing seconds apart."""
    peaks = np.flatnonzero((score == maximum_filter1d(score, int(rate))) & (score > threshold))
    chosen = []
    for p in peaks[np.argsort(-score[peaks])]:
        if all(abs(p - c) > spacing * rate for c in chosen):
            chosen.append(p)

    return sorted(c / rate for c in chosen)


def detect(name, cues, threshold):
    a, motion = load(name)
    score, hit = serve_score(a, motion, cues)
    serves = pick(np.where(hit > 4, score, -9), A, threshold, 7)
    loud = uniform_filter1d(a["loud"], A)
    rise = np.roll(loud, -int(1.5 * A)) - np.roll(loud, int(1.0 * A))
    ends = [t for t in pick(rise, A, 9, 6)]

    return serves, [t + 0.5 for t in ends]


if __name__ == "__main__":
    cues = sys.argv[1:] or ["quiet", "hit", "still", "whistle"]
    for threshold in (2.0, 2.5, 3.0, 3.5):
        threshold *= len(cues) / 4
        common.report(f"fusion {'+'.join(cues)} > {threshold:.2f}", {name: detect(name, cues, threshold) for name, *_ in common.clips()})
