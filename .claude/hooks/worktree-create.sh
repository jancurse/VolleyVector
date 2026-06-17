#!/usr/bin/env bash
# WorktreeCreate hook. Creates the worktree as a sibling of the repo (parallel,
# not nested under .claude/worktrees), sets it up, and shows it in VS Code.
# It replaces Claude Code's default git behaviour, so it must create the worktree
# itself and print ONLY the absolute path on stdout.
set -u

# Hooks don't always inherit the nvm bin dir; make npm/node reachable.
if ! command -v npm >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do
    [ -d "$d" ] && PATH="$d:$PATH"
  done
fi

input=$(cat)
name=$(printf '%s' "$input" | jq -r '.name // .worktreeName // .worktree_name // empty')
repo=$(printf '%s' "$input" | jq -r '.cwd // empty')
[ -n "$repo" ] || repo="${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ -z "$name" ]; then
  echo "worktree-create: missing worktree name in hook input" >&2
  exit 1
fi

dir="$(dirname "$repo")/$name"

# Create the worktree branched off the current HEAD (matches worktree.baseRef:
# "head"), reusing the branch if it already exists. git output goes to stderr.
if [ ! -e "$dir" ]; then
  if git -C "$repo" show-ref --verify --quiet "refs/heads/$name"; then
    git -C "$repo" worktree add "$dir" "$name" >&2 || exit 1
  else
    git -C "$repo" worktree add -b "$name" "$dir" HEAD >&2 || exit 1
  fi
fi

# Pre-approve the playwright MCP server. settings.local.json is untracked, so a
# fresh worktree lacks it; copy the main checkout's if present.
if [ ! -f "$dir/.claude/settings.local.json" ]; then
  mkdir -p "$dir/.claude"
  if [ -f "$repo/.claude/settings.local.json" ]; then
    cp "$repo/.claude/settings.local.json" "$dir/.claude/settings.local.json"
  else
    printf '%s\n' '{ "enabledMcpjsonServers": ["playwright"] }' >"$dir/.claude/settings.local.json"
  fi
fi

# Add the worktree to its feature's VS Code workspace. The feature folder holds
# the clone and all its worktrees side by side; a named .code-workspace there is
# the one window that shows them. Editing that file targets the right window
# deterministically, unlike `code --add`, which only ever hits the active window.
feature="$(dirname "$repo")"
wsfile="$feature/$(basename "$feature").code-workspace"
if [ -f "$wsfile" ]; then
  # Append the worktree folder if absent; VS Code live-updates the open window.
  tmp="$(mktemp)"
  if jq --arg wt "$name" \
    'if any(.folders[]?; .path == $wt) then . else .folders += [{path: $wt}] end' \
    "$wsfile" >"$tmp" 2>/dev/null; then
    mv "$tmp" "$wsfile"
  else
    rm -f "$tmp"
  fi
else
  # First worktree for this feature: seed the workspace with the clone first,
  # then the worktree, and open it so the feature lives in this one window.
  jq -n --arg clone "$(basename "$repo")" --arg wt "$name" \
    '{folders: [{path: $clone}, {path: $wt}], settings: {}}' >"$wsfile"
  if command -v code >/dev/null 2>&1; then
    nohup code "$wsfile" >/dev/null 2>&1 </dev/null &
    disown 2>/dev/null || true
  fi
fi

# Install dependencies in the background so creation stays fast and never trips
# the hook timeout. Output is discarded so no setup log clutters the worktree.
if [ ! -d "$dir/node_modules" ] && command -v npm >/dev/null 2>&1; then
  nohup npm --prefix "$dir" install >/dev/null 2>&1 </dev/null &
  disown 2>/dev/null || true
fi

# stdout MUST contain only the worktree path.
printf '%s\n' "$dir"
