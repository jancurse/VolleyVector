"""A pretrained AudioSet tagger (AST) over 2 s windows every 0.5 s (padded to the 10 s the model expects), cached in cache/feat/<clip>.ast.npz.

Keeps the probabilities of the classes that could mark a serve or a rally end: whistle, cheering, applause, and so on.
Usage: audio_tagger.py [TEXT]   only clips whose name contains TEXT
"""

import os
import sys

import numpy as np
import torch
from scipy.io import wavfile
from scipy.signal import resample_poly
from transformers import ASTFeatureExtractor, ASTForAudioClassification

import common

MODEL = "MIT/ast-finetuned-audioset-10-10-0.4593"
KEEP = ["Whistle", "Whistling", "Cheering", "Applause", "Clapping", "Shout", "Speech", "Squeak", "Thump, thud", "Basketball bounce", "Slap, smack", "Silence"]

if __name__ == "__main__":
    extractor = ASTFeatureExtractor.from_pretrained(MODEL)
    model = ASTForAudioClassification.from_pretrained(MODEL).cuda().eval().half()
    idx = [model.config.label2id[k] for k in KEEP]
    for name, *_ in common.clips():
        out = os.path.join(common.CACHE, "feat", name + ".ast.npz")
        if os.path.exists(out) or (len(sys.argv) > 1 and sys.argv[1] not in name):
            continue
        rate, x = wavfile.read(common.audio(name))
        x = resample_poly(x.astype(np.float32) / 32768, 16000, rate)
        starts = np.arange(0, len(x) - 32000, 8000)
        probs = []
        for i in range(0, len(starts), 32):
            batch = [x[s : s + 32000] for s in starts[i : i + 32]]
            inputs = extractor(batch, sampling_rate=16000, return_tensors="pt")
            with torch.no_grad():
                probs.append(torch.sigmoid(model(inputs["input_values"].cuda().half()).logits[:, idx]).float().cpu().numpy())
        np.savez_compressed(out, t=starts / 16000 + 1.0, prob=np.concatenate(probs), labels=np.array(KEEP))
        print("done", name, flush=True)
