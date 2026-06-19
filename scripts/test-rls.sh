#!/usr/bin/env bash
# `npm run test:rls` — run the RLS policy regression test against a local database, exactly as CI does.
# Brings the shared local stack up if needed, then runs the SQL test inside the database container (it is
# fully transactional — begin/rollback — so it leaves the data untouched) and reports pass or fail.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

ensure_shared_up

# project_id is "volleycoach" (supabase/config.toml), so the database container is named like this here and
# in CI. Running through docker exec avoids needing a host psql install.
echo "Running RLS policy tests..."
docker exec -i supabase_db_volleycoach \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <supabase/tests/rls_policies_test.sql
echo "RLS tests passed."
