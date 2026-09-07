#!/usr/bin/env bash
set -euo pipefail

# Restores a WMS PostgreSQL backup into the running Docker Compose stack.
#
# By default this restores into a scratch database (wms_restore_check) so you
# can verify a backup is actually restorable without touching the live
# database. Pass --target live to deliberately overwrite the live database
# (e.g. during an actual disaster recovery) — this is destructive and asks for
# confirmation.
#
# Usage:
#   ./scripts/restore.sh backups/wms_20260101_020000.dump                # verify-only, safe
#   ./scripts/restore.sh backups/wms_20260101_020000.dump --target live  # DESTRUCTIVE

cd "$(dirname "$0")/.."

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file-in-backups/> [--target live]" >&2
  exit 1
fi

BACKUP_FILE="$1"
TARGET="verify"
if [ "${2:-}" = "--target" ] && [ "${3:-}" = "live" ]; then
  TARGET="live"
fi

BACKUP_BASENAME="$(basename "$BACKUP_FILE")"
if [ ! -f "backups/${BACKUP_BASENAME}" ]; then
  echo "ERROR: backups/${BACKUP_BASENAME} not found." >&2
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
POSTGRES_USER="${POSTGRES_USER:-wms}"
POSTGRES_DB="${POSTGRES_DB:-wms}"

if [ "$TARGET" = "live" ]; then
  echo "WARNING: this will DROP and REPLACE the live '${POSTGRES_DB}' database with the contents of ${BACKUP_BASENAME}."
  read -r -p "Type the database name (${POSTGRES_DB}) to confirm: " CONFIRM
  if [ "$CONFIRM" != "$POSTGRES_DB" ]; then
    echo "Confirmation did not match. Aborting."
    exit 1
  fi
  RESTORE_DB="$POSTGRES_DB"
else
  RESTORE_DB="wms_restore_check"
  echo "Restoring into scratch database '${RESTORE_DB}' for verification (live DB is untouched)..."
fi

docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\";"
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"${RESTORE_DB}\";"
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DB" --no-owner --no-privileges "/backups/${BACKUP_BASENAME}"

echo "Restore complete into '${RESTORE_DB}'. Running verification checks..."
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -c "
  SELECT
    (SELECT count(*) FROM users) AS users,
    (SELECT count(*) FROM items) AS items,
    (SELECT count(*) FROM inventory_balances) AS inventory_balances,
    (SELECT count(*) FROM inventory_transactions) AS inventory_transactions,
    (SELECT count(*) FROM audit_logs) AS audit_logs;
"

if [ "$TARGET" = "verify" ]; then
  echo
  echo "Verification-only restore into '${RESTORE_DB}'. The live database was not touched."
  echo "Compare the counts above against the live database to confirm the backup is sound."
  echo "To drop the scratch database: docker compose exec postgres psql -U ${POSTGRES_USER} -d postgres -c 'DROP DATABASE \"${RESTORE_DB}\";'"
  echo "To restore over the live database instead, re-run with: $0 ${BACKUP_FILE} --target live"
else
  echo "Live database '${RESTORE_DB}' has been replaced from ${BACKUP_BASENAME}."
  echo "Restart the backend so it reconnects cleanly: docker compose restart backend"
fi
