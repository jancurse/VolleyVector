#!/usr/bin/env bash
# Build the caches every test script reads: a 10 fps proxy video (long side 640) and 22.05 kHz mono audio per clip.
# Usage: prep.sh   (run from auto-stats/)
set -euo pipefail
clips=../../data/clips
one() {
  src="$1"; name="$(basename "$(dirname "$src")")__$(basename "$src" .mp4)"
  [ -f "cache/audio/$name.wav" ] || ffmpeg -v error -y -i "$src" -vn -ac 1 -ar 22050 "cache/audio/$name.wav"
  [ -f "cache/proxy/$name.mp4" ] || { ffmpeg -v error -y -i "$src" -an -vf "fps=10,scale=640:640:force_original_aspect_ratio=decrease:force_divisible_by=2" -c:v libx264 -preset veryfast -crf 23 "cache/proxy/$name.tmp.mp4" && mv "cache/proxy/$name.tmp.mp4" "cache/proxy/$name.mp4"; }
  echo "done $name"
}
export -f one
ls "$clips"/*/set*.mp4 | xargs -P 3 -I{} bash -c 'one "{}"'
