# 14. Oracle Cloud Always Free — wdrożenie i bezpieczeństwo

Data weryfikacji: 2026-09-06. Ten dokument jest instrukcją operacyjną również dla przyszłego modelu. Nie zastępuje okresowego sprawdzenia aktualnej konsoli i [limitów Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

## Decyzja docelowa

Uruchom jedną VM `VM.Standard.A1.Flex`, **2 OCPU / 12 GB RAM**, Ubuntu Server 24.04 LTS `arm64`, z Docker Compose i Caddy. Taki przydział wykorzystuje aktualny pełny limit A1 Always Free — 1 500 OCPU-hours i 9 000 GB-hours miesięcznie, co Oracle określa jako 2 OCPU/12 GB łącznie. Rozdzielenie na dwie słabsze maszyny komplikuje backup, aktualizacje i sieć bez korzyści dla aplikacji dwuosobowej. [Oracle potwierdza limity, dostępne obrazy Ubuntu/Oracle Linux oraz zasady pojemności](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

**Wybór systemu: Ubuntu Server 24.04 LTS ARM64 minimal.** Jest obrazem zgodnym z A1 i ma standardowe aktualizacje bezpieczeństwa do maja 2029, także dla `arm64`; zapewnia najprostsze instrukcje dla Dockera i Caddy. [Cykl wsparcia Ubuntu](https://ubuntu.com/about/release-cycle). Oracle Linux 9 minimal jest dobrą alternatywą, gdy administracja preferuje `dnf`, SELinux i narzędzia Oracle, ale nie instaluj obrazu *Cloud Developer* — Oracle zaznacza, że sam wymaga co najmniej 8 GB RAM. Nie stosuj systemów EOL, obrazu desktopowego ani x86 na A1.

To ograniczenie nie oznacza nieograniczonej trwałości: Oracle może odzyskać bezczynne instancje Always Free, jeżeli przez siedem dni niskie są CPU, sieć i pamięć. Dlatego niezależny, szyfrowany backup poza OCI jest obowiązkowy. [Warunki odzyskiwania](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

## Granice odpowiedzialności i model zagrożeń

Chronimy przed: utratą VM/woluminu, kradzieżą kopii, skanowaniem publicznego Internetu, próbami logowania, błędną aktualizacją, przypadkowym usunięciem i nieuprawnionym dostępem do konsoli Oracle/Google.

Nie udajemy, że szyfrowanie woluminu wystarcza po kompromitacji konta `root`: działający system może odczytać SQLite i sekrety. Dlatego wymagane są warstwy: silne konta administratorów, minimalna sieć, aktualizacje, 2FA aplikacji, osobny klucz backupu i kopia poza Oracle. OCI szyfruje boot volume, block volume i ich backupy AES-256 domyślnie, lecz domyślnie klucz jest zarządzany przez Oracle. [Szyfrowanie wolumenów OCI](https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/blockvolumeencryption.htm). To jest ochrona nośnika, nie substytut szyfrowanej kopii aplikacyjnej.

## 1. Konto i projekt OCI — przed VM

1. Włącz MFA dla konta Oracle Cloud oraz dla każdego konta z rolą administracyjną. Usuń nieużywane API keys i użytkowników.
2. Utwórz osobny compartment `cfo-prod`. Nadaj codziennemu operatorowi wyłącznie niezbędne uprawnienia do tej instancji; nie używaj konta głównego do wdrożeń.
3. Wybierz **home region** uważnie: Always Free compute i wolumeny muszą powstać w home region. Sprawdź w konsoli etykietę `Always Free Eligible` przed zatwierdzeniem. [Zasady home region](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).
4. Utwórz alarm budżetowy/kosztowy i przynajmniej comiesięczny przegląd Billing. Nie klikaj „upgrade” tylko po to, aby obejść chwilowy brak capacity.
5. Zarezerwuj 50 GB boot volume. W całym tenancy Always Free jest 200 GB boot/block storage i najwyżej pięć backupów wolumenów; nie twórz zasobów poza home region, jeśli oczekujesz ceny 0. [Limity storage](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

## 2. Sieć OCI — reguły dokładne

Utwórz osobny VCN i subnet dla jednej VM. Do VNIC przypnij **Network Security Group** `cfo-public-app`, nie rozszerzaj domyślnej security listy. Oracle rekomenduje NSG, ponieważ izoluje wymagania aplikacji od architektury subnetu. [Porównanie NSG i security lists](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm).

| Kierunek | Protokół / port | Źródło | Cel |
| --- | --- | --- | --- |
| Ingress | TCP 443 | `0.0.0.0/0` oraz `::/0` | Publiczna aplikacja HTTPS. |
| Ingress | TCP 80 | `0.0.0.0/0` oraz `::/0` | Jedynie przekierowanie HTTP i odnowienie certyfikatu Caddy/ACME. |
| Ingress | TCP 22 | wyłącznie stały adres administratora `/32` (oraz osobny IPv6 `/128`, jeśli używany) | SSH. Gdy adres się zmienia, zaktualizuj regułę **przed** podróżą/zmianą sieci. |
| Ingress | TCP 3000 | brak | Next.js nie może być publiczny; jest dostępny tylko z Caddy wewnątrz Docker network. |
| Egress | TCP 443, DNS 53, NTP 123 | wymagane aktualizacje/ACME/Google Drive | Ogranicz bardziej dopiero po zmierzeniu zależności; nie blokuj aktualizacji. |

Nie otwieraj ICMP, baz danych, Dockera, portu administracyjnego ani SSH dla `0.0.0.0/0`. Jeżeli w przyszłości użyjesz prywatnego VPN, ogranicz 22 tylko do jego CIDR i usuń publiczny wyjątek. Pamiętaj, że reguły OCI oraz firewall systemu są sumowane: oba muszą pozwolić na potrzebny ruch. [Oracle opisuje oba poziomy i zaleca host firewall](https://docs.oracle.com/en-us/iaas/Content/Security/Reference/compute_security.htm).

## 3. Utworzenie i pierwsze logowanie

1. Wybierz Ubuntu Server 24.04 LTS ARM64, `VM.Standard.A1.Flex`, 2 OCPU, 12 GB, 50 GB boot volume, publiczny IPv4 tylko jeśli aplikacja ma być dostępna bez VPN.
2. Wygeneruj na **lokalnym komputerze administratora** nowy klucz ed25519 z silną frazą: `ssh-keygen -t ed25519 -a 64 -f ~/.ssh/cfo_oracle_ed25519 -C "cfo-oracle"`. W konsoli wklej tylko plik `.pub`.
3. Połącz się przez `ssh -i ~/.ssh/cfo_oracle_ed25519 ubuntu@<publiczny-ip>`. Zachowaj tę sesję otwartą aż do przetestowania drugiej sesji SSH.
4. Zaktualizuj system i zainstaluj minimum: `sudo apt update && sudo apt full-upgrade -y && sudo apt install -y ca-certificates curl git ufw fail2ban unattended-upgrades auditd`.
5. Utwórz zwykłego operatora wdrożeń i kopiuj do niego wyłącznie publiczny klucz SSH. Nie pracuj jako root.
6. Utwórz `/etc/ssh/sshd_config.d/90-cfo-hardening.conf` z: `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PubkeyAuthentication yes`, `AllowUsers <operator>`, `MaxAuthTries 3`, `ClientAliveInterval 300`, `ClientAliveCountMax 2`. Sprawdź składnię `sudo sshd -t`, dopiero potem `sudo systemctl reload ssh` i zaloguj się w **drugim terminalu**. Dopiero po sukcesie zamknij pierwszą sesję. Oracle zaleca key-only, zakaz haseł i zakaz root login. [Wymagane opcje SSH](https://docs.oracle.com/en-us/iaas/Content/Security/Reference/compute_security.htm).
7. W UFW ustaw najpierw SSH z dokładnego IP administratora, następnie 80/443, a na końcu `sudo ufw default deny incoming`, `sudo ufw default allow outgoing`, `sudo ufw enable`. Przetestuj: port 3000 z Internetu musi być zamknięty, `/api/health` pod domeną HTTPS — dostępne.
8. Włącz aktualizacje bezpieczeństwa (`sudo dpkg-reconfigure --priority=low unattended-upgrades`), `fail2ban`, `auditd` i regularnie sprawdzaj `sudo systemctl --failed` oraz wolne miejsce. Fail2ban jest warstwą pomocniczą; nie zastępuje key-only ani ograniczenia 22 w NSG.

## 4. Instalacja Dockera i aplikacji

1. Zainstaluj Docker Engine i Compose Plugin **wyłącznie z aktualnej instrukcji Docker dla Ubuntu ARM64**, następnie `sudo systemctl enable --now docker`. Zweryfikuj `docker version` i `docker compose version`. Node.js nie jest potrzebny na hoście: obraz aplikacji zawiera Node 24.
2. Utwórz katalogi z najmniejszymi uprawnieniami: `/srv/cfo/app`, `/srv/cfo/backups`, `/srv/cfo/secrets`; właściciel: operator, katalog `secrets` ma `700`, pliki sekretów `600`.
3. Sklonuj lub przenieś tylko zweryfikowany kod do `/srv/cfo/app`; przejrzyj `git status`, tag/commit i `npm run` w CI przed wdrożeniem.
4. Skopiuj `.env.example` do `/srv/cfo/app/.env`, ustaw losowe `SESSION_SECRET` i **inny** `BACKUP_ENCRYPTION_KEY`, `COOKIE_SECURE=1`, `TRUST_PROXY=1`, `FORCE_HSTS=1`, `AI_MODE=disabled`; nadaj plikowi `chmod 600`. Sekretów nie wpisuj w historię shell, URL, komunikaty ani Git.
5. Skopiuj `deploy/Caddyfile.example` jako `deploy/Caddyfile`, podmień domenę, ustaw rekordy DNS A/AAAA i uruchom: `docker compose -f deploy/docker-compose.vps.yml up -d --build`.
6. Sprawdź z zewnątrz: `curl -fsS https://twoja-domena/api/health`; sprawdź certyfikat, przekierowanie HTTP→HTTPS oraz że `http://ip:3000` nie odpowiada. Utwórz konta seed tylko raz, następnie ustaw 2FA dla każdego użytkownika.
7. Po każdej aktualizacji: najpierw zweryfikowany backup, potem pobranie kodu, build/restart, health check, logi bez sekretów i krótki test logowania. Nigdy nie uruchamiaj poleceń z Internetu w ciemno jako root.

## 5. Backup 3-2-1 i Google Drive

Warstwy: (1) aktywna SQLite na wolumenie OCI, (2) lokalny, zaszyfrowany plik kopii na VM, (3) zaszyfrowany plik w niezależnym Google Drive. Opcjonalnie wykorzystaj do pięciu backupów wolumenów OCI jako warstwę odzyskiwania infrastruktury, ale nie jako jedyną kopię danych.

1. Na zaufanym komputerze administracyjnym skonfiguruj `rclone config` i utwórz remote typu Google Drive, np. `cfo-drive`. Przejdź OAuth lokalnie; nie loguj do Google z terminala publicznej VM.
2. Przenieś `rclone.conf` przez SSH do `/srv/cfo/secrets/rclone.conf`, ustaw `chmod 600`. To plik z tokenem odświeżania — nie trafia do repozytorium, obrazu Docker ani zwykłego katalogu backupu.
3. W `/srv/cfo/app/.env` ustaw `GOOGLE_DRIVE_RCLONE_REMOTE=cfo-drive`, `GOOGLE_DRIVE_RCLONE_PATH=centrum-finansow/backup`, `BACKUP_RETENTION_DAYS=14`. Ustaw `RCLONE_CONFIG` dopiero w jednorazowej komendzie/timerze, aby aplikacja webowa nie otrzymywała tokenu.
4. Test ręczny uruchom w katalogu aplikacji:

   ```bash
   docker compose -f deploy/docker-compose.vps.yml run --rm \
     -v /srv/cfo/secrets/rclone.conf:/run/secrets/rclone.conf:ro \
     -e RCLONE_CONFIG=/run/secrets/rclone.conf \
     app npm run backup:google-drive
   ```

   Skrypt najpierw tworzy spójną kopię SQLite, szyfruje AES-256-GCM, weryfikuje checksum i `PRAGMA integrity_check`, potem wykonuje pojedynczy upload oraz potwierdza obecność pliku w folderze. Przy błędzie Drive nie zgłasza fałszywego sukcesu i lokalna kopia pozostaje.

5. Dodaj systemd service/timer uruchamiający tę samą komendę codziennie o 03:15, z `WorkingDirectory=/srv/cfo/app`, użytkownikiem operacyjnym i `Persistent=true`. Timer nie może uruchamiać pełnego kontenera aplikacji na porcie publicznym; ma wykonywać wyłącznie `docker compose run --rm ... npm run backup:google-drive`.
6. Co miesiąc pobierz losową kopię z Google Drive do oddzielnej, testowej ścieżki i wykonaj `backup:verify` oraz restore z `docs/13_MANUAL_TEST_PLAN.md`. Bez pozytywnego testu restore backup jest tylko założeniem.

### Wzorzec systemd dla backupu

Zastąp `cfo` prawdziwą nazwą operatora i potwierdź położenie Dockera przez `command -v docker`. Zapisz poniższe pliki jako root; nie zapisują żadnego sekretu w unitach.

`/etc/systemd/system/cfo-backup.service`:

```ini
[Unit]
Description=Encrypted CFO backup to Google Drive
Wants=network-online.target
After=network-online.target docker.service
ConditionPathExists=/srv/cfo/secrets/rclone.conf

[Service]
Type=oneshot
User=cfo
Group=cfo
WorkingDirectory=/srv/cfo/app
ExecStart=/usr/bin/docker compose -f deploy/docker-compose.vps.yml run --rm -v /srv/cfo/secrets/rclone.conf:/run/secrets/rclone.conf:ro -e RCLONE_CONFIG=/run/secrets/rclone.conf app npm run backup:google-drive
```

`/etc/systemd/system/cfo-backup.timer`:

```ini
[Unit]
Description=Daily CFO encrypted backup

[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
```

Następnie: `sudo systemctl daemon-reload`, `sudo systemctl enable --now cfo-backup.timer`, ręczny test `sudo systemctl start cfo-backup.service`, status `systemctl list-timers cfo-backup.timer` i log `journalctl -u cfo-backup.service -n 50 --no-pager`. Gdy test nie przejdzie, nie usuwaj lokalnej kopii ani nie wyłączaj działającego timera bez przyczyny.

## 6. Operacyjna lista kontroli

- **Codziennie automatycznie:** backup + upload; obserwuj nieudane timery.
- **Co tydzień:** `apt` security updates, status kontenerów, wolne miejsce, logi `fail2ban`, liczba kluczy SSH.
- **Co miesiąc:** restore próbny, przegląd NSG/UFW/IAM/MFA, aktualizacja obrazu aplikacji po testach, kontrola kosztów i limitów Always Free.
- **Po incydencie:** odetnij publiczny ruch w NSG (pozostaw tylko własny SSH/VPN), zachowaj logi, obróć `SESSION_SECRET`, hasła, klucz backupu i token Google Drive, odtwórz na nowej VM ze zweryfikowanej kopii. Nie „czyść” dowodów przed ustaleniem zakresu.

## Zakazy dla przyszłego modelu

- Nie przenosić SQLite do publicznej bazy, nie wystawiać 3000, Dockera ani SSH globalnie.
- Nie dodawać Redisa, workerów, Kafki, ciągłego streamingu cen ani lokalnego LLM na tej VM bez osobnej decyzji wydajnościowej.
- Nie zapisywać kluczy `.env`, `rclone.conf`, backupów ani danych transakcji w Git, issue, logach lub zrzutach ekranu.
- Nie usuwać poprzedniej bazy po restore, nie skracać retencji przed udanym odtworzeniem i nie zakładać, że snapshot OCI zastępuje niezależny backup.
