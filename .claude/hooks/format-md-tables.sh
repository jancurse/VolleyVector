#!/usr/bin/env bash
# Align Markdown tables in the given files, in place. Idempotent: a file whose
# tables are already aligned is left byte-for-byte unchanged.
#
# Used as a pre-commit "local" hook. If this changes any staged file, the
# pre-commit framework aborts the commit so the change can be reviewed.
set -u

# Make the npm-global CLI reachable even if PATH lacks the nvm bin dir.
if ! command -v markdown-table-prettify >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do
    [ -d "$d" ] && PATH="$d:$PATH"
  done
fi

for f in "$@"; do
  [ -f "$f" ] || continue
  tmp=$(mktemp)
  if markdown-table-prettify <"$f" >"$tmp"; then
    printf '\n' >>"$tmp" # markdown-table-prettify drops the trailing newline
    cmp -s "$f" "$tmp" || cp "$tmp" "$f"
  fi
  rm -f "$tmp"
done
