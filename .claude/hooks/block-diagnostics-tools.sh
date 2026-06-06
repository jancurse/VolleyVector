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

# The trailing class requires the token to be at a command position (followed by whitespace, a shell
# separator, or end) so a real invocation matches but a filename like `eslint.config.js` does not.
if printf '%s' "$cmd" | grep -qE "(^|[^[:alnum:]_-])(${pattern})([[:space:]<>;&|)]|$)"; then
  jq -n --arg reason "$REMINDER" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
fi
