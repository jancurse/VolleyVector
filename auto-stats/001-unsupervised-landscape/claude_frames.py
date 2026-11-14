"""Claude on sampled frames: contact sheets of 1 fps frames, sent through the Claude Code CLI (no API key needed).

Usage: claude_frames.py CLIP_NAME [START END]   e.g. 2026-11-07-f6-llamas-vs-bg-lions__set1 0 600
Each call gets 90 s of video as ten 3x3 sheets, every frame stamped with its clip second. Answers are cached in
cache/claude/<clip>/<start>.json; the script prints the scores for the part of the clip that was covered.
"""

import base64
import concurrent.futures
import json
import os
import subprocess
import sys

import cv2
import numpy as np

import common

MODEL = "sonnet"
WINDOW, OVERLAP = 90, 9
PROMPT = """These images are contact sheets from an amateur indoor volleyball match video, one frame per second, in time order.
Each frame has its time in seconds stamped in its top-left corner.

Find every serve and every rally end in this stretch.
- A serve: the moment a player standing behind an end line hits the ball to start a rally. Give the second of the frame closest to the contact. Both teams serve; a server may be at the edge of the picture or out of it, in which case use the first frame where the ball is flying over or players react.
- A rally end: the moment the ball goes dead (it lands, is hit out or into the net, or the referee stops play).

Answer with JSON only, no other text: {"serves": [seconds, ...], "rally_ends": [seconds, ...]}"""
SYSTEM = "You analyse sports video frames and answer with JSON only."


def sheet(frames, decimals=0):
    tiles = []
    for t, f in frames:
        f = cv2.resize(f, (512, 288))
        cv2.rectangle(f, (0, 0), (92, 30), (0, 0, 0), -1)
        cv2.putText(f, f"{t:.{decimals}f}", (4, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        tiles.append(f)
    while len(tiles) < 9:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[i : i + 3]) for i in (0, 3, 6)]

    return base64.b64encode(cv2.imencode(".jpg", np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 80])[1]).decode()


def ask(out, frames, prompt, decimals=0, model=MODEL):
    """Send the frames as 3x3 sheets with the prompt, and return the JSON answer (cached in the file out)."""
    if os.path.exists(out):
        return json.load(open(out))
    content = [{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": sheet(frames[i : i + 9], decimals)}} for i in range(0, len(frames), 9)]
    content.append({"type": "text", "text": prompt})
    message = json.dumps({"type": "user", "message": {"role": "user", "content": content}})
    run = subprocess.run(
        ["claude", "-p", "--model", model, "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--system-prompt", SYSTEM, "--tools", "", "--strict-mcp-config", "--setting-sources", ""],
        input=message, capture_output=True, text=True, timeout=600, cwd=common.CACHE,
    )
    result = [json.loads(line) for line in run.stdout.splitlines() if line.startswith("{")][-1]
    text = result.get("result", "")
    answer = json.loads(text[text.index("{") : text.rindex("}") + 1])
    answer["usage"], answer["cost_usd"] = result.get("usage"), result.get("total_cost_usd")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(answer, open(out, "w"))

    return answer


if __name__ == "__main__":
    name = sys.argv[1]
    frames = list(common.frames(name, 1))
    lo, hi = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 2 else (0, len(frames))
    starts = list(range(lo, hi, WINDOW - OVERLAP))
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        answers = list(pool.map(lambda s: ask(os.path.join(common.CACHE, "claude", name, f"{s:05d}.json"), frames[s : min(s + WINDOW, hi)], PROMPT), starts))
    serves, ends = [], []
    for found, key in ((serves, "serves"), (ends, "rally_ends")):
        for t in sorted(t for a in answers for t in a.get(key, [])):
            if not found or t - found[-1] > 3:
                found.append(float(t))
    print("cost (list price, USD):", round(sum(a["cost_usd"] or 0 for a in answers), 2), "calls", len(answers))
    print("serves", serves, "\nends", ends)
    json.dump({"serves": serves, "rally_ends": ends}, open(os.path.join(common.CACHE, "claude", f"{name}.{lo}-{hi}.json"), "w"))
