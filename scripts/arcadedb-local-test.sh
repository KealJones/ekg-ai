#!/usr/bin/env bash
set -euo pipefail
: "${ARCADEDB_HOME:?Set ARCADEDB_HOME to an extracted ArcadeDB distribution}"
export ARCADEDB_URL="${ARCADEDB_URL:-http://127.0.0.1:2480}"
export ARCADEDB_PASSWORD="${ARCADEDB_PASSWORD:-ekg-local-test-password}"
export ARCADEDB_DATABASE="${ARCADEDB_DATABASE:-ekg_test}"
export ARCADEDB_OPTS_MEMORY="${ARCADEDB_OPTS_MEMORY:--Xms128m -Xmx256m}"
export JAVA_OPTS="${JAVA_OPTS:-} -Darcadedb.server.rootPassword=${ARCADEDB_PASSWORD} -Darcadedb.server.mode=test"
"$ARCADEDB_HOME/bin/server.sh" > /tmp/ekg-arcadedb.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -fsS -u "root:${ARCADEDB_PASSWORD}" "$ARCADEDB_URL/api/v1/health" >/dev/null && break; sleep .5; done
# Create db if missing.
if ! curl -fsS -u "root:${ARCADEDB_PASSWORD}" "$ARCADEDB_URL/api/v1/exists/${ARCADEDB_DATABASE}" | grep -q true; then
  curl -fsS -u "root:${ARCADEDB_PASSWORD}" -H 'Content-Type: application/json' -X POST "$ARCADEDB_URL/api/v1/server" -d "{\"command\":\"create database ${ARCADEDB_DATABASE}\"}" >/dev/null
fi
npm run test:arcade:integration
