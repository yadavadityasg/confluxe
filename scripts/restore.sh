#!/usr/bin/env bash
# Restore from a backup pair produced by backup.sh.
# Usage:  ./restore.sh /var/backups/wikispace/db-<TS>.sql.gz /var/backups/wikispace/storage-<TS>.tar.gz
set -euo pipefail

DB_DUMP="${1:?path to db-*.sql.gz required}"
STORAGE_TAR="${2:?path to storage-*.tar.gz required}"
STACK_DIR="${STACK_DIR:-/opt/wikispace}"

cd "$STACK_DIR"

echo "[restore] restoring database from $DB_DUMP..."
gunzip -c "$DB_DUMP" | docker compose exec -T db psql -U postgres -d postgres

echo "[restore] restoring storage from $STORAGE_TAR..."
docker compose stop storage
docker run --rm -v wikispace_storage-data:/data -v "$(dirname "$STORAGE_TAR")":/in alpine \
  sh -c "rm -rf /data/* && tar -xzf /in/$(basename "$STORAGE_TAR") -C /data"
docker compose start storage

echo "[restore] done."
