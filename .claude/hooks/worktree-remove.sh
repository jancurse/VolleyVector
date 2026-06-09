#!/usr/bin/env bash
# WorktreeRemove hook. De-registers the worktree from VS Code and removes it.
# Replaces default git behaviour; Claude ignores the output and exit code.
set -u

input=$(cat)
dir=$(printf '%s' "$input" | jq -r '.worktree_path // .worktreePath // .path // empty')
repo=$(printf '%s' "$input" | jq -r '.cwd // empty')
[ -n "$repo" ] || repo="${CLAUDE_PROJECT_DIR:-$(pwd)}"

[ -n "$dir" ] || exit 0

# Drop it from the VS Code window (best effort).
if command -v code >/dev/null 2>&1; then
  code --remove "$dir" >/dev/null 2>&1 || true
fi

# Remove only when nothing but our own setup artifacts (and ignored files like
# node_modules) are present, so real uncommitted work is never discarded. The
# branch is left in place.
changes=$(git -C "$dir" status --porcelain 2>/dev/null \
  | grep -vE '^\?\? \.claude/settings\.local\.json$' || true)
if [ -z "$changes" ]; then
  git -C "$repo" worktree remove --force "$dir" >&2 2>&1 || true
else
  echo "worktree-remove: $dir has uncommitted changes; left in place" >&2
fi
git -C "$repo" worktree prune >/dev/null 2>&1 || true
exit 0
