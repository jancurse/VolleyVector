"""Gemini on a whole clip, asked for rallies: each rally is a serve and its end together. One call per clip.

Usage: gemini_rallies.py MODEL CLIP_NAME [CLIP_NAME ...] [--res low|high] [--fps N] [--nosound] [--agentic]
                         [--thinking LEVEL] [--run N]
    MODEL       a Gemini model ID, e.g. gemini-4-hydrogen
    --res       media resolution of the video part (default low)
    --fps       frames sampled per second (default 1). Static processing only
    --nosound   send a copy of the clip with the sound track removed (same picture, not re-encoded)
    --agentic   agentic processing: the model decides which parts of the video to look at. No --fps
    --thinking  thinking level (the model's default when absent)
    --run       a number to tell repeated runs of the same settings apart (default 1)
The answer and its token counts are cached in cache/gemini/runs/<settings>/<clip>.raw.json, so a rerun is free.
Writes <clip>.json beside it with {"serves", "rally_ends", "usage", "cost_usd"} and prints tokens and cost per clip.
"""

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys

import gemini

# USD per million tokens (input, output), standard paid tier, read from Google's pricing page on 2026-11-15.
# Carbon and Argon double on 2026-12-01, 3.8 Flash on 2027-01-01. Thinking tokens are billed as output.
# Agentic processing reports the video it looked at as tool-use tokens. They are costed here at the input price.
PRICES = {
    "gemini-4-hydrogen": (1.50, 7.50),
    "gemini-4-carbon": (2.00, 10.00),
    "gemini-4-argon": (2.00, 10.00),
    "gemini-3.8-flash": (0.75, 3.75),
    "gemini-3.5-flash-lite": (0.30, 2.50),
}

PROMPT = """This is a video of one set of an amateur indoor volleyball match, filmed by a fixed camera.

List every rally in the video. A rally starts with a serve (a player behind an end line hits the ball over the net) and ends when the ball goes dead (it lands, is hit out or into the net, or the referee stops play).

Rules:
- One serve per rally. After a serve, the next serve can only come after that rally has ended.
- Players lining up, the server fetching, bouncing or holding the ball, and the server walking to the end line are NOT a serve. Report the serve at the moment the ball is hit.
- The camera may not show one end line. If the server is out of the picture, use the moment the ball flies in from that side.
- A rally can last a minute and cross the net many times. Hits from the back of the court during a rally are not serves.
- Between rallies there are 10 to 30 seconds of walking, celebrating or a time-out. A ball thrown or rolled back is not a rally.
- A set has 30 to 50 rallies. Go through the whole video to its last second and do not skip any.
- If a rally is already in play when the video starts, give its serve as null. If one is still in play when it ends, give its end as null.

Give every time as MM:SS from the start of the video.
Answer with JSON only, no other text: {"rallies": [{"serve": "MM:SS" or null, "end": "MM:SS" or null}, ...]}"""


def settings(args):
    parts = [args.model, args.res, "agentic" if args.agentic else f"{args.fps:g}fps", "nosound" if args.nosound else "sound"]
    if args.thinking:
        parts.append(f"think-{args.thinking}")
    if args.run != 1:
        parts.append(f"run{args.run}")

    return "_".join(parts)


def silent(name):
    """The clip without its sound track, written once to cache/gemini/silent/."""
    out = os.path.join(gemini.CACHE, "silent", name + ".mp4")
    if not os.path.exists(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        src = {c[0]: c[3] for c in gemini.clips()}[name]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-c", "copy", out], check=True)

    return out


def seconds(stamp):
    """Seconds from "MM:SS", "H:MM:SS", "MM:SS.s" or a number. None stays None."""
    if stamp is None or isinstance(stamp, (int, float)):
        return stamp
    if not re.fullmatch(r"[\d:.]+", str(stamp).strip()):
        return None
    total = 0.0
    for part in str(stamp).strip().split(":"):
        total = total * 60 + float(part)

    return total


def parse(text):
    found = re.search(r"\{.*\}", text, re.S)

    return json.loads(found.group(0))["rallies"] if found else []


def ask(args, name):
    """Return the raw interaction for one clip, from the cache or from one paid call."""
    path = os.path.join(gemini.CACHE, "runs", settings(args), name + ".raw.json")
    if os.path.exists(path):
        return json.load(open(path))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    record = gemini.upload(name + "__silent", silent(name)) if args.nosound else gemini.upload(name)
    video = {
        "type": "video",
        "uri": record["uri"],
        "mime_type": "video/mp4",
        "resolution": args.res,
        "processing": "agentic" if args.agentic else {"type": "static", "fps": args.fps},
    }
    body = {"model": args.model, "input": [video, {"type": "text", "text": PROMPT}]}
    if args.thinking:
        body["generation_config"] = {"thinking_level": args.thinking}
    status, _, answer = gemini.call("POST", f"{gemini.API}/v1beta/interactions", body, {"Content-Type": "application/json"}, timeout=1800)
    if status != 200 or answer.get("status") != "completed":
        sys.exit(f"{name}: HTTP {status} {json.dumps(answer)[:2000]}")
    json.dump(answer, open(path, "w"), indent=1)

    return answer


def detections(args, name):
    answer = ask(args, name)
    text = "".join(c.get("text", "") for s in answer["steps"] if s["type"] == "model_output" for c in s["content"])
    rallies = [(seconds(r.get("serve")), seconds(r.get("end"))) for r in parse(text)]
    usage = answer["usage"]
    billed_out = usage["total_output_tokens"] + usage.get("total_thought_tokens", 0)
    price_in, price_out = PRICES[args.model]
    det = {
        "serves": [s for s, _ in rallies if s is not None],
        "rally_ends": [e for _, e in rallies if e is not None],
        "usage": {
            "input": usage["total_input_tokens"],
            "output": usage["total_output_tokens"],
            "thought": usage.get("total_thought_tokens", 0),
            "tool": usage.get("total_tool_use_tokens", 0),
        },
        "cost_usd": ((usage["total_input_tokens"] + usage.get("total_tool_use_tokens", 0)) * price_in + billed_out * price_out) / 1e6,
    }
    json.dump(det, open(os.path.join(gemini.CACHE, "runs", settings(args), name + ".json"), "w"))

    return det


if __name__ == "__main__":
    parser = argparse.ArgumentParser(usage=__doc__)
    parser.add_argument("model", choices=PRICES)
    parser.add_argument("clips", nargs="+")
    parser.add_argument("--res", default="low", choices=["low", "medium", "high"])
    parser.add_argument("--fps", type=float, default=1.0)
    parser.add_argument("--nosound", action="store_true")
    parser.add_argument("--agentic", action="store_true")
    parser.add_argument("--thinking")
    parser.add_argument("--run", type=int, default=1)
    args = parser.parse_args()
    sets = {c[0]: c[2] for c in gemini.clips()}
    with concurrent.futures.ThreadPoolExecutor(5) as pool:
        results = list(pool.map(lambda n: detections(args, n), args.clips))
    print(f"== {settings(args)}")
    for name, det in zip(args.clips, results):
        u = det["usage"]
        row = gemini.scorer.score(sets[name], det["serves"], det["rally_ends"])
        print(f"{name}: rallies {len(det['serves'])}, in {u['input']}, tool {u['tool']}, out {u['output']}, thought {u['thought']}, ${det['cost_usd']:.3f}")
        print(f"  {gemini.scorer.summary(row)}")
    print(f"total ${sum(d['cost_usd'] for d in results):.2f}")
