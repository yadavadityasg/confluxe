#!/usr/bin/env bash
# Nightly backup: Postgres dump + Storage tarball, kept 14 days.
# Install via host cron:  0 3 * * * /opt/confluxe/backup.sh >> /var/log/confluxe-backup.log 2>&1
set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/confluxe}"
OUT_DIR="${OUT_DIR:-/var/backups/confluxe}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TS=$(date -u +%Y%m%dT%H%M%SZ)

mkdir -p "$OUT_DIR"
cd "$STACK_DIR"

echo "[backup] $TS  pg_dump..."
docker compose exec -T db pg_dump -U postgres --no-owner --clean --if-exists postgres \
  | gzip -9 > "$OUT_DIR/db-$TS.sql.gz"

echo "[backup] $TS  storage tarball..."
docker run --rm -v confluxe_storage-data:/data -v "$OUT_DIR":/out alpine \
  tar -czf "/out/storage-$TS.tar.gz" -C /data .

echo "[backup] pruning > $KEEP_DAYS days..."
find "$OUT_DIR" -type f -name '*.gz' -mtime +"$KEEP_DAYS" -delete

echo "[backup] done -> $OUT_DIR"
