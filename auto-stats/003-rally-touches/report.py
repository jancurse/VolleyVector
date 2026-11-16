"""Score the cached runs of touches.py against the set files.

Usage: report.py [--clips set1|all|NAME] [--skills] [--rallies] [--times] [--noshift] [SETTINGS ...]
    SETTINGS   folder names under cache/gemini/touches/ (default: all of them)
    --clips    score only set 1 of each match, one clip by name, or every clip a run holds (default)
    --skills   also print the table per skill and the table of mistaken skills
    --rallies  also print every paired rally whose touch list differs from the labels
    --times    also print how many touches match a label by time alone, see near()
    --noshift  pair against the labels as they are. By default each clip's labels are first moved by one constant, the
               median offset between the detected serves and the labelled ones, since some clips' labels sit 2 s off

Rallies are paired by serve time with ../score.py's windows at ±3 s. Inside a paired rally the model's touches of our side
are lined up with the labelled ones by order and skill (the cheapest edit script), never by time:
    found    a labelled touch lined up with a touch of the same skill
    mistaken lined up with a touch of another skill
    missed   no touch lined up with it
    false    a touch of the model that is not found: mistaken, or lined up with nothing
"""

import collections
import json
import os
import sys

import touches as t

gemini = t.gemini
SKILLS = t.SKILLS


