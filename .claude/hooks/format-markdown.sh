#!/usr/bin/env bash
# PostToolUse hook: align Markdown tables, then apply markdownlint fixes,
# for Markdown files Claude Code writes. Receives the tool-call JSON on stdin.
#
# Table formatter runs first (it strips the final newline); markdownlint runs
# second and restores it via MD047.
set -u

# Make the npm-global CLIs reachable even if PATH lacks the nvm bin dir.
if ! command -v markdown-table-prettify >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do
    [ -d "$d" ] && PATH="$d:$PATH"
  done
fi

file=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
case "$file" in
  *.md) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

tmp=$(mktemp)
if markdown-table-prettify <"$file" >"$tmp"; then
  mv "$tmp" "$file"
else
  rm -f "$tmp"
fi
markdownlint-cli2 --fix "$file" >/dev/null 2>&1 || true
exit 0
