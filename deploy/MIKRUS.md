# Wdrozenie na malym VPS (Mikrus 2.1: 1 GB RAM, 10 GB SSD)

Instrukcja dla serwera bez publicznego IPv4 na portach 80/443. Aplikacja nie otwiera
zadnego portu na swiat — dostep idzie przez Tailscale (prywatnie) albo tunel Cloudflare
(publicznie). Obraz jest budowany w GitHub Actions; serwer tylko go pobiera.

> Szczegoly oferty Mikrusa (TUN dla Tailscale, wersja systemu, przekierowane porty) sprawdz
> w panelu — ten dokument ich nie gwarantuje.

## Zmierzone zuzycie zasobow

| Stan | Pamiec kontenera |
|------|------------------|
| Bezczynnosc po starcie | ok. 65 MB |
| Zwykla praca (logowanie, raporty, import wyciagu, PDF) | ok. 300 MB |
| Skrajny przypadek: import 45 000 wierszy z pliku 12 MB | ok. 585 MB |

Limit kontenera to 700 MB, wiec 1 GB RAM wystarcza. Dodaj 1 GB pliku wymiany jako bufor
na duze importy i OCR zdjec.

## 1. System (jednorazowo)

```bash
# aktualizacje bezpieczenstwa bez udzialu czlowieka
apt update && apt install -y unattended-upgrades fail2ban
dpkg-reconfigure -plow unattended-upgrades
```

```bash
# plik wymiany 1 GB (pomin, jesli kontener LXC na to nie pozwala)
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

SSH: logowanie tylko kluczem. W `/etc/ssh/sshd_config` ustaw `PasswordAuthentication no`
i `PermitRootLogin prohibit-password`, potem `systemctl restart ssh`. Najpierw sprawdz
w drugiej sesji, ze klucz dziala.

Docker: `curl -fsSL https://get.docker.com | sh`

## 2. Pliki na serwerze

```bash
mkdir -p /opt/cfo/deploy /opt/cfo/backups && cd /opt/cfo
chown 1000:1000 backups   # kontener dziala jako uzytkownik `node` (uid 1000)
```

Skopiuj `deploy/docker-compose.mikrus.yml` do `/opt/cfo/deploy/` i utworz `/opt/cfo/.env`:

```bash
cat > /opt/cfo/.env <<EOF
SESSION_SECRET=$(openssl rand -hex 32)
BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)
EOF
chmod 600 /opt/cfo/.env
```

**Zapisz `BACKUP_ENCRYPTION_KEY` w menedzerze hasel.** Bez niego kopii nie da sie odtworzyc.

Obraz z prywatnego repozytorium wymaga logowania do GHCR tokenem z uprawnieniem
`read:packages`: `docker login ghcr.io -u <login-github>`.

## 3. Start i konta

```bash
cd /opt/cfo
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml up -d
```

```bash
# dwa konta (jednorazowo); hasla min. 12 znakow
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml exec \
  -e SEED_USER_1_LOGIN=igor -e SEED_USER_1_DISPLAY_NAME=Igor -e SEED_USER_1_PASSWORD='...' \
  -e SEED_USER_2_LOGIN=user2 -e SEED_USER_2_DISPLAY_NAME='Uzytkownik 2' -e SEED_USER_2_PASSWORD='...' \
  app npm run db:seed
```

Po pierwszym logowaniu: `/settings/security` → wlacz 2FA i zmien haslo na wlasne.

## 4. Dostep

### Wariant A — prywatny, zalecany: Tailscale

Aplikacja jest widoczna tylko dla urzadzen z Twojej sieci Tailscale; z internetu nie ma
do niej zadnej drogi.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
tailscale serve --bg 3000   # HTTPS z certyfikatem pod https://<nazwa-serwera>.<tailnet>.ts.net
```

Zainstaluj Tailscale na telefonach i laptopach obu osob (drugiej osobie udostepnij sam
serwer przez „Share node"). Jesli `tailscale up` zglasza brak `/dev/net/tun`, wlacz TUN
w panelu VPS.

### Wariant B — publiczny: Cloudflare Tunnel + Access

Wymaga wlasnej domeny w Cloudflare. Tunel jest polaczeniem wychodzacym, wiec brak
publicznego IPv4 nie przeszkadza.

1. Cloudflare Zero Trust → Networks → Tunnels → utworz tunel, skopiuj token.
2. Public hostname: `finanse.twoja-domena.pl` → usluga `http://app:3000`.
3. Access → Applications → dodaj te domene z regula „tylko te dwa adresy e-mail".
   To druga warstwa logowania przed aplikacja.
