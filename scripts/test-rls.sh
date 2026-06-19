#!/usr/bin/env bash
# `npm run test:rls` — run the RLS policy regression test against a throwaway database built from THIS
# branch's migrations and seed, then tear it down. Building fresh from the branch (not the shared stack,
# which holds main's schema) is the point: it verifies this branch's policies, functions, and migrations
# before they merge. The SQL test is transactional (begin/rollback), so it leaves the database untouched
# even before the teardown. This is exactly what CI runs.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

trap stop_temp_stack EXIT INT TERM
start_temp_stack

# Supabase names the database container "supabase_db_<project_id>". Running psql through docker exec avoids
# needing a host psql install.
echo "Running RLS policy tests..."
docker exec -i "supabase_db_${TEMP_PROJECT_ID}" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <supabase/tests/rls_policies_test.sql
echo "RLS tests passed."
