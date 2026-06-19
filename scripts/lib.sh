# Shared helpers for the local Supabase dev scripts. Sourced by the other scripts here, never run on its
# own. See docs/development.md for the dev modes these back.

# The shared local stack's URL and publishable key: Supabase CLI shared defaults, identical on every
# machine and not secrets. They are the zero-config target for `npm run dev`.
LOCAL_SUPABASE_URL="http://127.0.0.1:54321"
LOCAL_SUPABASE_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

# The shared stack's fixed project id (supabase/config.toml). Supabase names every container, volume, and
# network "supabase_<service>_<project_id>", so this identifies the shared database's volume.
SHARED_PROJECT="volleycoach"

# dev:migrate spins up throwaway stacks named "<TEMP_PREFIX>_<apiport>"; db:clean tears down anything with
# this prefix and never the shared "volleycoach" stack.
TEMP_PREFIX="volleycoach_mig"

# Has the shared database ever been created? Its volume persists across stops and reboots, so its presence is
# the signal. The exact-match filter ignores stale leftovers like "supabase_db_VolleyCoach".
shared_db_exists() {
  [ -n "$(docker volume ls -q --filter "name=^supabase_db_${SHARED_PROJECT}$" 2>/dev/null)" ]
}

# Ensure the shared stack is up, but NEVER create it: a first `supabase start` applies the current checkout's
# migrations, so creating from a feature branch would bake that branch's schema into the shared database.
# Start it when its volume already exists; otherwise stop and point at `npm run db:reset` (run from main).
ensure_shared_up() {
  if npx supabase status >/dev/null 2>&1; then
    return 0
  fi
  if shared_db_exists; then
    echo "Starting the shared local Supabase stack..."
    npx supabase start
    return 0
  fi
  echo 'No shared local database. Create it first: run `npm run db:reset` on the latest main.' >&2
  return 1
}

# A free loopback TCP port, avoiding any passed as arguments (so several picked ports stay distinct).
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
  echo "could not find a free port" >&2
  return 1
}

# Set by start_temp_stack, read by stop_temp_stack and callers (TEMP_API_PORT for the app/REST URL,
# TEMP_PROJECT_ID for the container name like "supabase_db_<id>"). Empty until a stack is started.
TEMP_WORKDIR=""
TEMP_PROJECT_ID=""
TEMP_API_PORT=""
TEMP_DB_PORT=""

# Build and start a throwaway Supabase stack from THIS branch's migrations and seed. It gets its own project
# id and ports (so it never collides with the shared stack or another temp stack) and the real migrations and
# seed symlinked in, so it is built from exactly what is on this branch. Backs `npm run dev:migrate` (try a
# migration in the app) and `npm run test:rls` (verify this branch's policies). Sets the TEMP_* globals; the
# caller tears it down with stop_temp_stack, normally from a trap set BEFORE calling this.
start_temp_stack() {
  TEMP_API_PORT="$(free_port)"
  TEMP_DB_PORT="$(free_port "$TEMP_API_PORT")"
  local shadow_port
  shadow_port="$(free_port "$TEMP_API_PORT" "$TEMP_DB_PORT")"
  TEMP_PROJECT_ID="${TEMP_PREFIX}_${TEMP_API_PORT}"
  TEMP_WORKDIR="$(mktemp -d)"

  mkdir -p "$TEMP_WORKDIR/supabase"
  ln -s "$(pwd)/supabase/migrations" "$TEMP_WORKDIR/supabase/migrations"
  ln -s "$(pwd)/supabase/seed.sql" "$TEMP_WORKDIR/supabase/seed.sql"
  cat >"$TEMP_WORKDIR/supabase/config.toml" <<EOF
project_id = "${TEMP_PROJECT_ID}"

[api]
enabled = true
port = ${TEMP_API_PORT}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]

[db]
port = ${TEMP_DB_PORT}
shadow_port = ${shadow_port}
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

  echo "Starting temporary stack ${TEMP_PROJECT_ID} (API ${TEMP_API_PORT}, DB ${TEMP_DB_PORT})..."
  npx supabase --workdir "$TEMP_WORKDIR" start
}

# Tear down the stack start_temp_stack created (a no-op if none was started). Safe to call from a trap.
stop_temp_stack() {
  [ -n "$TEMP_WORKDIR" ] || return 0
  echo
  echo "Tearing down temporary stack ${TEMP_PROJECT_ID}..."
  npx supabase --workdir "$TEMP_WORKDIR" stop --no-backup >/dev/null 2>&1 || true
  rm -rf "$TEMP_WORKDIR"
  TEMP_WORKDIR=""
}
