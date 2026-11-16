# Working on automatic stats detection

- Read README.md first, then your task file in tasks/ if you have one.
- Work on your task's own branch, cut from `auto-stats`, in a worktree at `~/Code/VolleyVector/auto-stats/<task>`, next to the `auto-stats` checkout. It merges back into `auto-stats`.
- Cache what you fetch or compute in `../data/cache/`, never in the worktree, and say before a run what it costs to redo something that is already paid for.
- At the end of a task, bring `../data/cache/README.md` up to date and suggest to the user which old caches are no longer useful. Delete none yourself.
- At the end of a task, fill in its Results section, update its row in roadmap.md, and add decisions or learnings that matter beyond the task to log.md.
