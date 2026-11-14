"""Zero-shot SigLIP on single frames (clip_embed.py): does "rally in play" beat "between points", frame by frame?

Prints, per clip, how well the prompt difference separates frames inside a labelled rally from the rest (AUC, 0.5 is
chance), then scores serves placed where the smoothed difference rises above the clip's median and rally ends where it falls.
"""

import os

import numpy as np
from scipy.ndimage import uniform_filter1d

import common


def auc(score, positive):
    rank = np.empty(len(score))
    rank[np.argsort(score)] = np.arange(len(score))
    n1 = positive.sum()

    return (rank[positive].sum() - n1 * (n1 - 1) / 2) / (n1 * (len(score) - n1))


if __name__ == "__main__":
    det, aucs = {}, []
    for name, _, set_file, _ in common.clips():
        d = np.load(os.path.join(common.CACHE, "feat", name + ".clip.npz"))
        sim = d["emb"] @ d["text"].T
        live = uniform_filter1d(sim[:, 1] - sim[:, 3], 5)
        aucs.append(auc(live, common.in_rally(set_file, d["t"])))
        on = live > np.median(live) + 0.5 * live.std()
        edges = np.flatnonzero(np.diff(on.astype(int)))
        det[name] = ([d["t"][i] for i in edges if on[i + 1]], [d["t"][i] for i in edges if not on[i + 1]])
    print("AUC rally vs not, per clip:", np.round(aucs, 2), "mean", round(float(np.mean(aucs)), 2))
    common.report("SigLIP zero-shot, rising edge", det)
