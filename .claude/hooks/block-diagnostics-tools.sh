#!/usr/bin/env bash
# PreToolUse hook: block direct invocations of dev tools that the diagnostics
# skill wraps. Matches bare, `npx`, `node_modules/.bin/`, `pnpm`, `yarn`, etc.

BLOCKED=(
  tsc
  eslint
  prettier
)

REMINDER="Please use the diagnostics skill for diagnostics. Run only the commands it prescribes (e.g. npm run format / lint / typecheck / build)."

cmd=$(jq -r '.tool_input.command // ""')
pattern=$(IFS='|'; echo "${BLOCKED[*]}")

if printf '%s' "$cmd" | grep -qE "(^|[^[:alnum:]_-])(${pattern})([^[:alnum:]_-]|$)"; then
  jq -n --arg reason "$REMINDER" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
fi
