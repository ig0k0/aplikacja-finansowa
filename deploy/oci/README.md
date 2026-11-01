# Oracle Cloud: utwardzenie i wdrożenie w 3 krokach

Oracle Linux 8/9 (użytkownik `opc`) albo Ubuntu 22.04/24.04 (`ubuntu`), ARM A1 lub AMD Micro. Poniżej `ubuntu` = Twój użytkownik SSH (na Oracle Linux: `opc`).
Pełne uzasadnienie decyzji: `docs/14_ORACLE_CLOUD_SECURITY_RUNBOOK.md`.

| Skrypt | Uruchamiasz | Co robi |
| --- | --- | --- |
| `harden.sh` | `sudo`, raz | aktualizacje + auto-aktualizacje, SSH tylko na klucz (bez roota, tylko operator), fail2ban, firewall hosta (tylko 22/80/443), sysctl, swap na małej VM, Docker z oficjalnego repo z rotacją logów i `no-new-privileges`, katalogi `/srv/cfo/*` |
| `deploy.sh [domena]` | jako `ubuntu`, przy każdym wdrożeniu | `.env` z losowymi sekretami, backup przed aktualizacją, build, jednorazowe utworzenie 2 kont z losowymi hasłami, start app + Caddy (HTTPS), health check |
| `install-backup-timer.sh` | `sudo`, raz | codzienny zaszyfrowany backup o 03:15 (systemd), plus Google Drive, jeśli istnieje `rclone.conf` |
| `compose.sh` | jako `ubuntu` | skrót do `docker compose` z poprawnym `.env`, np. `compose.sh logs -f` |

## 0. Konsola OCI (bez tego HTTPS nie zadziała)

Networking → Virtual Cloud Networks → Twój VCN → Security Lists (albo NSG przypięta do VNIC) → **Ingress Rules**:

- TCP **80** z `0.0.0.0/0`: przekierowanie na HTTPS i wystawienie certyfikatu Let's Encrypt.
- TCP **443** z `0.0.0.0/0`: aplikacja.
- TCP **22**: zmień źródło z `0.0.0.0/0` na **swoje IP `/32`** (sprawdzisz je na https://ifconfig.me).

Nie otwieraj portu 3000 ani żadnego innego.

Domena jest opcjonalna. Bez niej skrypt użyje `<ip-z-myślnikami>.sslip.io`, czyli darmowego DNS-u wskazującego na IP maszyny. HTTPS też wtedy działa. Własną domenę ustaw rekordem A na publiczne IP VM.

## 1. Kod na serwer

Repo jest prywatne, więc użyj klucza wdrożeniowego tylko do odczytu:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/cfo_deploy -N "" -C "cfo-oci-deploy"
```

```bash
cat ~/.ssh/cfo_deploy.pub
```

Wklej klucz w GitHub: repo → Settings → Deploy keys → Add deploy key. **Nie** zaznaczaj „Allow write access”.

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/cfo_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config && chmod 600 ~/.ssh/config
```

```bash
sudo install -d -o "$USER" -g "$USER" /srv/cfo && git clone git@github.com:ig0k0/aplikacja-finansowa.git /srv/cfo/app && cd /srv/cfo/app
```

Dopóki zmiany nie są zmergowane do `main`:

```bash
git checkout claude/sharp-cannon-469ie5
```

## 2. Utwardzenie

```bash
sudo bash deploy/oci/harden.sh
```

Potem **otwórz drugi terminal** i sprawdź, że `ssh ubuntu@<IP>` nadal działa. Dopiero wtedy wyloguj się i zaloguj ponownie (żeby zadziałała grupa `docker`). Jeśli skrypt zgłosi `reboot-required`, zrestartuj maszynę: `sudo reboot`.

## 3. Wdrożenie

```bash
cd /srv/cfo/app && bash deploy/oci/deploy.sh
```

Z własną domeną:

```bash
cd /srv/cfo/app && bash deploy/oci/deploy.sh finanse.twojadomena.pl
```

Na końcu skrypt wypisze adres. Hasła do dwóch kont są w `/srv/cfo/secrets/initial-credentials.txt`:

1. Zaloguj się na oba konta.
2. Włącz 2FA w `/settings/security`.
3. Usuń plik z hasłami: `rm /srv/cfo/secrets/initial-credentials.txt`.

## 4. Backup

```bash
sudo bash deploy/oci/install-backup-timer.sh
```

```bash
sudo systemctl start cfo-backup.service && journalctl -u cfo-backup.service -n 30 --no-pager
```

Kopie lądują w `/srv/cfo/backups`. Klucz `BACKUP_ENCRYPTION_KEY` jest w `/srv/cfo/app/.env`. **Zapisz go w menedżerze haseł**, bo bez niego backup jest bezużyteczny.

Kopię na Google Drive (zalecaną, bo Oracle może odzyskać bezczynną VM Always Free) włączysz tak:

1. Na swoim komputerze uruchom `rclone config` i utwórz remote `cfo-drive`.
2. Skopiuj go na serwer: `scp ~/.config/rclone/rclone.conf ubuntu@<IP>:/srv/cfo/secrets/rclone.conf`, a na serwerze ustaw `chmod 600`.
3. W `.env` dopisz `GOOGLE_DRIVE_RCLONE_REMOTE=cfo-drive` i `GOOGLE_DRIVE_RCLONE_PATH=centrum-finansow/backup`.

## Aktualizacja aplikacji

```bash
cd /srv/cfo/app && git pull --ff-only && bash deploy/oci/deploy.sh
```

`deploy.sh` przed przebudową robi zaszyfrowany backup i przerywa, jeśli backup się nie uda.

## Co jest zabezpieczone

- **Sieć:** publiczne są tylko 80/443 (Caddy) i 22. Next.js (3000) działa wyłącznie w wewnętrznej sieci Dockera.
- **SSH:** wyłącznie klucze, bez logowania jako root, `AllowUsers ubuntu`, maksymalnie 3 próby, fail2ban z rosnącym banem.
- **System:** codzienne automatyczne poprawki bezpieczeństwa (restart o 04:30 tylko po aktualizacji jądra), auditd, utwardzony sysctl.
- **Kontenery:** aplikacja działa jako `node` (uid 1000), a nie root. Kod jest tylko do odczytu, kontenery mają `cap_drop: ALL` i `no-new-privileges`, limity pamięci i liczby procesów oraz rotację logów.
- **HTTPS:** certyfikat Let's Encrypt z automatycznym odnawianiem, HSTS, nagłówki bezpieczeństwa, limit uploadu 25 MB. Caddy nadpisuje `X-Forwarded-For`, więc limitu logowania nie da się obejść podrobionym nagłówkiem.
- **Sekrety:** `.env` ma uprawnienia `600`, sekrety są losowe, a hasła seed nie zostają w `.env`. Token Google Drive trafia tylko do jednorazowego kontenera backupu.

## Diagnostyka

```bash
deploy/oci/compose.sh ps
```

```bash
deploy/oci/compose.sh logs --tail 100 caddy
```

```bash
sudo fail2ban-client status sshd
```

Gdy HTTPS nie startuje, w 90% przypadków przyczyną są porty 80/443 zamknięte w Security List/NSG albo rekord DNS wskazujący na inne IP.
