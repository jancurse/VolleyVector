#!/usr/bin/env bash
# `npm run dev:migrate` — run Vite against a throwaway Supabase stack built from THIS branch's migrations.
# Fully self-managing: it picks free ports, starts an isolated stack (its own project id and ports, so it
# never collides with the shared stack or with another dev:migrate run), runs Vite, and tears the stack
# down on exit. Use it to try migrations before they merge; `npm run dev` stays on main's schema.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

# A free loopback TCP port, avoiding any passed as arguments (so the three ports below stay distinct).
free_port() {
  local excluded=" $* " p tries=0
  while [ "$tries" -lt 100 ]; do
    tries=$((tries + 1))
    p=$((54400 + RANDOM % 1000))
    case "$excluded" in *" $p "*) continue ;; esac
    if ! (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then
      printf '%s' "$p"
      return 0
    fi
  done
  echo "dev:migrate: could not find a free port" >&2
  return 1
}

API_PORT="$(free_port)"
DB_PORT="$(free_port "$API_PORT")"
SHADOW_PORT="$(free_port "$API_PORT" "$DB_PORT")"
PROJECT_ID="${TEMP_PREFIX}_${API_PORT}"
WORKDIR="$(mktemp -d)"

cleanup() {
  echo
  echo "Tearing down temporary stack ${PROJECT_ID}..."
  npx supabase --workdir "$WORKDIR" stop --no-backup >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT INT TERM

# A throwaway supabase project: a generated config with this run's id and ports, and the real migrations
# and seed symlinked in, so the temp database is built from exactly what is on this branch.
mkdir -p "$WORKDIR/supabase"
ln -s "$(pwd)/supabase/migrations" "$WORKDIR/supabase/migrations"
ln -s "$(pwd)/supabase/seed.sql" "$WORKDIR/supabase/seed.sql"
cat >"$WORKDIR/supabase/config.toml" <<EOF
project_id = "${PROJECT_ID}"

[api]
enabled = true
port = ${API_PORT}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]

[db]
port = ${DB_PORT}
shadow_port = ${SHADOW_PORT}
major_version = 17

[db.seed]
enabled = true
sql_paths = ["./seed.sql"]

[auth]
enabled = true
site_url = "http://127.0.0.1:5173"
additional_redirect_urls = ["http://127.0.0.1:5173", "http://localhost:5173"]
minimum_password_length = 6

[auth.email]
enable_confirmations = false

[studio]
enabled = false

[realtime]
enabled = false

[storage]
enabled = false

[inbucket]
enabled = false

[edge_runtime]
enabled = false

[analytics]
enabled = false
EOF

echo "Starting temporary stack ${PROJECT_ID} (API ${API_PORT}, DB ${DB_PORT})..."
npx supabase --workdir "$WORKDIR" start

export VITE_SUPABASE_URL="http://127.0.0.1:${API_PORT}"
export VITE_SUPABASE_PUBLISHABLE_KEY="$LOCAL_SUPABASE_KEY"
# Not exec'd, so the cleanup trap runs when Vite exits.
npx vite "$@"
