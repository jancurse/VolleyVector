#!/usr/bin/env bash
# `npm run dev:migrate` — run Vite against a throwaway Supabase stack built from THIS branch's migrations.
# Fully self-managing: start_temp_stack builds an isolated stack (its own project id and ports, so it never
# collides with the shared stack or another dev:migrate run), then this runs Vite against it and tears the
# stack down on exit. Use it to try migrations before they merge; `npm run dev` stays on main's schema.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

trap stop_temp_stack EXIT INT TERM
start_temp_stack

export VITE_SUPABASE_URL="http://127.0.0.1:${TEMP_API_PORT}"
export VITE_SUPABASE_PUBLISHABLE_KEY="$LOCAL_SUPABASE_KEY"
# Not exec'd, so the cleanup trap runs when Vite exits.
npx vite "$@"
