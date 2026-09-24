#!/bin/bash
# Nocny backup Postgresa. Pod CasaOS dodaj jako Scheduled Task / cron: 0 2 * * *
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
mkdir -p backups
STAMP=$(date +%F_%H-%M)
# hasło bazy z .env (DB_PASSWORD) — kontener db nazywa się <folder>-db-1
docker compose exec -T db pg_dump -U dsm dsm | gzip > "backups/dsm_${STAMP}.sql.gz"
# trzymaj 30 ostatnich
ls -t backups/dsm_*.sql.gz | tail -n +31 | xargs -r rm --
echo "OK: backups/dsm_${STAMP}.sql.gz"
echo "Kopię zgrywaj też poza terminal (pendrive / rclone na Drive)."
