#!/usr/bin/env bash
# Codzienny zaszyfrowany backup (uruchamiany przez systemd: cfo-backup.timer).
# Gdy istnieje /srv/cfo/secrets/rclone.conf — dodatkowo wysyla kopie na Google Drive.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RCLONE_CONF="${CFO_SECRETS_DIR:-/srv/cfo/secrets}/rclone.conf"
COMPOSE=(docker compose --env-file "$REPO_DIR/.env" -f "$REPO_DIR/deploy/docker-compose.vps.yml")

if [[ -f "$RCLONE_CONF" ]]; then
  # Token Google trafia tylko do jednorazowego kontenera, nie do dzialajacej aplikacji.
  # Plik musi byc czytelny dla uid 1000 (wlasciciel = operator `ubuntu`, chmod 600).
  exec "${COMPOSE[@]}" run --rm --no-deps \
    -v "$RCLONE_CONF:/run/secrets/rclone.conf:ro" \
    -e RCLONE_CONFIG=/run/secrets/rclone.conf \
    app npm run --silent backup:google-drive
fi

exec "${COMPOSE[@]}" run --rm --no-deps app npm run --silent backup:scheduled
