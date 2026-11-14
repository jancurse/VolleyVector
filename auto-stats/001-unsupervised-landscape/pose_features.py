"""People per proxy frame (10 fps) from YOLO11 pose with ByteTrack ids, cached in cache/feat/<clip>.pose.npz.

Usage: pose_features.py [TEXT]   only clips whose name contains TEXT, e.g. set1 (a clip takes about 8 minutes)

frame  frame index of each detection     id   track id (-1 when untracked)
box    x, y, w, h of the person, as shares of the upright picture     kp   17 COCO keypoints (x, y, confidence)
"""

import os
import sys

import numpy as np
from ultralytics import YOLO

import common

if __name__ == "__main__":
    for name, *_ in common.clips():
        out = os.path.join(common.CACHE, "feat", name + ".pose.npz")
        if os.path.exists(out) or (len(sys.argv) > 1 and sys.argv[1] not in name):
            continue
        model = YOLO(os.path.join(common.CACHE, "yolo11s-pose.pt"))
        frame_idx, ids, boxes, kps = [], [], [], []
        for i, (_, frame) in enumerate(common.frames(name, 10)):
            r = model.track(frame, persist=True, verbose=False, imgsz=640, conf=0.25, tracker="bytetrack.yaml")[0]
            if r.boxes is None or len(r.boxes) == 0:
                continue
            n = len(r.boxes)
            frame_idx += [i] * n
            ids += (r.boxes.id.int().tolist() if r.boxes.id is not None else [-1] * n)
            boxes.append(r.boxes.xywhn.cpu().numpy())
            kps.append(np.concatenate([r.keypoints.xyn.cpu().numpy(), r.keypoints.conf.cpu().numpy()[..., None]], -1))
        np.savez_compressed(out, frame=np.array(frame_idx), id=np.array(ids), box=np.concatenate(boxes).astype(np.float32), kp=np.concatenate(kps).astype(np.float16))
        print("done", name, flush=True)
