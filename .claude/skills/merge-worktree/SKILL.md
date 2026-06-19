---
name: merge-worktree
description: Integrate the current worktree into its feature branch and close it — commit, rebase, fast-forward merge, then remove the worktree folder (keeping the branch). Use when the user is done with a worktree session and wants it folded into the feature branch.
---

# Merge Worktree Skill

Integrate the current worktree into its feature branch and close it. Invoking this skill is the user's explicit request to perform the git writes below.

## Preconditions

- You must be inside a worktree, on a branch named `<issue>-worktree-<slug>`. If the current branch has no `-worktree-` segment, stop: this is a feature checkout, not a worktree, and there is nothing to integrate.
- Find the feature branch and its checkout path from `git worktree list`. The feature branch shares the worktree's issue number but has no `-worktree-` segment (e.g. off `16-worktree-reliable-saves` the feature is `16-initial-fixes`). Match on the leading `<issue>-` and pick the entry without `-worktree-`.

## Steps

1. **Commit the work.** Stage everything and commit following the `commit` skill. If the tree is already clean with nothing to commit, skip to the rebase.

2. **Rebase onto the feature branch.** In the worktree: `git rebase <feature>`. If the rebase stops on a conflict that is trivial, resolve it, continue the rebase, and note it in your final message. Otherwise do not improvise: report the conflict and ask the user how to proceed.

3. **Fast-forward the feature branch.** `git -C <feature-checkout> merge --ff-only <worktree-branch>`. After a clean rebase this fast-forwards. If `--ff-only` is refused, the rebase did not finish — finish it, never fall back to a merge commit.

4. **Remove the worktree.** Use the `ExitWorktree` tool with `action: "remove"`. It warns it "could not verify" the worktree because it checks the branch against its original base, not the feature tip. Once the tips agree (they do after steps 2–3), that warning is expected and safe: re-invoke `ExitWorktree` with `discard_changes: true`. The remove hook keeps the branch as a backup and discards only the folder, and refuses on a dirty tree. Confirm the folder is gone afterwards (`git worktree list`).

## Finish

End your final message with a `result:` line so the agents overview shows the session as finished and integrated, for example:

result: worktree 16-worktree-reliable-saves integrated into 16-initial-fixes and closed
