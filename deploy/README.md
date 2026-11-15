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

- Naglowki bezpieczenstwa i Content-Security-Policy (`src/proxy.ts`)
- Limit prob logowania: `LOGIN_RATE_LIMIT_MAX` (login + adres, domyslnie 8 / 15 min) oraz
  `LOGIN_RATE_LIMIT_LOGIN_MAX` (sam login, domyslnie 20 / 15 min); bledne kody 2FA licza sie do obu
- Sesja `Secure` przy `COOKIE_SECURE=1`
- Start jest przerywany, gdy `SESSION_SECRET` jest przykladowy lub krotszy niz 32 znaki
- Zmiana hasla i wylogowanie pozostalych sesji: `/settings/security`
- Awaryjny reset hasla z konsoli: `NEW_PASSWORD='...' npm run user:set-password -- <login> [--disable-totp]`

**Maly VPS bez publicznego IPv4 na portach 80/443 (np. Mikrus):** zobacz [MIKRUS.md](MIKRUS.md).

Caddy dodaje HTTPS i przekazuje `X-Forwarded-Proto` do aplikacji.
