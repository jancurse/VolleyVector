"""Audio features per clip, cached in cache/feat/<clip>.audio.npz at 50 Hz.

whistle  how much one narrow peak between 1.8 and 5 kHz stands out of the spectrum (a referee whistle), in dB
freq     that peak's frequency in Hz
onset    broadband spectral flux (ball contacts, shouts, whistles)
loud     frame energy in dB
"""

import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import stft

import common

HOP_S = 0.02


def features(path):
    rate, x = wavfile.read(path)
    x = x.astype(np.float32) / 32768
    hop = int(rate * HOP_S)
    f, _, z = stft(x, rate, nperseg=1024, noverlap=1024 - hop, boundary=None, padded=False)
    p = np.abs(z) ** 2 + 1e-12
    db = 10 * np.log10(p)
    band = (f >= 1800) & (f <= 5000)
    peak = db[band].max(0)
    # A whistle is tonal: its peak rises far above the band's median level in the same frame.
    whistle = peak - np.median(db[band], 0)
    freq = f[band][db[band].argmax(0)]
    flux = np.maximum(np.diff(db[f >= 300], axis=1, prepend=db[f >= 300][:, :1]), 0).mean(0)
    loud = 10 * np.log10(p.sum(0))

    return dict(whistle=whistle.astype(np.float32), freq=freq.astype(np.float32), onset=flux.astype(np.float32), loud=loud.astype(np.float32))


if __name__ == "__main__":
    os.makedirs(os.path.join(common.CACHE, "feat"), exist_ok=True)
    for name, *_ in common.clips():
        out = os.path.join(common.CACHE, "feat", name + ".audio.npz")
        if not os.path.exists(out) and os.path.exists(common.audio(name)):
            np.savez_compressed(out, **features(common.audio(name)))
            print("done", name)
