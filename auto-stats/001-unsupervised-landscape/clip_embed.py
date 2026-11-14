"""Image embeddings of every proxy frame at 2 fps, cached in cache/feat/<clip>.clip.npz, plus the text prompts' embeddings."""

import os

import cv2
import numpy as np
import open_clip
import torch
from PIL import Image

import common

PROMPTS = [
    "a volleyball player serving the ball from behind the end line",
    "a volleyball rally in play, players jumping and diving for the ball",
    "volleyball players standing still in position waiting for the serve",
    "volleyball players walking around, celebrating or talking between points",
    "an empty sports hall",
]

if __name__ == "__main__":
    model, _, pre = open_clip.create_model_and_transforms("ViT-B-16-SigLIP", pretrained="webli")
    tok = open_clip.get_tokenizer("ViT-B-16-SigLIP")
    model = model.cuda().eval().half()
    with torch.no_grad():
        text = torch.nn.functional.normalize(model.encode_text(tok(PROMPTS).cuda()), dim=-1).float().cpu().numpy()
    for name, *_ in common.clips():
        out = os.path.join(common.CACHE, "feat", name + ".clip.npz")
        if os.path.exists(out):
            continue
        times, embs, batch = [], [], []

        def flush():
            with torch.no_grad():
                embs.append(torch.nn.functional.normalize(model.encode_image(torch.stack(batch).cuda().half()), dim=-1).float().cpu().numpy())
            batch.clear()

        for t, frame in common.frames(name, 2):
            times.append(t)
            batch.append(pre(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))))
            if len(batch) == 64:
                flush()
        if batch:
            flush()
        np.savez_compressed(out, t=np.array(times), emb=np.concatenate(embs), text=text)
        print("done", name, flush=True)