def label_shift(set_file, serves):
    """The constant by which a clip's serve labels sit off the detections: the median offset of the nearest ones."""
    truth, _ = gemini.scorer.truth(set_file)
    off = sorted(o for o in (min(serves, key=lambda d: abs(d - s["t"])) - s["t"] for s in truth if s["t"] is not None and serves) if abs(o) < 6)

    return off[len(off) // 2] if off else 0.0


def labels(set_file, shift=0.0):
    """One dict per labelled rally: its serve window from score.py, who serves, and our touches in time order."""
    data = json.load(open(set_file))
    for event in data["events"]:
        event["timestamp"] += shift
    windows, _ = gemini.scorer.truth(set_file, shift=shift)
    own = sorted((e for e in data["events"] if e["kind"] == "touch"), key=lambda e: e["timestamp"])
    out, cursor = [], 0
    for rally, window in zip(data["rallies"], windows):
        mine = [e for e in own[cursor : cursor + rally["touches"]] if e["stat"] in SKILLS]
        cursor += rally["touches"]
        out.append({**window, "index": rally["index"], "serving": rally["serving"], "score": (rally["scoreUs"], rally["scoreThem"]), "touches": mine})

    return out


def pair(truth, serves):
    """score.py's greedy matching, returning {detected rally: labelled rally}."""
    used, pairs = set(), {}
    order = sorted(range(len(truth)), key=lambda i: truth[i]["t"] is None)
    for d in sorted(range(len(serves)), key=lambda i: serves[i]):
        hit = next((i for i in order if i not in used and truth[i]["lo"] <= serves[d] <= truth[i]["hi"]), None)
        if hit is not None:
            used.add(hit)
            pairs[d] = hit

    return pairs


def align(want, got):
    """The cheapest edit script from want to got. Returns pairs (i or None, j or None)."""
    n, m = len(want), len(got)
    cost = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        cost[i][0] = i
    for j in range(m + 1):
        cost[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost[i][j] = min(cost[i - 1][j - 1] + (want[i - 1] != got[j - 1]), cost[i - 1][j] + 1, cost[i][j - 1] + 1)
    out, i, j = [], n, m
    while i or j:
        if i and j and cost[i][j] == cost[i - 1][j - 1] + (want[i - 1] != got[j - 1]):
            out.append((i - 1, j - 1))
            i, j = i - 1, j - 1
        elif i and cost[i][j] == cost[i - 1][j] + 1:
            out.append((i - 1, None))
            i -= 1
        else:
            out.append((None, j - 1))
            j -= 1

    return out[::-1]


def score(set_file, det, shifted=True):
    """Counts for one clip, and the list of paired rallies that differ."""
    rallies = [r for r in det["rallies"] if r["serve"] is not None]
    truth = labels(set_file, label_shift(set_file, [r["serve"] for r in rallies]) if shifted else 0.0)
    pairs = pair(truth, [r["serve"] for r in rallies])
    c = collections.Counter(rallies=len(truth), detected=len(rallies), paired=len(pairs), labelled=sum(len(r["touches"]) for r in truth))
    confusion, per_skill, wrong = collections.Counter(), collections.Counter(), []
    for d, i in sorted(pairs.items(), key=lambda p: p[1]):
        want = [e["stat"] for e in truth[i]["touches"]]
        ours = [x for x in rallies[d]["touches"] if x["side"] == "us"]
        got = [x["skill"] for x in ours]
        c["serving_right"] += rallies[d]["serving"] == truth[i]["serving"]
        c["labelled_paired"] += len(want)
        c["reported"] += len(got)
        c["exact"] += want == got
        c["same_count"] += len(want) == len(got)
        for a, b in align(want, got):
            confusion[(want[a] if a is not None else "–", got[b] if b is not None else "–")] += 1
            if a is not None:
                per_skill[(want[a], "labelled")] += 1
            if b is not None:
                per_skill[(got[b], "reported")] += 1
            if a is not None and b is not None and want[a] == got[b]:
                c["found"] += 1
                per_skill[(want[a], "found")] += 1
                when = ours[b]["t"]
                c["timed"] += when is not None
                c["in_time"] += when is not None and abs(when - truth[i]["touches"][a]["timestamp"]) <= 3
        if want != got:
            wrong.append({"rally": truth[i]["index"], "serve": rallies[d]["serve"], "end": rallies[d]["end"], "want": want, "got": got, "all": rallies[d]["touches"]})
    c["unpaired_reported"] = sum(sum(x["side"] == "us" for x in r["touches"]) for d, r in enumerate(rallies) if d not in pairs)
    serving = [r["serving"] for r in sorted(rallies, key=lambda r: r["serve"])]
    last = truth[-2]["score"] if len(truth) > 1 else (0, 0)
    points = (serving[1:].count("us"), serving[1:].count("them"))
    c["score_right"] = points == last

    return c, confusion, per_skill, wrong, f"{points[0]}–{points[1]} (labels {last[0]}–{last[1]})"


def near(set_file, det, within, side="us"):
    """Match touches to labels by time alone, each to at most one, nearest first, over the whole clip.

    Returns (labelled, reported, matched, matched with the same skill, the offsets in seconds).
    side "us" takes the touches the model gives to our side, None takes those of both sides.
    """
    rallies = [r for r in det["rallies"] if r["serve"] is not None]
    want = [e for r in labels(set_file, label_shift(set_file, [r["serve"] for r in rallies])) for e in r["touches"]]
    got = [x for r in det["rallies"] for x in r["touches"] if x["t"] is not None and side in (None, x["side"])]
    gaps = sorted((abs(x["t"] - e["timestamp"]), i, j) for i, e in enumerate(want) for j, x in enumerate(got) if abs(x["t"] - e["timestamp"]) <= within)
    used_i, used_j, same, off = set(), set(), 0, []
    for gap, i, j in gaps:
        if i not in used_i and j not in used_j:
            used_i.add(i)
            used_j.add(j)
            same += want[i]["stat"] == got[j]["skill"]
            off.append(gap)

    return len(want), len(got), len(off), same, off


def share(a, b):
    return f"{100 * a / b:.0f}%" if b else "–"


def line(c):
    return (
        f"{c['paired']}/{c['rallies']} | {share(c['serving_right'], c['paired'])} | {share(c['found'], c['labelled_paired'])} "
        f"({share(c['found'], c['labelled'])}) | {share(c['reported'] - c['found'], c['reported'])} | {share(c['exact'], c['paired'])} | "
        f"{share(c['same_count'], c['paired'])} | {share(c['in_time'], c['timed'])}"
    )


if __name__ == "__main__":
    args = sys.argv[1:]
    which = args[args.index("--clips") + 1] if "--clips" in args else "all"
    runs = [a for a in args if not a.startswith("--") and a != which] or sorted(os.listdir(t.OUT))
    sets = {c[0]: c[2] for c in gemini.clips()}
    print("run | clips | rallies paired | serving side right | touches found, in paired rallies (in all) | touches false | rallies fully right | same number of touches | found touches within 3 s | scores right | $ per set")
    for run in runs:
        total, confusion, per_skill, rows = collections.Counter(), collections.Counter(), collections.Counter(), []
        for name, set_file in sets.items():
            path = os.path.join(t.OUT, run, name + ".json")
            if not os.path.exists(path) or (which == "set1" and not name.endswith("set1")) or (which not in ("all", "set1") and which != name):
                continue
            det = json.load(open(path))
            c, conf, skills, wrong, points = score(set_file, det, "--noshift" not in args)
            total.update(c)
            confusion.update(conf)
            per_skill.update(skills)
            rows.append((name, c, det, wrong, points))
        if not rows:
            continue
        n = len(rows)
        print(f"{run} | {n} | {line(total)} | {total['score_right']}/{n} | {sum(r[2]['cost_usd'] for r in rows) / n:.2f}")
        if len(rows) > 1:
            for name, c, det, _, points in rows:
                print(f"    {name} | {line(c)} | score {points} | ${det['cost_usd']:.2f}, thought {det['usage']['thought'] // 1000}k")
        else:
            print(f"    score {rows[0][4]}, touches in unpaired rallies {total['unpaired_reported']}, tokens {rows[0][2]['usage']}")
        if "--skills" in args:
            print("    skill | labelled | found | reported | false")
            for s in SKILLS:
                lab, found, rep = per_skill[(s, "labelled")], per_skill[(s, "found")], per_skill[(s, "reported")]
                print(f"    {s} | {lab} | {share(found, lab)} | {rep} | {share(rep - found, rep)}")
            print("    labelled (rows) against reported (columns) | " + " | ".join(SKILLS + ["–"]))
            for a in SKILLS + ["–"]:
                print(f"    {a} | " + " | ".join(str(confusion[(a, b)]) for b in SKILLS + ["–"]))
        if "--times" in args:
            print("    side | within | labelled touches with a touch nearby | of those, same skill | reported touches with no label nearby | median offset")
            for side in ("us", None):
                for within in (1.0, 1.5, 2.0):
                    parts = [near(sets[name], det, within, side) for name, _, det, _, _ in rows]
                    lab, rep, hit, same = (sum(p[k] for p in parts) for k in range(4))
                    off = sorted(o for p in parts for o in p[4])
                    print(f"    {side or 'either'} | {within:g} s | {share(hit, lab)} | {share(same, hit)} | {share(rep - hit, rep)} | {off[len(off) // 2]:.2f} s")
        if "--rallies" in args:
            for name, _, _, wrong, _ in rows:
                for w in wrong:
                    print(f"    {name} rally {w['rally']} at {w['serve']:.0f} s: labels {' '.join(w['want']) or '(none)'} | model {' '.join(w['got']) or '(none)'}")
