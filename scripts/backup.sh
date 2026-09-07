#!/usr/bin/env bash
set -euo pipefail

# Backs up the WMS PostgreSQL database from the running Docker Compose stack.
# Usage: ./scripts/backup.sh [--retention-days N]
#
# Writes a timestamped custom-format pg_dump archive to ./backups/, which is
# bind-mounted into the postgres container at /backups. Safe to run from cron —
# see docs/backup-restore.md for the scheduling example and the restore
# verification procedure.

cd "$(dirname "$0")/.."

RETENTION_DAYS=30
while [[ $# -gt 0 ]]; do
  case "$1" in
    --retention-days) RETENTION_DAYS="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-wms}"
POSTGRES_DB="${POSTGRES_DB:-wms}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="wms_${TIMESTAMP}.dump"

mkdir -p backups

echo "Backing up database '${POSTGRES_DB}' to backups/${FILENAME} ..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc --compress=9 -f "/backups/${FILENAME}"

SIZE=$(docker compose exec -T postgres stat -c%s "/backups/${FILENAME}" 2>/dev/null | tr -d '\r' || echo 0)
if [ -z "${SIZE}" ] || [ "${SIZE}" -lt 1000 ]; then
  echo "ERROR: backup file is suspiciously small (${SIZE:-0} bytes) — treating as failed." >&2
  exit 1
fi
echo "Backup complete: backups/${FILENAME} (${SIZE} bytes)"

if [ "${RETENTION_DAYS}" -gt 0 ]; then
  echo "Pruning backups older than ${RETENTION_DAYS} days..."
  find backups -name 'wms_*.dump' -mtime "+${RETENTION_DAYS}" -print -delete
fi
