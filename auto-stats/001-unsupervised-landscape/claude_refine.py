"""Second pass with Claude: for each coarse serve, look at 5 frames per second around it and time the contact.

Usage: claude_refine.py DETECTIONS.json   (a file written by claude_frames.py)
Each serve gets one call with 36 frames from 5 s before to 2 s after the coarse time. Writes <same name>.refined.json.
"""

import concurrent.futures
import json
import os
import sys

import common
from claude_frames import ask

PROMPT = """These images are contact sheets from an amateur indoor volleyball match video, five frames per second, in time order.
Each frame has its time in seconds stamped in its top-left corner.
A serve probably happens in this stretch: a player behind an end line tosses the ball and hits it over the net to start a rally.

Give the time of the frame closest to the moment the server's hand hits the ball.
If the server is out of the picture, estimate the contact from the ball's flight and the players' reactions (the ball needs about one second to reach the receivers).
Answer with JSON only: {"serve": seconds} or {"serve": null} if no serve starts in this stretch."""

if __name__ == "__main__":
    path = sys.argv[1]
    name = os.path.basename(path).split(".")[0]
    det = json.load(open(path))
    frames = list(common.frames(name, 5))

    def one(d):
        lo = max(0, int((d - 5) * 5))
        out = os.path.join(common.CACHE, "claude", name, f"refine-{int(d):05d}.json")

        return ask(out, frames[lo : lo + 36], PROMPT, decimals=1)

    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        answers = list(pool.map(one, det["serves"]))
    serves = []
    for t in sorted(float(a["serve"]) for a in answers if a.get("serve") is not None):
        if not serves or t - serves[-1] > 2:
            serves.append(t)
    print("cost (list price, USD):", round(sum(a["cost_usd"] or 0 for a in answers), 2), "calls", len(answers), "kept", len(serves))
    json.dump({"serves": serves, "rally_ends": det["rally_ends"]}, open(path[:-5] + ".refined.json", "w"))
