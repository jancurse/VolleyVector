#!/usr/bin/env bash
# `npm run dev` — run Vite against the shared local Supabase stack, bringing it up first if needed.
# The stack holds main's schema; the developer manages no database lifecycle.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

ensure_shared_up

export VITE_SUPABASE_URL="$LOCAL_SUPABASE_URL"
export VITE_SUPABASE_PUBLISHABLE_KEY="$LOCAL_SUPABASE_KEY"
exec npx vite "$@"
