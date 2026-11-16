"""Compare two runs of touches.py on the same clips, rally by rally.

Usage: compare.py SETTINGS_A SETTINGS_B
Rallies whose serves lie within 3 s of each other count as the same rally. Prints, per clip and in total, the rallies both
runs report, those with the same serving side, and those with the same list of our touches, and the touches that agree.
"""

import json
import os
import sys

import report

t = report.t

if __name__ == "__main__":
    a_dir, b_dir = (os.path.join(t.OUT, d) for d in sys.argv[1:3])
    total = [0] * 7
    for name, _, _, _ in t.gemini.clips():
        if not all(os.path.exists(os.path.join(d, name + ".json")) for d in (a_dir, b_dir)):
            continue
        a, b = (json.load(open(os.path.join(d, name + ".json")))["rallies"] for d in (a_dir, b_dir))
        used, row = set(), [len(a), len(b), 0, 0, 0, 0, 0]
        for ra in a:
            j = next((j for j, rb in enumerate(b) if j not in used and abs(rb["serve"] - ra["serve"]) <= 3), None)
            if j is None:
                continue
            used.add(j)
            ours = [[x["skill"] for x in r["touches"] if x["side"] == "us"] for r in (ra, b[j])]
            row[2] += 1
            row[3] += ra["serving"] == b[j]["serving"]
            row[4] += ours[0] == ours[1]
            row[5] += sum(i is not None and k is not None and ours[0][i] == ours[1][k] for i, k in report.align(*ours))
            row[6] += max(len(ours[0]), len(ours[1]))
        total = [x + y for x, y in zip(total, row)]
        print(f"{name}: rallies {row[0]} and {row[1]}, shared {row[2]}, same serving side {row[3]}, same touch list {row[4]}, touches agreeing {row[5]}/{row[6]}")
    print(f"total: rallies {total[0]} and {total[1]}, shared {total[2]}, same serving side {total[3]}, same touch list {total[4]}, touches agreeing {total[5]}/{total[6]}")
