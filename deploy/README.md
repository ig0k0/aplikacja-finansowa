# Wdrozenie na VPS (HTTPS)

**Oracle Cloud / Ubuntu:** uzyj gotowych skryptow, opisanych w [`oci/README.md`](oci/README.md). Robia utwardzenie systemu, wdrozenie, HTTPS i backup.

## Recznie (dowolny VPS z Dockerem)

1. Domena wskazuje na VPS (rekord A).
2. W `.env` w katalogu glownym repo ustaw:
   - `SESSION_SECRET` i `BACKUP_ENCRYPTION_KEY`: rozne, losowe (`openssl rand -hex 32`),
   - `CFO_DOMAIN=twoja.domena.pl` (czyta go `deploy/Caddyfile`),
   - opcjonalnie `CFO_BACKUP_DIR=/sciezka/na/backupy` (katalog wlasnosci uid 1000).
3. Uruchom z katalogu glownego repo (jawny `--env-file` jest wymagany):

```bash
docker compose --env-file .env -f deploy/docker-compose.vps.yml up -d --build
```

4. Sprawdz health: `curl -sS https://twoja-domena/api/health`

## Co daje konfiguracja

- Naglowki bezpieczenstwa (`src/middleware.ts` + `deploy/Caddyfile`)
- Limit prob logowania (`LOGIN_RATE_LIMIT_MAX`, domyslnie 8 / 15 min)
- Sesja `Secure` przy `COOKIE_SECURE=1`, HSTS
- Aplikacja w kontenerze jako uzytkownik `node` (bez roota), `cap_drop: ALL`, `no-new-privileges`, limity pamieci, port 3000 niepubliczny
