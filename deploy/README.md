# Wdrozenie na VPS (HTTPS)

Pelny runbook dla Oracle Cloud Always Free (sieć, SSH, backup): `docs/14_ORACLE_CLOUD_SECURITY_RUNBOOK.md`.

## Wymagania

- Domena wskazujaca na VPS (rekord A, opcjonalnie AAAA).
- Otwarte porty 80 i 443: w NSG/security list **oraz** w firewallu systemu (na Oracle Ubuntu: iptables, nie UFW — patrz runbook).
- Docker Engine + Compose plugin.

## Kroki (wszystkie polecenia z katalogu glownego projektu)

1. Przygotuj `.env` w katalogu glownym projektu:

   ```bash
   cp .env.example .env
   chmod 600 .env
   ```

   Ustaw co najmniej:
   - `SESSION_SECRET` — `openssl rand -hex 32`
   - `BACKUP_ENCRYPTION_KEY` — inny losowy sekret
   - `SEED_USER_1_*`, `SEED_USER_2_*` — loginy i silne hasla
   - `COOKIE_SECURE=1`, `TRUST_PROXY=1`, `FORCE_HSTS=1`

   `DATABASE_URL` i `BACKUP_DESTINATION` sa nadpisywane przez compose (wolumeny w kontenerze).
   W wartosciach unikaj znaku `$` (Compose go interpoluje) — sekrety z `openssl rand -hex` sa bezpieczne.

2. Skopiuj `deploy/Caddyfile.example` do `deploy/Caddyfile` i ustaw swoja domene.

3. Zbuduj i uruchom (migracje bazy wykonuja sie automatycznie przy starcie kontenera):

   ```bash
   docker compose -f deploy/docker-compose.vps.yml up -d --build
   docker compose -f deploy/docker-compose.vps.yml ps   # app powinien byc "healthy"
   ```

4. Utworz konta (jednorazowo):

   ```bash
   docker compose -f deploy/docker-compose.vps.yml exec app npm run db:seed
   ```

   Po pierwszym logowaniu wlacz 2FA dla kazdego uzytkownika (`/settings/security`).
   Po seedzie mozesz usunac hasla `SEED_USER_*_PASSWORD` z `.env`.

5. Sprawdz health z zewnatrz: `curl -fsS https://twoja-domena/api/health`
   oraz ze `http://<ip>:3000` **nie** odpowiada.

## Aktualizacja

```bash
docker compose -f deploy/docker-compose.vps.yml exec app npm run backup:create
git pull
docker compose -f deploy/docker-compose.vps.yml up -d --build
```

## Oracle: "Out of capacity for shape VM.Standard.A1.Flex"

To brak wolnych serwerow ARM w Twoim home regionie, nie blad konfiguracji. Opcje opisane sa w
runbooku (sekcja „Brak pojemności A1”); najskuteczniejsze to automatyczne ponawianie:

```bash
COMPARTMENT_ID=ocid1... SUBNET_ID=ocid1... IMAGE_ID=ocid1... \
SSH_KEY_FILE=~/.ssh/cfo_oracle_ed25519.pub ./deploy/oci-launch-retry.sh
```

## Co daje aplikacja

- Naglowki bezpieczenstwa (`src/middleware.ts`)
- Limit prob logowania (`LOGIN_RATE_LIMIT_MAX`, domyslnie 8 / 15 min)
- Sesja `Secure` przy `COOKIE_SECURE=1`

Caddy dodaje HTTPS i przekazuje `X-Forwarded-Proto` do aplikacji.
