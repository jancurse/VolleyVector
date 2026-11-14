# Automatic stats detection

Detect volleyball stats automatically instead of recording every contact by hand in the tracker.

The VolleyVector clone at `~/Code/VolleyVector/auto-stats/auto-stats` is this project's home, checked out on `auto-stats`.
That branch is where all work is integrated.
Each task gets its own branch cut from `auto-stats`, in a worktree at `~/Code/VolleyVector/auto-stats/<task>`, and merges back into it.

## Goals

_TODO._

## Out of scope

_TODO._

## Success measures

_TODO: how we know detection is good enough, for example agreement with hand-recorded sets._

## Open questions

- Input: one fixed camera, phone footage, something else?
- Which stats first: serves, attacks, every contact the tracker records today?
- Live during a match, or on recordings afterwards?

## Status

The project is being set up. No tasks have started.

## Files

- [roadmap.md](roadmap.md): phases and the task list
- [tasks/](tasks/): one brief per task, written before it starts, results added when it ends
- [log.md](log.md): dated decisions and learnings
- [data.md](data.md): what footage and labels exist and where they live
- [CLAUDE.md](CLAUDE.md): how sessions work with these docs
