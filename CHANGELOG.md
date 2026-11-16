# Changelog

## 1.0.0 — 2026-11-16

Pierwsza wersja przeznaczona do wdrozenia (maly VPS, dostep przez Tailscale albo tunel Cloudflare).
Instrukcja: [deploy/MIKRUS.md](deploy/MIKRUS.md).

### Bezpieczenstwo

- 2FA: najwyzej 5 blednych kodow na jedno logowanie, kod jest jednorazowy (takze przy zmianie
  hasla i wylaczaniu 2FA), bledne kody licza sie do limitu logowania.
- Limit prob logowania na pare login + adres oraz na sam login; naglowki proxy sa brane pod uwage
  tylko przy `TRUST_PROXY=1`.
- Zmiana hasla i wylogowanie pozostalych sesji w `/settings/security`; awaryjny reset z konsoli
  (`npm run user:set-password`).
- Aplikacja nie startuje z przykladowym lub zbyt krotkim `SESSION_SECRET`; klucz backupu jest walidowany.
- Content-Security-Policy z nonce, brak cache dla stron z danymi.
- Obraz Dockera bez roota, system plikow tylko do odczytu, tylko zaleznosci produkcyjne.
- Zaktualizowane zaleznosci z znanymi podatnosciami.

### Funkcje i poprawki

- Usuwanie transakcji (z potwierdzeniem i wpisem w audycie).
- Import nie gubi identycznych transakcji z tego samego dnia.
- Import plikow do 15 MB (wczesniej zadania powyzej 1 MB konczyly sie bledem).
- Daty spoza kalendarza i zbyt duze kwoty sa odrzucane w formularzach i imporcie.
- Zrozumiale komunikaty przy uszkodzonych plikach CSV, XLSX i PDF.
- `backup:restore` dziala na pustej instalacji.

### Wdrozenie

- `deploy/docker-compose.mikrus.yml`, CI z publikacja obrazu do GHCR, Dependabot.
- Przykladowy wyciag w `file_sample/` zawiera dane zanonimizowane.
