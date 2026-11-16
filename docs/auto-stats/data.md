# Data

All data lives in `~/Code/VolleyVector/auto-stats/data/`, beside the `auto-stats` checkout and outside every repo. A task worktree reaches it at `../data/`. Videos stay out of git, and nothing there is backed up.

It comes in two forms, each complete on its own:

- **`data/clips/`: one clip per labelled set, with a set file in clip seconds.** Use this by default. Read `../data/clips/README.md` first: it lists every clip and explains the limits of the labels.
- **`data/videos/`: the full, uncut videos, with the set files as recorded.** `../data/README.md` describes them.

## Clips

- 14 clips from 5 matches (4.3 hours, 6.5 GB), in `data/clips/<match>/setN.mp4` with `setN.json` beside each.
- A clip runs from about 20 s before the set's first touch to 20 s after its last. It is cut without re-encoding.
- The matches differ in camera, venue, resolution (720p to 1080p) and frame rate (25 to 60 fps). `llamas-vs-onyx` is filmed in landscape but stored turned a quarter turn, as a portrait video.
- Our team plays on the far half in the four `onyx-vs-f6-pirates` sets and on the near half in the other ten. The set files do not say.

## Labels

Set files are the stats tracker's JSON exports, with every touch and every rally's start, end, server and winner.

- 16 sets from 5 matches have labels. 14 of them have video.
- Only our own team's touches are recorded.
- **Times are approximate.** A person set each one by pressing a key while watching, so an action can sit a second or two from where it happens in the video. In some matches every label is off by the same amount ([task 001](tasks/001-unsupervised-landscape.md) measured about 1.5 s in two of them).
- **No rally has an end time.** A rally's `endTime` is its last recorded action, a touch or a manually entered point, not the moment the ball goes dead.
- The `volleyball-stats-collection` repo (`~/Code/volleyball-stats/volleyball-stats-collection/`) stays the source. Fix a set there, copy it into `data/videos/<match>/`, and run `data/cut_sets.py` again.

## Full videos

- Five matches (6 videos, 5.6 hours, 8.3 GB) were downloaded from YouTube at up to 1080p. A video is `match.mp4` when it holds the whole match, and `set N.mp4` when it holds one set.
- `2023-03-Phoenix-vs-Wapping/` (748 MB) holds `set 1.mp4` to `set 4.mp4`, with no set files. They are 2704×1520, 59.94 fps, HEVC, and 68 min in total. They are for unsupervised work.
- The original camera files for the YouTube matches are requested from the uploaders and not here yet.
