"""Shared helpers for the task 002 scripts: the API key, Files API uploads, and the clip list.

Usage: gemini.py upload CLIP_NAME    uploads one clip and prints its file name and state
The key is read from ~/.config/volleyvector/auto-stats.env and only ever sent in the x-goog-api-key header.
Uploaded files are remembered in ../data/cache/gemini/files.json. Google deletes them after 48 hours.
"""

import glob
import json
import os
import sys
import time
import typing
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import score as scorer  # noqa: E402

API = "https://generativelanguage.googleapis.com"
CLIPS = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "clips"))
CACHE = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "cache", "gemini"))
FILES = os.path.join(CACHE, "files.json")
KEEP = 46 * 3600


def key():
    for line in open(os.path.expanduser("~/.config/volleyvector/auto-stats.env")):
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip("\"'")
    sys.exit("GEMINI_API_KEY is not in ~/.config/volleyvector/auto-stats.env")


def clips():
    """Yield (name, match, set file, clip video) for every labelled clip."""
    for set_file in sorted(glob.glob(os.path.join(CLIPS, "*", "set*.json"))):
        match = os.path.basename(os.path.dirname(set_file))
        yield f"{match}__{os.path.basename(set_file)[:-5]}", match, set_file, set_file[:-5] + ".mp4"


def call(method, url, body=None, headers=None, timeout=900) -> tuple[int, typing.Any, typing.Any]:
    """One request. Returns (status, response headers, parsed JSON or text). Never raises on an HTTP error status."""
    data = json.dumps(body).encode() if isinstance(body, (dict, list)) else body
    req = urllib.request.Request(url, data=data, method=method, headers={"x-goog-api-key": key(), **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            status, head, text = res.status, res.headers, res.read().decode()
    except urllib.error.HTTPError as err:
        status, head, text = err.code, err.headers, err.read().decode()
    try:
        return status, head, json.loads(text) if text else {}
    except json.JSONDecodeError:
        return status, head, text


def upload(name, path=None):
    """Upload a clip through the Files API unless a recent upload is remembered. Returns the file's record."""
    os.makedirs(CACHE, exist_ok=True)
    known = json.load(open(FILES)) if os.path.exists(FILES) else {}
    if name in known and time.time() - known[name]["uploaded"] < KEEP:
        return known[name]
    path = path or {c[0]: c[3] for c in clips()}[name]
    size = os.path.getsize(path)
    status, head, body = call(
        "POST",
        f"{API}/upload/v1beta/files",
        {"file": {"display_name": name}},
        {
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": str(size),
            "X-Goog-Upload-Header-Content-Type": "video/mp4",
            "Content-Type": "application/json",
        },
    )
    if status != 200:
        sys.exit(f"upload start failed: HTTP {status} {body}")
    with open(path, "rb") as video:
        status, _, body = call(
            "POST",
            head["x-goog-upload-url"],
            video,
            {"Content-Length": str(size), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize"},
            timeout=3600,
        )
    if status != 200:
        sys.exit(f"upload failed: HTTP {status} {body}")
    record = body["file"]
    while record.get("state") == "PROCESSING":
        time.sleep(5)
        status, _, record = call("GET", f"{API}/v1beta/{record['name']}")
    if record.get("state") != "ACTIVE":
        sys.exit(f"file is not usable: {record}")
    known = json.load(open(FILES)) if os.path.exists(FILES) else {}
    known[name] = {"name": record["name"], "uri": record["uri"], "uploaded": time.time(), "bytes": size, "record": record}
    json.dump(known, open(FILES, "w"), indent=1)

    return known[name]


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "upload":
        sys.exit(__doc__)
    start = time.time()
    done = upload(sys.argv[2])
    print(json.dumps(done["record"], indent=1))
    print(f"{done['bytes'] / 1e6:.0f} MB, {time.time() - start:.0f} s")
