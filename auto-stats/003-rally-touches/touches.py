"""Gemini asked for what happens inside each rally: who serves, and every touch with its side and skill.

Usage: touches.py one MODEL CLIP [CLIP ...] [--fps N] [--agentic] [--results] [--asstored] [--thinking LEVEL] [--run N]
       touches.py two MODEL CLIP [CLIP ...] [--fps N] [--rallies-fps N] [--results] [--asstored] [--thinking LEVEL] [--run N]
    one            one call for the whole clip: rallies and their touches together (default 2 fps)
    two            task 002's rallies call on the whole clip (--rallies-fps, default 1), then one call per rally on the
                   stretch from 3 s before its serve to 2 s after its end, at --fps (default 5)
    --agentic      agentic processing instead of a fixed frame rate (one pass only)
    --results      also ask for each touch's result, in the tracker's codes
    --asstored     send a clip that is stored on its side as it is. By default a copy turned upright is sent (two
                   passes: the rallies still come from the clip as stored)
    --thinking     thinking level (the model's default when absent)
    --run          a number to tell repeated runs of the same settings apart (default 1)
Every answer is cached in cache/gemini/touches/<settings>/, so a rerun is free.
Writes <clip>.json there: {"rallies": [{"serve", "end", "serving", "touches": [{"t", "side", "skill"}]}], "usage", "cost_usd"}.
Times are clip seconds. Prints tokens and cost per clip.
"""

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "002-gemini-video"))
import gemini  # noqa: E402
import gemini_rallies  # noqa: E402

OUT = os.path.join(gemini.CACHE, "touches")
SKILLS = ["serve", "receive", "set", "attack", "block", "defense", "freeball"]
BEFORE, AFTER = 3.0, 2.0

# The half of the court our team plays on in each clip, seen from the camera. The set files do not say.
# Checked by eye on frames at labelled serves and receives: the camera follows one team's end in every match.
SIDES = {"2026-10-30-onyx-vs-f6-pirates": "far"}
# Matches whose video is stored turned a quarter turn. The model mixes up the two teams unless it gets an upright copy.
SIDEWAYS = {"2025-11-09-f6-llamas-vs-onyx"}
HALF = {
    "near": "Our team (\"us\") plays on the half of the court nearer to the camera. The opponent (\"them\") plays on the far half, beyond the net.",
    "far": "Our team (\"us\") plays on the far half of the court, beyond the net. The opponent (\"them\") plays on the half nearer to the camera.",
}

SKILL_TEXT = """Give each touch one of these skills:
- serve: the hit from behind the end line that starts the rally.
- receive: a team's first touch on the opponent's serve.
- set: the touch that puts the ball up for a teammate to attack, normally a team's second touch.
- attack: a ball sent over the net to score: a spike, a tip, a roll shot, a hard-driven ball.
- block: a player at the net who touches the opponent's attack with the hands above the net.
- defense: a dig. A team's first touch on the opponent's attack or freeball, or picking up a ball that came off a block.
- freeball: an easy ball given over the net without an attack, such as a forearm pass or a high ball."""

RESULT_TEXT = """Also give each touch a result, one of:
- serve: ace, in (the opponent passes it), out, net
- receive, defense: good (the setter can use every attacker), poor (one attacking option or none), error (the point is lost)
- set: on (hittable), off (hard to hit), over (it goes over the net), error
- attack: kill, defended (dug, still in play), blocked_inplay, blocked_kill (stuffed, point lost), tool (off the block for a point), out, net
- block: kill, touch (still in play), tool (off the block, point lost), net
- freeball: in (the opponent passes it), point, out, net"""

ONE = """This is a video of one set of an amateur indoor volleyball match, filmed by a fixed camera.
{half}

List every rally in the video, and inside each rally every touch of the ball by either team, in order.
A rally starts with a serve (a player behind an end line hits the ball over the net) and ends when the ball goes dead (it lands, is hit out or into the net, or the referee stops play).

Rules for rallies:
- One serve per rally. After a serve, the next serve can only come after that rally has ended.
- Players lining up, the server fetching, bouncing or holding the ball, and the server walking to the end line are NOT a serve. Report the serve at the moment the ball is hit.
- The camera may not show one end line. If the server is out of the picture, use the moment the ball flies in from that side.
- A rally can last a minute and cross the net many times. Hits from the back of the court during a rally are not serves.
- Between rallies there are 10 to 30 seconds of walking, celebrating or a time-out. A ball thrown or rolled back is not a rally.
- A set has 30 to 50 rallies. Go through the whole video to its last second and do not skip any.

Rules for touches:
- The first touch of every rally is the serve, by the side that serves.
- A team has at most three touches before the ball must cross the net, not counting a block.
- List a touch only if a player plays the ball. The ball landing on the floor is not a touch.
- Give the time of each touch at the moment of contact.

{skills}

Give every time as MM:SS from the start of the video.
Answer with JSON only, no other text:
{{"rallies": [{{"serve": "MM:SS", "end": "MM:SS", "serving": "us" or "them", "touches": [{touch}, ...]}}, ...]}}"""