4. Dopisz do `/opt/cfo/.env`:

```bash
CLOUDFLARE_TUNNEL_TOKEN=<token>
CLIENT_IP_HEADER=cf-connecting-ip
```

```bash
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml --profile cloudflare up -d
```

W tym wariancie Cloudflare odszyfrowuje ruch po swojej stronie.

## 5. Kopie zapasowe poza serwerem

Skonfiguruj `rclone` raz (Google Drive, Backblaze B2 lub Cloudflare R2) i zapisz konfiguracje
w wolumenie danych:

```bash
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml exec app \
  rclone config --config /app/data/rclone.conf
```

Dopisz do `.env` nazwe zdalnego polaczenia i sciezke:

```bash
GOOGLE_DRIVE_RCLONE_REMOTE=<nazwa-z-rclone-config>
GOOGLE_DRIVE_RCLONE_PATH=centrum-finansow/backup
```

Cron na hoscie (`crontab -e`) — kopia co noc, z sygnalem do healthchecks.io po sukcesie:

```cron
17 3 * * * cd /opt/cfo && docker compose --env-file .env -f deploy/docker-compose.mikrus.yml exec -T app npm run backup:google-drive && curl -fsS -m 10 https://hc-ping.com/<twoj-uuid> > /dev/null
```

Kopia jest szyfrowana (AES-256-GCM) przed wyslaniem, wiec dostawca dysku widzi tylko
zaszyfrowany plik.

### Test odtwarzania (zrob raz po wdrozeniu, potem co kilka miesiecy)

```bash
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml exec app \
  npm run backup:verify -- /app/backups/<plik>.cfo-backup.json
```

Pelne odtworzenie: zatrzymaj aplikacje, odtworz, uruchom ponownie.

```bash
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml stop app
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml run --rm app \
  npm run backup:restore -- /app/backups/<plik>.cfo-backup.json
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml up -d
```

## 6. Aktualizacje

```bash
cd /opt/cfo
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml exec -T app npm run backup:create
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml pull
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml up -d
```

Migracje bazy uruchamiaja sie przy starcie kontenera. Dependabot otwiera w repozytorium
pull requesty z aktualizacjami zaleznosci; po ich scaleniu CI publikuje nowy obraz.

## 7. Monitoring (darmowy)

- **healthchecks.io** — alarm, gdy nocna kopia nie wysle sygnalu (cron wyzej).
- **UptimeRobot** — tylko w wariancie publicznym: `https://finanse.twoja-domena.pl/api/health`.
- Dziennik logowan i operacji: `/audit` w aplikacji.

## 8. Sytuacje awaryjne

Utracone haslo albo telefon z kodami 2FA — reset z konsoli serwera (wylogowuje wszystkie sesje):

```bash
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml exec \
  -e NEW_PASSWORD='nowe-dlugie-haslo' app npm run user:set-password -- <login> --disable-totp
```

Podejrzenie przejecia sesji: `/settings/security` → „Wyloguj pozostale sesje" i zmiana hasla.
Zmiana `SESSION_SECRET` w `.env` i restart wylogowuje wszystkich naraz.

## Przejscie ze starszego obrazu (dzialajacego jako root)

Nowy obraz dziala jako uzytkownik `node`. Jesli wolumen danych powstal wczesniej, raz popraw
wlasciciela plikow:

```bash
docker compose --env-file .env -f deploy/docker-compose.mikrus.yml run --rm --user root --cap-add CHOWN app \
  chown -R node:node /app/data /app/backups
```
