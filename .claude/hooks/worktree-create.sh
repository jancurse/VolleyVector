#!/usr/bin/env bash
# WorktreeCreate hook. Creates the worktree as a sibling of the repo (parallel,
# not nested under .claude/worktrees), sets it up, and registers it in the
# feature's VS Code workspace file.
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

# If the feature has no saved workspace yet, save one now, listing the clone and
# every existing worktree so nothing already open is dropped. The worktree just
# created above is already in `git worktree list`, so this seed includes it. We
# deliberately never run `code` to open it: that spawns a second window instead of
# updating the one already open. Open the workspace once; edits then live-update.
if [ ! -f "$wsfile" ]; then
  folders=()
  while IFS= read -r wt; do
    [ "$(dirname "$wt")" = "$feature" ] && folders+=("$(basename "$wt")")
  done < <(git -C "$repo" worktree list --porcelain | sed -n 's/^worktree //p')
  jq -n '$ARGS.positional | {folders: map({path: .}), settings: {}}' \
    --args "${folders[@]}" >"$wsfile"
fi

# Ensure the new worktree is listed (covers the already-saved case; a no-op when
# the seed above just added it). VS Code live-updates the open window.
tmp="$(mktemp)"
if jq --arg wt "$name" \
  'if any(.folders[]?; .path == $wt) then . else .folders += [{path: $wt}] end' \
  "$wsfile" >"$tmp" 2>/dev/null; then
  mv "$tmp" "$wsfile"
else
  rm -f "$tmp"
fi

# Install dependencies in the background so creation stays fast and never trips
# the hook timeout. Output is discarded so no setup log clutters the worktree.
if [ ! -d "$dir/node_modules" ] && command -v npm >/dev/null 2>&1; then
  nohup npm --prefix "$dir" install >/dev/null 2>&1 </dev/null &
  disown 2>/dev/null || true
fi

# stdout MUST contain only the worktree path.
printf '%s\n' "$dir"
