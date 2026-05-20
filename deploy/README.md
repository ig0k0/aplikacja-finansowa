# Wdrozenie na VPS (HTTPS)

## Wymagania

- Domena wskazujaca na VPS (rekord A).
- Plik `.env` w katalogu glownym projektu (jak w `.env.example`).

## Kroki

1. Skopiuj `Caddyfile.example` do `Caddyfile` i ustaw swoja domene.
2. Ustaw w `.env` m.in.:
   - `SESSION_SECRET` — losowy, dlugi sekret
   - `COOKIE_SECURE=1`
   - `TRUST_PROXY=1`
3. Uruchom:

```bash
docker compose -f deploy/docker-compose.vps.yml up -d --build
docker compose -f deploy/docker-compose.vps.yml exec app npm run db:migrate
```

4. Sprawdz health: `curl -sS https://twoja-domena/api/health`

## Co daje aplikacja

- Naglowki bezpieczenstwa (`src/middleware.ts`)
- Limit prob logowania (`LOGIN_RATE_LIMIT_MAX`, domyslnie 8 / 15 min)
- Sesja `Secure` przy `COOKIE_SECURE=1`

Caddy dodaje HTTPS i przekazuje `X-Forwarded-Proto` do aplikacji.
