"""Score the cached runs of gemini_rallies.py at ±3 s.

Usage: report.py [--match] [--clips set1|all] [SETTINGS ...]
    SETTINGS   folder names under cache/gemini/runs/ (default: all of them)
    --match    also print one row per match for each run
    --clips    score only set 1 of each match, or every clip a run holds (default: every clip)
Prints one row per run: clips, serve detections, serves found and false, rally ends found and false, tokens and cost per set,
and serves found and false after moving each clip's labels by one constant (the median offset of the detections).
"""

import collections
import json
import os
import sys

import gemini

RUNS = os.path.join(gemini.CACHE, "runs")


def load(run, only_set1=False):
    """Return {clip name: detections} for one run."""
    out = {}
    for name, _, _, _ in gemini.clips():
        path = os.path.join(RUNS, run, name + ".json")
        if os.path.exists(path) and (not only_set1 or name.endswith("set1")):
            out[name] = json.load(open(path))

    return out


def label_shift(set_file, serves):
    """The constant by which a clip's serve labels sit off the detections: the median offset of the nearest ones."""
    truth, _ = gemini.scorer.truth(set_file)
    off = sorted(o for o in (min(serves, key=lambda d: abs(d - s["t"])) - s["t"] for s in truth if s["t"] is not None and serves) if abs(o) < 6)

    return off[len(off) // 2] if off else 0.0


def line(rows):
    r = gemini.scorer.total(rows)
    serves, found = r["serves_exact"] + r["serves_approx"], r["serves_exact_found"] + r["serves_approx_found"]
    ends, ends_found = r["ends_tight"] + r["ends_loose"], r["ends_tight_found"] + r["ends_loose_found"]
    share = gemini.scorer.share

    return (
        f"{r['serve_detections']:5d} | {share(found, serves):>4} ({found}/{serves}) | {share(r['serve_false'], r['serve_detections']):>4} "
        f"({r['serve_false']}) | {share(ends_found, ends):>4} | {share(r['end_false'], r['end_detections']):>4} ({r['end_false']})"
    )


def shifted(dets, sets):
    """Serves found and false at ±3 s after moving each clip's labels by its own constant, and the range of those constants."""
    shifts = {n: label_shift(sets[n][1], d["serves"]) for n, d in dets.items()}
    r = gemini.scorer.total([gemini.scorer.score(sets[n][1], d["serves"], d["rally_ends"], shift=shifts[n]) for n, d in dets.items()])
    found, serves = r["serves_exact_found"] + r["serves_approx_found"], r["serves_exact"] + r["serves_approx"]
    share = gemini.scorer.share

    return f"{share(found, serves)} / {share(r['serve_false'], r['serve_detections'])} (shifts {min(shifts.values()):+.1f} to {max(shifts.values()):+.1f} s)"


if __name__ == "__main__":
    args = sys.argv[1:]
    per_match = "--match" in args
    only_set1 = "--clips" in args and args[args.index("--clips") + 1] == "set1"
    runs = [a for a in args if not a.startswith("--") and a not in ("set1", "all")] or sorted(os.listdir(RUNS))
    sets = {c[0]: (c[1], c[2]) for c in gemini.clips()}
    print("run | clips | serve detections | serves found | serves false | ends found | ends false | in / out / thought tokens per set | $ per set | serves found / false with labels shifted per clip")
    for run in runs:
        dets = load(run, only_set1)
        if not dets:
            continue
        by_match = collections.defaultdict(list)
        for name, det in dets.items():
            by_match[sets[name][0]].append(gemini.scorer.score(sets[name][1], det["serves"], det["rally_ends"]))
        n = len(dets)
        tokens = " / ".join(f"{sum(d['usage'][k] + (d['usage']['tool'] if k == 'input' else 0) for d in dets.values()) / n / 1000:.0f}k" for k in ("input", "output", "thought"))
        print(f"{run} | {n} | {line([r for rows in by_match.values() for r in rows])} | {tokens} | {sum(d['cost_usd'] for d in dets.values()) / n:.3f} | {shifted(dets, sets)}")
        if per_match:
            for match, rows in by_match.items():
                print(f"    {match} | {len(rows)} | {line(rows)}")
