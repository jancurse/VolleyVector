"""How often does a generic detector (YOLO11 trained on COCO, class "sports ball") see the ball during rallies?

Takes 60 full-resolution frames per match from inside labelled rallies of set 1 and prints the share with a ball found.
A volleyball in flight is always in or near the picture during a rally, so this share is close to the detector's recall.
"""

import os
import subprocess

import cv2
import numpy as np
from ultralytics import YOLO

import common

if __name__ == "__main__":
    model = YOLO(os.path.join(common.CACHE, "yolo11m.pt"))
    rng = np.random.default_rng(0)
    for name, _, set_file, video in common.clips():
        if not name.endswith("set1"):
            continue
        serves, ends = common.scorer.truth(set_file)
        spans = [(s["t"] + 1, e["t"]) for s, e in zip(serves, ends) if s["t"] and e["t"] and e["t"] - s["t"] > 3]
        hits, conf = 0, []
        for lo, hi in [spans[i] for i in rng.integers(0, len(spans), 60)]:
            # ffmpeg, not OpenCV: OpenCV's own build cannot decode the AV1 clips.
            cmd = ["ffmpeg", "-v", "error", "-ss", f"{rng.uniform(lo, hi):.2f}", "-i", video, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]
            frame = cv2.imdecode(np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.uint8), cv2.IMREAD_COLOR)
            if "llamas-vs-onyx" in name:
                frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
            r = model(frame, imgsz=1280, conf=0.15, classes=[32], verbose=False)[0]
            hits += len(r.boxes) > 0
            conf += r.boxes.conf.tolist()
        print(f"{name}: ball found in {hits}/60 rally frames, median confidence {np.median(conf) if conf else 0:.2f}")
