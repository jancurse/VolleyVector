# Shared helpers for the local Supabase dev scripts. Sourced by the other scripts here, never run on its
# own. See docs/development.md for the dev modes these back.

# The shared local stack's URL and publishable key: Supabase CLI shared defaults, identical on every
# machine and not secrets. They are the zero-config target for `npm run dev`.
LOCAL_SUPABASE_URL="http://127.0.0.1:54321"
LOCAL_SUPABASE_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

# dev:migrate spins up throwaway stacks named "<TEMP_PREFIX>_<apiport>"; db:clean tears down anything with
# this prefix and never the shared "volleycoach" stack.
TEMP_PREFIX="volleycoach_mig"

# Start the shared local stack only if it is not already running. `supabase status` exits non-zero when the
# stack is down and returns in well under a second when it is up, so this stays fast on every `npm run dev`.
ensure_shared_up() {
  if npx supabase status >/dev/null 2>&1; then
    return 0
  fi
  echo "Starting the shared local Supabase stack (the first run downloads Docker images)..."
  npx supabase start
}