TWO = """This is a short video of one rally from an amateur indoor volleyball match, filmed by a fixed camera. It starts a few seconds before the serve and ends just after the ball goes dead.
{half}

Say which side serves, and list every touch of the ball by either team, in order.

Rules:
- The first touch is the serve, by the side that serves. The camera may not show one end line: if the server is out of the picture, the serve is the moment the ball flies in from that side.
- A team has at most three touches before the ball must cross the net, not counting a block.
- List a touch only if a player plays the ball. The ball landing on the floor is not a touch.
- Give the time of each touch at the moment of contact.
- If the video holds no serve and no play, answer with an empty list of touches and "serving": null.

{skills}

Give every time in seconds from the start of this video, with one decimal.
Answer with JSON only, no other text:
{{"serving": "us" or "them", "touches": [{touch}, ...]}}"""


def side(name):
    return SIDES.get(name.split("__")[0], "near")


def prompt(template, name, results, stamp):
    skills = SKILL_TEXT + ("\n\n" + RESULT_TEXT if results else "")
    touch = f'[{stamp}, "us" or "them", skill' + (", result]" if results else "]")

    return template.format(half=HALF[side(name)], skills=skills, touch=touch)


def settings(args):
    how = "agentic" if args.agentic else f"{args.fps:g}fps"
    parts = [args.route, args.model, how]
    if args.route == "two" and args.rallies_fps != 1:
        parts.append(f"rallies{args.rallies_fps:g}fps")
    if args.asstored:
        parts.append("asstored")
    if args.results:
        parts.append("results")
    if args.thinking:
        parts.append(f"think-{args.thinking}")
    if args.run != 1:
        parts.append(f"run{args.run}")

    return "_".join(parts)


def ask(args, path, video, text):
    """Return the raw interaction, from the cache or from one paid call. Retries when the service is busy."""
    if os.path.exists(path):
        return json.load(open(path))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = {"model": args.model, "input": [video, {"type": "text", "text": text}]}
    if args.thinking:
        body["generation_config"] = {"thinking_level": args.thinking}
    status, answer = 0, {}
    for attempt in range(5):
        status, _, answer = gemini.call("POST", f"{gemini.API}/v1beta/interactions", body, {"Content-Type": "application/json"}, timeout=1800)
        # An answer cut off at the output limit ("incomplete") is billed too. It is kept, and reads as a rally without touches.
        if status == 200 and answer.get("status") in ("completed", "incomplete"):
            answer.pop("continuation_token", None)
            answer.setdefault("steps", [])
            json.dump(answer, open(path, "w"), indent=1)

            return answer
        if status not in (429, 500, 502, 503, 504):
            break
        time.sleep(20 * (attempt + 1))
    sys.exit(f"{path}: HTTP {status} {json.dumps(answer)[:2000]}")


def text_of(answer):
    return "".join(c.get("text", "") for s in answer["steps"] if s["type"] == "model_output" for c in s["content"])


def parse(text):
    found = re.search(r"\{.*\}", text, re.S)
    try:
        return json.loads(found.group(0)) if found else {}
    except json.JSONDecodeError:
        return {}


def touches(raw, shift=0.0):
    out = []
    for item in raw or []:
        if not isinstance(item, list) or len(item) < 3 or item[2] not in SKILLS:
            continue
        t = gemini_rallies.seconds(item[0])
        touch = {"t": None if t is None else t + shift, "side": item[1], "skill": item[2]}
        if len(item) > 3:
            touch["result"] = item[3]
        out.append(touch)

    return out


def usage_of(answers):
    keys = {"input": "total_input_tokens", "output": "total_output_tokens", "thought": "total_thought_tokens", "tool": "total_tool_use_tokens"}

    return {k: sum(a["usage"].get(v, 0) for a in answers) for k, v in keys.items()}


def cost(model, usage):
    price_in, price_out = gemini_rallies.PRICES[model]

    return ((usage["input"] + usage["tool"]) * price_in + (usage["output"] + usage["thought"]) * price_out) / 1e6


