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
