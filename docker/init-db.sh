#!/bin/bash
# Runs once on first DB init. Applies our schema migrations after Supabase's
# own bootstrap scripts have created the auth/storage roles.
set -euo pipefail

echo "[init-db] enabling extensions..."
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- storage schema for supabase/storage-api
CREATE SCHEMA IF NOT EXISTS storage;
SQL

echo "[init-db] applying app migrations..."
for f in /docker-entrypoint-initdb.d/migrations/*.sql; do
  echo "  -> $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done
echo "[init-db] done."