def turned(name):
    """The clip turned upright and re-encoded at 720 px high, written once to cache/gemini/upright/. For clips stored on their side."""
    out = os.path.join(gemini.CACHE, "upright", name + ".mp4")
    if not os.path.exists(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        src = {c[0]: c[3] for c in gemini.clips()}[name]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "transpose=1", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "copy", out], check=True)

    return out


def uploaded(args, name):
    sideways = name.split("__")[0] in SIDEWAYS and not args.asstored

    return gemini.upload(name + "__upright", turned(name)) if sideways else gemini.upload(name)


def one_pass(args, name):
    record = uploaded(args, name)
    video = {
        "type": "video",
        "uri": record["uri"],
        "mime_type": "video/mp4",
        "resolution": "low",
        "processing": "agentic" if args.agentic else {"type": "static", "fps": args.fps},
    }
    answer = ask(args, os.path.join(OUT, settings(args), name + ".raw.json"), video, prompt(ONE, name, args.results, '"MM:SS"'))
    rallies = [
        {"serve": gemini_rallies.seconds(r.get("serve")), "end": gemini_rallies.seconds(r.get("end")), "serving": r.get("serving"), "touches": touches(r.get("touches"))}
        for r in parse(text_of(answer)).get("rallies", [])
    ]

    return rallies, [answer], 0.0


def two_pass(args, name):
    first = argparse.Namespace(model=args.model, res="low", fps=args.rallies_fps, nosound=False, agentic=False, thinking=None, run=args.run)
    found = gemini_rallies.detections(first, name)
    record = uploaded(args, name)
    serves = sorted(found["serves"])
    ends = sorted(found["rally_ends"])
    spans = []
    for i, serve in enumerate(serves):
        nxt = serves[i + 1] if i + 1 < len(serves) else serve + 60
        end = next((e for e in ends if serve < e < nxt), min(serve + 30, nxt - 3))
        spans.append((serve, end))

    def rally(item):
        i, (serve, end) = item
        start = max(0.0, serve - BEFORE)
        video = {
            "type": "video",
            "uri": record["uri"],
            "mime_type": "video/mp4",
            "resolution": "low",
            "processing": {"type": "static", "fps": args.fps, "start_offset": f"{start:g}s", "end_offset": f"{end + AFTER:g}s"},
        }
        answer = ask(args, os.path.join(OUT, settings(args), name, f"{i:02d}.raw.json"), video, prompt(TWO, name, args.results, "seconds"))
        got = parse(text_of(answer))

        return {"serve": serve, "end": end, "serving": got.get("serving"), "touches": touches(got.get("touches"), args.shift(start))}, answer

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        done = list(pool.map(rally, enumerate(spans)))

    return [r for r, _ in done], [a for _, a in done], found["cost_usd"]


def run(args, name):
    rallies, answers, extra = (one_pass if args.route == "one" else two_pass)(args, name)
    usage = usage_of(answers)
    det = {"rallies": rallies, "usage": usage, "calls": len(answers), "cost_usd": cost(args.model, usage) + extra, "rallies_cost_usd": extra}
    json.dump(det, open(os.path.join(OUT, settings(args), name + ".json"), "w"))

    return det


if __name__ == "__main__":
    parser = argparse.ArgumentParser(usage=__doc__)
    parser.add_argument("route", choices=["one", "two"])
    parser.add_argument("model", choices=gemini_rallies.PRICES)
    parser.add_argument("clips", nargs="+")
    parser.add_argument("--fps", type=float)
    parser.add_argument("--rallies-fps", type=float, default=1.0)
    parser.add_argument("--agentic", action="store_true")
    parser.add_argument("--results", action="store_true")
    parser.add_argument("--asstored", action="store_true")
    parser.add_argument("--thinking")
    parser.add_argument("--run", type=int, default=1)
    parser.add_argument("--absolute", action="store_true", help="two passes: the model's times count from the start of the whole clip")
    args = parser.parse_args()
    args.fps = args.fps or (2.0 if args.route == "one" else 5.0)
    args.shift = lambda start: 0.0 if args.absolute else start
    with concurrent.futures.ThreadPoolExecutor(3) as pool:
        results = list(pool.map(lambda n: run(args, n), args.clips))
    print(f"== {settings(args)}")
    for name, det in zip(args.clips, results):
        u = det["usage"]
        n = sum(len(r["touches"]) for r in det["rallies"])
        print(f"{name}: rallies {len(det['rallies'])}, touches {n}, calls {det['calls']}, in {u['input']}, tool {u['tool']}, out {u['output']}, thought {u['thought']}, ${det['cost_usd']:.3f}")
    print(f"total ${sum(d['cost_usd'] for d in results):.2f}")
