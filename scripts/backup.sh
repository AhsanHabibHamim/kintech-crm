#!/usr/bin/env bash
set -euo pipefail

# MongoDB JSON dump for the KinTech CRM (source of truth).
# Cron example (daily 01:00): 0 1 * * * cd /path/to/kintech-crm && ./scripts/backup.sh >> /var/log/kintech-backup.log 2>&1

DATE=$(date +%F-%H%M)
DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$DIR"

MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017}"
MONGODB_NAME="${MONGODB_NAME:-kintech_crm}"

node scripts/mongo-backup.mjs "$MONGODB_URI" "$MONGODB_NAME" "$DIR/kintech-$DATE.json.gz"

# Keep the latest 30 dumps (a month of nightly runs)
ls -1t "$DIR"/kintech-*.json.gz 2>/dev/null | tail -n +31 | xargs -r rm -f

echo "[backup] $DIR/kintech-$DATE.json.gz ($(du -h "$DIR/kintech-$DATE.json.gz" | cut -f1))"