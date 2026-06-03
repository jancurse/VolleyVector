#!/bin/bash
# PreToolUse hook for the `plan` skill.
# Blocks Write/Edit tool calls whose file_path is not under ./plans/.

set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [[ -z "$file_path" ]]; then
  exit 0
fi

abs_file=$(realpath -m "$file_path")
abs_plans=$(realpath -m "./plans")

if [[ "$abs_file" == "$abs_plans"/* ]]; then
  exit 0
fi

jq -n --arg path "$file_path" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: ("Plan mode: Write/Edit is only allowed under ./plans/. Blocked path: " + $path)
  }
}'
