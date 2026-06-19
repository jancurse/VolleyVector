#!/usr/bin/env bash
# `npm run db:reset` — create or rebuild the shared local database from the CURRENT branch's migrations and
# seed. Run it from `main`: that holds the shared stack at main's schema, the everyday `npm run dev` target,
# and re-running it from main picks up migrations merged since. (From a feature branch it rebuilds to that
# branch's schema, which `npm run dev` then uses until the next reset.) This is the one command allowed to
# create the shared stack; `npm run dev` only starts an existing one.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

# Create the stack on first run (this also downloads the Docker images), or just ensure it is up; then
# `supabase db reset` rebuilds the database from the migrations and seed in this checkout.
if ! npx supabase status >/dev/null 2>&1; then
  echo "Starting the local Supabase stack (the first run downloads Docker images)..."
  npx supabase start
fi
npx supabase db reset