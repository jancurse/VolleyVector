#!/usr/bin/env bash
# `npm run db:clean` — tear down stray dev:migrate stacks (a run that crashed before its own cleanup can
# leave one behind). The shared "volleycoach" stack is never touched: Supabase names every container,
# volume, and network "supabase_<service>_<project_id>", and only the temp prefix is matched.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

echo "Removing leftover dev:migrate stacks (prefix ${TEMP_PREFIX})..."
docker ps -aq --filter "name=${TEMP_PREFIX}_" | xargs -r docker rm -f >/dev/null 2>&1 || true
docker volume ls -q --filter "name=${TEMP_PREFIX}_" | xargs -r docker volume rm -f >/dev/null 2>&1 || true
docker network ls -q --filter "name=${TEMP_PREFIX}_" | xargs -r docker network rm >/dev/null 2>&1 || true
echo "Done."
