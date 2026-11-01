#!/usr/bin/env bash
# Wrapper na docker compose dla wdrozenia VPS — zawsze z wlasciwym .env i plikiem compose.
#   deploy/oci/compose.sh ps
#   deploy/oci/compose.sh logs -f app
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec docker compose --env-file "$REPO_DIR/.env" -f "$REPO_DIR/deploy/docker-compose.vps.yml" "$@"
