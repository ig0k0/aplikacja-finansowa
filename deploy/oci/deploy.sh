#!/usr/bin/env bash
# Wdrozenie / aktualizacja aplikacji na VM (po deploy/oci/harden.sh).
# Uruchom jako operator (NIE root), z katalogu repozytorium, np. /srv/cfo/app:
#   bash deploy/oci/deploy.sh                    # domena <ip>.sslip.io (bez wlasnej domeny)
#   bash deploy/oci/deploy.sh finanse.mojadomena.pl
#
# Pierwsze uruchomienie: generuje .env z losowymi sekretami, buduje obraz, tworzy
# 2 konta z losowymi haslami (zapis w /srv/cfo/secrets/initial-credentials.txt),
# uruchamia app + Caddy (HTTPS z Let's Encrypt).
# Kolejne uruchomienia: zaszyfrowany backup -> rebuild -> restart -> health check.
set -euo pipefail

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -ne 0 ]] || die "Nie uruchamiaj jako root. Uzyj konta operatora (np. ubuntu)."

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_DIR/.env"
SECRETS_DIR="${CFO_SECRETS_DIR:-/srv/cfo/secrets}"
BACKUP_DIR="${CFO_BACKUP_DIR:-/srv/cfo/backups}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$REPO_DIR/deploy/docker-compose.vps.yml")

docker info >/dev/null 2>&1 || die "Brak dostepu do Dockera. Uruchom sudo bash deploy/oci/harden.sh, wyloguj sie i zaloguj ponownie."
[[ -d "$SECRETS_DIR" && -w "$SECRETS_DIR" ]] || die "Brak $SECRETS_DIR (tworzy go harden.sh)."
[[ -d "$BACKUP_DIR" ]] || die "Brak $BACKUP_DIR (tworzy go harden.sh)."

rand() { openssl rand -hex "${1:-32}"; }
rand_password() { openssl rand -base64 24 | tr -d '/+=' | cut -c1-20; }
env_get() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
env_set() {
  if grep -qE "^$1=" "$ENV_FILE"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$1" "$2" >>"$ENV_FILE"
  fi
}

public_ip() {
  curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null \
    || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null \
    || true
}

# ---------------------------------------------------------------- .env
umask 077
if [[ ! -f "$ENV_FILE" ]]; then
  log "Tworze $ENV_FILE z losowymi sekretami"
  cat >"$ENV_FILE" <<EOF
# Wygenerowane przez deploy/oci/deploy.sh $(date -Iseconds). NIE commituj tego pliku.
SESSION_SECRET=$(rand 48)
BACKUP_ENCRYPTION_KEY=$(rand 32)
BACKUP_RETENTION_DAYS=14
CFO_BACKUP_DIR=$BACKUP_DIR
COOKIE_SECURE=1
TRUST_PROXY=1
FORCE_HSTS=1
LOGIN_RATE_LIMIT_MAX=8
AI_MODE=disabled
# Google Drive (opcjonalnie, patrz deploy/oci/README.md):
# GOOGLE_DRIVE_RCLONE_REMOTE=cfo-drive
# GOOGLE_DRIVE_RCLONE_PATH=centrum-finansow/backup
EOF
fi
chmod 600 "$ENV_FILE"

