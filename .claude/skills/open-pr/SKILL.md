---
name: open-pr
description: Open a pull request for the current branch - bring it up to date with main, write the description, create the PR. Use when the user asks to open a PR, or for a PR description, write-up, or body.
---

# Opening a PR

Open a PR only when the user asks for one. Their request covers every step below, including the rebase and the push.

Asked only for a description, write it as [The description](#the-description) says, give it in your reply, and stop there.

## Steps

1. **Commit.** Make sure the branch's commit history is clean. Rebase or squash commits where needed.
2. **Bring the branch up to date with `main`.** Run `git fetch origin main`, then `git rev-list --count HEAD..origin/main`. Anything but `0` means the branch is behind:
    - Rebase it onto `origin/main`.
    - Resolve a conflict yourself only when it is trivial: both sides' intent is obvious and the result keeps both (two additions to one list, neighbouring lines). Mention it to the user.
    - On any other conflict, run `git rebase --abort`, tell the user which files conflict, and ask.
    - After a rebase, run the diagnostics and the tests again.
3. **Push.** `git push -u origin <branch>`. A branch that was pushed before the rebase needs `--force-with-lease`. Push only the feature branch, never `main`.
4. **Write the description**, as below.
5. **Create the PR** with `gh pr create --base main`, the title in `--title` and the body through `--body-file -` from a heredoc. Give the user the link.

## The description

Write it from the branch against `origin/main` (`git log origin/main..HEAD`, `git diff origin/main...HEAD`), from what changed and not from the conversation.

- **Title**: one concise line naming what the PR does.
- **Body**: a concise description, usually a single block:
    - a 1–2 line summary of the change,
    - a couple of bullets for the notable parts,
    - a closing issue line: `Closes #N`, or `First part of #N` when the branch only starts that issue.
- Branch names carry no issue number. Take `#N` from the issue the user named or the plan refers to; if none is clear, ask. Drop the line if there is no issue.
- No headings in the body. For a multi-topic PR, lead each topic with a bold label (`**DNS.** …`) as its own bullet or short paragraph, never a `##`/`###` section. A single-topic PR stays one block.
- The title goes only in the title field. Never repeat it in the body.

Keep it proportional: a small PR gets a sentence and one bullet, a large one a short paragraph and a handful. Say each thing once, cut process narration, and describe what changed, not how you found or built it.
