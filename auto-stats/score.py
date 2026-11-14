#!/usr/bin/env python3
"""Score detected serve and rally-end times against a clip's set file.

Usage:
    score.py SET.json DETECTIONS.json [SET.json DETECTIONS.json ...]

DETECTIONS.json holds {"serves": [seconds, ...], "rally_ends": [seconds, ...]}, in clip seconds. Either key may be absent.
With several pairs it prints one row per clip and a total. From Python, call truth() and score().

The set files only hold our own team's touches, so the truth is built per rally (see docs/auto-stats/tasks/001):

Serves
  exact    the rally has a serve touch at time t. Found when a detection lies in [t - 1, t + 1].
  approx   they served and our first touch is a receive at time t. Their serve is 0.5 to 2 s earlier, so it is found
           when a detection lies in [t - 3, t + 0.5].
  unknown  no touch tells when the serve was (a rally without touches, our serve was not recorded, or our first
           touch after their serve is not a receive). One detection
           between the previous rally's last event and this rally's last event is ignored: neither found nor false.
A detection matches at most one serve. Every other detection is false.

Rally ends
  tight    the last event ends the rally itself (a kill, an error, an ace, a manual point). The ball is dead within
           seconds, so the end is found when a detection lies in [t - 1, t + 4] ([t - 4, t + 2] for a manual point,
           which is pressed after the ball is dead).
  loose    the last touch left the ball in play on their side. The real end is unknown, so a detection anywhere from
           t - 1 to 3 s before the next rally's first event, and at most 10 s after t, counts.
A detection matches at most one rally. Every other detection is false.

Two options test how much a result depends on the labels' timing: tolerance widens the +-1 s around an exact serve,
and shift moves every label by a number of seconds (some matches' labels sit a second or more off the video).
"""

import json
import sys

SERVE_TOL = 1.0
APPROX_BEFORE, APPROX_AFTER = 3.0, 0.5
TERMINAL = {"kill", "ace", "out", "net", "error", "block_kill", "tool", "block_tool", "over_score"}


def truth(set_file, tolerance=SERVE_TOL, shift=0.0):
    """Return (serves, ends): one dict per rally with a window [lo, hi] and a kind."""
    data = json.load(open(set_file))
    extra = tolerance - SERVE_TOL
    for event in data["events"]:
        event["timestamp"] += shift
    for rally in data["rallies"]:
        rally["endTime"] += shift
    events = sorted((e for e in data["events"] if e["kind"] in ("touch", "point")), key=lambda e: e["timestamp"])
    touches = [e for e in events if e["kind"] == "touch"]
    points = [e for e in events if e["kind"] == "point"]
    serves, ends, cursor, previous_end = [], [], 0, 0.0
    rallies = data["rallies"]

    for rally in rallies:
        own = touches[cursor : cursor + rally["touches"]]
        cursor += rally["touches"]
        point = next((p for p in points if abs(p["timestamp"] - rally["endTime"]) < 1e-3), None)
        last = max([e["timestamp"] for e in own] + ([point["timestamp"]] if point else [])) if own or point else None

        if own and own[0]["stat"] == "serve":
            t = own[0]["timestamp"]
            serves.append({"kind": "exact", "t": t, "lo": t - tolerance, "hi": t + tolerance})
        elif own and rally["serving"] == "them" and own[0]["stat"] == "receive":
            t = own[0]["timestamp"]
            serves.append({"kind": "approx", "t": t - 1.2, "lo": t - APPROX_BEFORE - extra, "hi": t + APPROX_AFTER + extra})
        else:
            hi = own[0]["timestamp"] if own else (last if last is not None else previous_end)
            serves.append({"kind": "unknown", "t": None, "lo": previous_end, "hi": hi})

        if last is None:
            ends.append({"kind": "unknown", "t": None, "lo": previous_end, "hi": previous_end})
        elif point and point["timestamp"] >= last:
            ends.append({"kind": "tight", "t": last, "lo": last - 4, "hi": last + 2})
        elif own[-1]["result"] in TERMINAL:
            ends.append({"kind": "tight", "t": last, "lo": last - 1, "hi": last + 4})
        else:
            ends.append({"kind": "loose", "t": last, "lo": last - 1, "hi": last + 10})
        if last is not None:
            previous_end = last

    for i, end in enumerate(ends[:-1]):
        nxt = serves[i + 1]
        next_first = nxt["hi"] - APPROX_AFTER if nxt["kind"] == "approx" else nxt["t"] if nxt["kind"] == "exact" else None
        if end["kind"] == "loose" and next_first is not None:
            end["hi"] = max(end["lo"] + 1, min(end["hi"], next_first - 3))

    return serves, ends