for key in SESSION_SECRET BACKUP_ENCRYPTION_KEY; do
  value="$(env_get "$key")"
  if [[ -z "$value" || "$value" == change-me* || ${#value} -lt 32 ]]; then
    die "$key w .env jest pusty, domyslny albo za krotki. Ustaw losowy: openssl rand -hex 32"
  fi
done
[[ -n "$(env_get CFO_BACKUP_DIR)" ]] || env_set CFO_BACKUP_DIR "$BACKUP_DIR"

DOMAIN="${1:-$(env_get CFO_DOMAIN)}"
if [[ -z "$DOMAIN" ]]; then
  IP="$(public_ip)"
  [[ -n "$IP" ]] || die "Nie ustalono publicznego IP. Podaj domene: bash deploy/oci/deploy.sh twoja.domena.pl"
  DOMAIN="${IP//./-}.sslip.io"
  warn "Brak wlasnej domeny — uzywam $DOMAIN (darmowy DNS wskazujacy na $IP)."
fi
env_set CFO_DOMAIN "$DOMAIN"

# Kontrola DNS: domena musi wskazywac na te maszyne, inaczej Let's Encrypt odmowi.
IP="${IP:-$(public_ip)}"
RESOLVED="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
if [[ -n "$IP" && "$RESOLVED" != "$IP" ]]; then
  warn "DNS: $DOMAIN -> '${RESOLVED:-brak}', a publiczne IP tej VM to $IP. Popraw rekord A, inaczej HTTPS nie wystartuje."
fi

# ---------------------------------------------------------------- backup przed aktualizacja
if docker volume inspect cfo_app-data >/dev/null 2>&1; then
  log "Istniejaca instalacja — zaszyfrowany backup przed aktualizacja"
  if "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx app; then
    "${COMPOSE[@]}" exec -T app npm run --silent backup:create \
      || die "Backup nie powiodl sie — przerywam aktualizacje."
  else
    warn "Kontener app nie dziala — pomijam backup przed aktualizacja."
  fi
fi

# ---------------------------------------------------------------- build
APP_IMAGE="$(env_get CFO_IMAGE)"
if [[ -n "$APP_IMAGE" ]]; then
  log "Pobieranie gotowego obrazu $APP_IMAGE"
  "${COMPOSE[@]}" pull app \
    || die "Nie udalo sie pobrac obrazu. Sprawdz: docker login ghcr.io (patrz deploy/oci/README.md)."
else
  APP_IMAGE="cfo-app:latest"
  log "Budowanie obrazu aplikacji lokalnie (na malej VM moze trwac bardzo dlugo — rozwaz CFO_IMAGE)"
  "${COMPOSE[@]}" build --pull app
fi

# Wolumen utworzony przez wczesniejsza wersje (proces jako root) — napraw wlasciciela.
if docker volume inspect cfo_app-data >/dev/null 2>&1; then
  docker run --rm --user 0 -v cfo_app-data:/app/data --entrypoint chown "$APP_IMAGE" -R 1000:1000 /app/data
fi

# ---------------------------------------------------------------- seed (tylko raz)
SEED_MARKER="$SECRETS_DIR/.seeded"
if [[ ! -f "$SEED_MARKER" ]]; then
  log "Pierwsze uruchomienie — tworze 2 konta uzytkownikow"
  default1="$(env_get SEED_USER_1_LOGIN)"; default1="${default1:-igor}"
  default2="$(env_get SEED_USER_2_LOGIN)"; default2="${default2:-user2}"
  if [[ -t 0 ]]; then
    read -r -p "Login uzytkownika 1 [$default1]: " in1 || true
    read -r -p "Login uzytkownika 2 [$default2]: " in2 || true
  fi
  export SEED_USER_1_LOGIN="${in1:-$default1}" SEED_USER_1_DISPLAY_NAME="${in1:-$default1}"
  export SEED_USER_2_LOGIN="${in2:-$default2}" SEED_USER_2_DISPLAY_NAME="${in2:-$default2}"
  export SEED_USER_1_PASSWORD="$(rand_password)" SEED_USER_2_PASSWORD="$(rand_password)"

  # Hasla przekazywane przez srodowisko (-e NAZWA bez wartosci), nie w argumentach procesu.
  "${COMPOSE[@]}" run --rm --no-deps \
    -e SEED_USER_1_LOGIN -e SEED_USER_1_DISPLAY_NAME -e SEED_USER_1_PASSWORD \
    -e SEED_USER_2_LOGIN -e SEED_USER_2_DISPLAY_NAME -e SEED_USER_2_PASSWORD \
    app npm run --silent db:seed

  CREDS="$SECRETS_DIR/initial-credentials.txt"
  cat >"$CREDS" <<EOF
Centrum Finansow — konta poczatkowe ($(date -Iseconds))
URL: https://$DOMAIN
$SEED_USER_1_LOGIN : $SEED_USER_1_PASSWORD
$SEED_USER_2_LOGIN : $SEED_USER_2_PASSWORD
Po pierwszym logowaniu wlacz 2FA (/settings/security) i usun ten plik.
EOF
  chmod 600 "$CREDS"
  touch "$SEED_MARKER"
  # Hasla seed nie zostaja w .env.
  sed -i '/^SEED_USER_[12]_PASSWORD=/d' "$ENV_FILE"
  unset SEED_USER_1_PASSWORD SEED_USER_2_PASSWORD
fi

# ---------------------------------------------------------------- start
log "Uruchamiam app + Caddy"
"${COMPOSE[@]}" up -d --remove-orphans

log "Czekam az aplikacja bedzie zdrowa"
for _ in $(seq 1 40); do
  status="$(docker inspect -f '{{.State.Health.Status}}' cfo-app-1 2>/dev/null || echo unknown)"
  [[ "$status" == "healthy" ]] && break
  sleep 3
done
[[ "${status:-}" == "healthy" ]] || { "${COMPOSE[@]}" logs --tail 80 app; die "Aplikacja nie jest healthy."; }

log "Sprawdzam HTTPS: https://$DOMAIN/api/health (certyfikat moze sie wystawiac do ~1 min)"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 10 "https://$DOMAIN/api/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 4
done
if [[ $ok -eq 1 ]]; then
  echo "HTTPS dziala."
else
  warn "HTTPS jeszcze nie odpowiada. Sprawdz: deploy/oci/compose.sh logs caddy"
  warn "Najczestsza przyczyna: porty 80/443 zamkniete w Security List / NSG w konsoli OCI."
fi

if ss -ltn | awk '{print $4}' | grep -qE '(^|:)3000$'; then
  warn "Port 3000 nasluchuje na hoscie — nie powinien!"
fi

docker image prune -f >/dev/null 2>&1 || true

log "Wdrozenie zakonczone: https://$DOMAIN"
if [[ -f "$SECRETS_DIR/initial-credentials.txt" ]]; then
  echo "Dane logowania: cat $SECRETS_DIR/initial-credentials.txt  (po zalogowaniu wlacz 2FA i usun plik)"
fi
