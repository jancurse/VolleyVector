"""Compare two sets of detection files serve by serve: two models, or two runs of one model.

Usage: compare.py DIR_A DIR_B [--list]
    DIR_A, DIR_B   folders holding <clip>.json detection files, e.g. cache/gemini/runs/<settings> or task 001's
                   cache/rallies/opus
    --list         also print every serve only one side reports
A serve of A and one of B are the same serve when they lie within 4 s of each other (one to one, nearest first).
Each group is then split by the labels: near a labelled serve (within 5 s of a timed one), in an unscored gap (a rally
whose serve the labels do not time), or neither. 5 s and not the scorer's 3 s, so a label that sits late does not hide
an agreement.
"""

import json
import os
import sys

import gemini

PAIR, NEAR = 4.0, 5.0


def pair(a, b):
    """Return (pairs, only_a, only_b) for two lists of times."""
    cand = sorted((abs(x - y), i, j) for i, x in enumerate(a) for j, y in enumerate(b) if abs(x - y) <= PAIR)
    used_a, used_b, pairs = set(), set(), []
    for _, i, j in cand:
        if i not in used_a and j not in used_b:
            used_a.add(i)
            used_b.add(j)
            pairs.append((a[i], b[j]))

    return sorted(pairs), [x for i, x in enumerate(a) if i not in used_a], [y for j, y in enumerate(b) if j not in used_b]


def kind(t, truth):
    if any(s["t"] is not None and abs(t - s["t"]) <= NEAR for s in truth):
        return "labelled"

    return "unscored" if any(s["t"] is None and s["lo"] <= t <= s["hi"] for s in truth) else "neither"


if __name__ == "__main__":
    dir_a, dir_b = sys.argv[1], sys.argv[2]
    total = {g: {"labelled": 0, "unscored": 0, "neither": 0} for g in ("both", "only A", "only B")}
    missed_by_both = labelled = 0
    for name, _, set_file, _ in gemini.clips():
        files = [os.path.join(d, name + ".json") for d in (dir_a, dir_b)]
        if not all(os.path.exists(f) for f in files):
            continue
        a, b = (json.load(open(f))["serves"] for f in files)
        truth, _ = gemini.scorer.truth(set_file)
        pairs, only_a, only_b = pair(a, b)
        for group, times in (("both", [x for x, _ in pairs]), ("only A", only_a), ("only B", only_b)):
            for t in times:
                total[group][kind(t, truth)] += 1
        timed = [s["t"] for s in truth if s["t"] is not None]
        labelled += len(timed)
        missed_by_both += sum(all(abs(t - d) > NEAR for d in a + b) for t in timed)
        offsets = sorted(x - y for x, y in pairs)
        median = offsets[len(offsets) // 2] if offsets else 0
        print(f"{name}: A {len(a)}, B {len(b)}, both {len(pairs)}, only A {len(only_a)}, only B {len(only_b)}, A minus B median {median:+.1f} s")
        if "--list" in sys.argv:
            for label, times in (("only A", only_a), ("only B", only_b)):
                for t in times:
                    print(f"    {label} {t:7.1f}  {kind(t, truth)}")
    print(f"A = {dir_a}\nB = {dir_b}")
    for group, kinds in total.items():
        print(f"{group}: {sum(kinds.values())} ({kinds['labelled']} near a labelled serve, {kinds['unscored']} in an unscored gap, {kinds['neither']} neither)")
    print(f"labelled serves with no detection of either within {NEAR:g} s: {missed_by_both} of {labelled}")