def match(windows, detections):
    """Greedy one-to-one matching in time order. Returns (matched window indices, unmatched detections)."""
    used, left = set(), []
    for d in sorted(detections):
        hit = next((i for i, w in enumerate(windows) if i not in used and w["lo"] <= d <= w["hi"]), None)
        if hit is None:
            left.append(d)
        else:
            used.add(hit)

    return used, left


def score(set_file, serves=(), rally_ends=(), tolerance=SERVE_TOL, shift=0.0):
    """Count found and false detections for one clip."""
    true_serves, true_ends = truth(set_file, tolerance, shift)
    out = {}
    hit, false = match(true_serves, serves)
    for kind in ("exact", "approx"):
        idx = [i for i, s in enumerate(true_serves) if s["kind"] == kind]
        out[f"serves_{kind}"] = len(idx)
        out[f"serves_{kind}_found"] = sum(i in hit for i in idx)
    out["serves_unknown"] = sum(s["kind"] == "unknown" for s in true_serves)
    out["serve_detections"] = len(serves)
    out["serve_false"] = len(false)
    out["serve_ignored"] = sum(true_serves[i]["kind"] == "unknown" for i in hit)
    out["serve_false_times"] = [round(d, 1) for d in false]
    out["serve_missed_times"] = [round(s["t"], 1) for i, s in enumerate(true_serves) if s["t"] and i not in hit]

    hit, false = match([e for e in true_ends if e["kind"] != "unknown"], rally_ends)
    known = [e for e in true_ends if e["kind"] != "unknown"]
    for kind in ("tight", "loose"):
        idx = [i for i, e in enumerate(known) if e["kind"] == kind]
        out[f"ends_{kind}"] = len(idx)
        out[f"ends_{kind}_found"] = sum(i in hit for i in idx)
    out["end_detections"] = len(rally_ends)
    out["end_false"] = len(false)

    return out


def total(rows):
    return {k: sum(r[k] for r in rows) for k in rows[0] if not k.endswith("_times")}


def share(a, b):
    return f"{100 * a / b:.0f}%" if b else "–"


def summary(r):
    """One line: share of serves found (all, exact, approx), false share, then the same for rally ends."""
    serves = r["serves_exact"] + r["serves_approx"]
    found = r["serves_exact_found"] + r["serves_approx_found"]
    ends = r["ends_tight"] + r["ends_loose"]
    ends_found = r["ends_tight_found"] + r["ends_loose_found"]

    return (
        f"serves found {share(found, serves)} ({found}/{serves}; exact {share(r['serves_exact_found'], r['serves_exact'])}, "
        f"approx {share(r['serves_approx_found'], r['serves_approx'])}), "
        f"false {share(r['serve_false'], r['serve_detections'])} ({r['serve_false']}/{r['serve_detections']}) | "
        f"ends found {share(ends_found, ends)} (tight {share(r['ends_tight_found'], r['ends_tight'])}, "
        f"loose {share(r['ends_loose_found'], r['ends_loose'])}), "
        f"false {share(r['end_false'], r['end_detections'])} ({r['end_false']}/{r['end_detections']})"
    )


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or len(args) % 2:
        sys.exit(__doc__)
    rows = []
    for set_file, det_file in zip(args[::2], args[1::2]):
        det = json.load(open(det_file))
        rows.append(score(set_file, det.get("serves", []), det.get("rally_ends", [])))
        print(f"{set_file}\n  {summary(rows[-1])}")
    if len(rows) > 1:
        print(f"total\n  {summary(total(rows))}")
