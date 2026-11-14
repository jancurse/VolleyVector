"""Claude on sampled frames, asked for rallies instead of single events: each rally is a serve and its end together.

Usage: claude_rallies.py MODEL CLIP_NAME    MODEL is a `claude` CLI model name, e.g. sonnet or opus
Each call gets 90 s of video as ten 3x3 sheets of 1 fps frames. Rallies from overlapping windows are merged, so a
rally cut by a window's edge is joined with its other half. Answers are cached in cache/rallies/<model>/<clip>/.
Writes cache/rallies/<model>/<clip>.json with {"serves", "rally_ends"} and prints the tokens used.
"""

import concurrent.futures
import json
import os
import sys

import common
from claude_frames import ask

WINDOW, OVERLAP = 90, 18
PROMPT = """These images are contact sheets from an amateur indoor volleyball match video, one frame per second, in time order.
Each frame has its time in seconds stamped in its top-left corner. This stretch runs from second {start} to second {end}.

List every rally in this stretch. A rally starts with a serve (a player behind an end line hits the ball over the net) and ends when the ball goes dead (it lands, is hit out or into the net, or the referee stops play).

Rules:
- One serve per rally. After a serve, the next serve can only come after that rally has ended.
- Players lining up, the server fetching, bouncing or holding the ball, and the server walking to the end line are NOT a serve. Report the serve only at the frame where the ball is hit or first flies towards the net.
- The camera may not show one end line. If the server is out of the picture, use the first frame where the ball flies in from that side.
- A rally can last a minute and cross the net many times. Hits from the back of the court during a rally are not serves.
- Between rallies there are 10 to 30 seconds of walking, celebrating or a time-out. A ball thrown or rolled back is not a rally.
- If a rally is already in play at the first frame, give its serve as null. If one is still in play at the last frame, give its end as null.

Answer with JSON only, no other text: {{"rallies": [{{"serve": seconds or null, "end": seconds or null}}, ...]}}"""


def merge(windows):
    """Join the rallies of overlapping windows. windows is a list of (start, end, rallies)."""
    spans = []
    for start, end, rallies in windows:
        for r in rallies:
            serve, stop = r.get("serve"), r.get("end")
            lo, hi = (serve if serve is not None else start), (stop if stop is not None else end)
            if hi >= lo:
                spans.append([lo, hi, serve, stop])
    spans.sort(key=lambda s: s[0])
    out = []
    for lo, hi, serve, stop in spans:
        if out and lo <= out[-1][1] + 1:
            last = out[-1]
            last[1] = max(last[1], hi)
            last[2] = last[2] if last[2] is not None else serve
            last[3] = max([x for x in (last[3], stop) if x is not None], default=None)
        else:
            out.append([lo, hi, serve, stop])

    return [(serve, stop) for lo, hi, serve, stop in out if hi - lo >= 1]


if __name__ == "__main__":
    model, name = sys.argv[1], sys.argv[2]
    frames = list(common.frames(name, 1))
    folder = os.path.join(common.CACHE, "rallies", model)
    starts = list(range(0, len(frames) - OVERLAP, WINDOW - OVERLAP))

    def one(s):
        chunk = frames[s : s + WINDOW]
        prompt = PROMPT.format(start=s, end=s + len(chunk) - 1)

        return s, s + len(chunk) - 1, ask(os.path.join(folder, name, f"{s:05d}.json"), chunk, prompt, model=model)

    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        answers = list(pool.map(one, starts))
    rallies = merge([(s, e, a.get("rallies", [])) for s, e, a in answers])
    det = {"serves": [float(s) for s, _ in rallies if s is not None], "rally_ends": [float(e) for _, e in rallies if e is not None]}
    json.dump(det, open(os.path.join(folder, name + ".json"), "w"))
    print(name, "calls", len(answers), "rallies", len(rallies), "cli cost", round(sum(a[2]["cost_usd"] or 0 for a in answers), 2))
