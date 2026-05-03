# 11. Decyzje Architektoniczne

Data dokumentu: 2026-05-01

Ten dokument jest lekkim rejestrem ADR. Kazda istotna decyzja powinna miec status, kontekst, decyzje i konsekwencje.

Statusy:

- `Proposed` - propozycja do potwierdzenia.
- `Accepted` - decyzja przyjeta.
- `Rejected` - decyzja odrzucona.
- `Superseded` - zastapiona przez nowsza decyzje.

## ADR-001: Aplikacja Webowa Self-Hosted

Status: Accepted

Kontekst:

Aplikacja ma byc uzywana przez dwie osoby na macOS i Windows. Nie ma wymagania aplikacji mobilnej na start.

Decyzja:

Budujemy aplikacje webowa uruchamiana self-hosted.

Konsekwencje:

- Uzytkownicy potrzebuja tylko przegladarki.
- Jeden deployment obsluguje oba systemy operacyjne.
- UI moze byc responsywne pozniej, ale nie jest to priorytet MVP.

## ADR-002: Prosty Monolit Na Start

Status: Accepted

Kontekst:

Projekt ma byc tani, prosty i dlugoterminowo utrzymywalny. Liczba uzytkownikow to dwie osoby.

Decyzja:

Startujemy od monolitu webowego zamiast dzielenia na frontend, backend, worker, kolejke i wiele serwisow.

Konsekwencje:

- Mniej infrastruktury.
- Latwiejszy Docker Compose.
- Worker moze zostac dodany pozniej tylko dla dlugich importow lub AI.

## ADR-003: Docker Compose Jako Domyslne Wdrozenie

Status: Accepted

Kontekst:

Uzytkownik moze hostowac aplikacje w domu albo na VPS. Wazna jest odtwarzalnosc instalacji.

Decyzja:

Docker Compose jest domyslna metoda uruchomienia.

Konsekwencje:

- Latwiejsza instalacja.
- Prostsze backupowanie wolumenow.
- Wymaga podstawowego utrzymania Dockera na hoście.

## ADR-004: SQLite vs PostgreSQL

Status: Accepted

Kontekst:

SQLite jest najprostsze i lekkie. PostgreSQL jest bardziej profesjonalne operacyjnie przy dlugim utrzymaniu i VPS.

Opcja A: SQLite

- jeden plik,
- najprostsze wdrozenie,
- bardzo niski koszt,
- dobre dla jednej aplikacji i dwoch osob.

Opcja B: PostgreSQL

- dojrzale backupy,
- lepsza wspolbieznosc,
- wygodniejsze migracje i operacje,
- dodatkowy kontener i wiecej utrzymania.

Decyzja:

Pierwsza implementacja uzywa SQLite, bo pierwszym celem wdrozenia jest domowy serwer/LAN i maksymalnie prosty self-hosted MVP.

Konsekwencje:

- Decyzja musi zapasc przed migracjami.
- Parsery i domena powinny byc niezalezne od konkretnej bazy.
- Backup szyfrowany musi zostac dodany przed realnym uzyciem danych finansowych.

## ADR-004A: Next.js i TypeScript Jako Stack Aplikacji

Status: Accepted

Kontekst:

Aplikacja ma byc webowa, self-hosted, prosta operacyjnie i rozwijana jako monolit.

Decyzja:

Pierwsza implementacja uzywa Next.js, TypeScript, SQLite, Drizzle ORM i Docker Compose.

Konsekwencje:

- UI i logika serwerowa moga byc w jednym projekcie.
- TypeScript daje typowanie w domenie i warstwie danych.
- Drizzle pozwala utrzymac lekki model danych i migracje dla SQLite.
- Publiczne API nie jest projektowane jako osobny produkt w MVP.

## ADR-005: AI Jako Adapter, Nie Rdzen Domeny

Status: Accepted

Kontekst:

AI jest wazne dla kategoryzacji i rekomendacji, ale nie moze byc jedynym sposobem dzialania aplikacji.

Decyzja:

AI bedzie podlaczone przez adapter. Aplikacja ma dzialac bez AI.

Konsekwencje:

- Mozna zaczac od recznej kategoryzacji i pamieci korekt.
- Lokalny i zewnetrzny model moga korzystac z tego samego interfejsu.
- Testy moga walidowac kontrakt odpowiedzi AI.

## ADR-006: Structured Output Dla AI

Status: Accepted

Kontekst:

Kategoryzacja transakcji musi byc przewidywalna i walidowalna.

Decyzja:

Model AI musi zwracac JSON zgodny ze schematem.

Konsekwencje:

- Mniej bledow parsowania.
- Mozna jasno odrzucac niepoprawne odpowiedzi.
- Potrzebny schemat odpowiedzi i testy kontraktu.

## ADR-007: Import CSV/XLS Przed PDF

Status: Accepted

Kontekst:

CSV i XLS/XLSX sa bardziej stabilne niz PDF. PDF-y bankowe moga miec rozne uklady i wymagaja dodatkowej walidacji.

Decyzja:

Najpierw implementujemy CSV oraz XLS/XLSX. PDF trafia do pozniejszego etapu.

Konsekwencje:

- MVP szybciej uzyska stabilny import.
- PDF nie blokuje pierwszego uzywalnego produktu.
- Parsery PDF beda projektowane po zebraniu doswiadczen z importami tabelarycznymi.

## ADR-008: Oddzielne Widoki i Budzety

Status: Accepted

Kontekst:

Aplikacja jest dla rodziny, ale uzytkownicy chca oddzielne widoki i oddzielne budzety.

Decyzja:

Dane, budzety i raporty sa przypisane do konkretnego uzytkownika.

Konsekwencje:

- Brak wspolnego budzetu w MVP.
- Brak rozliczania kto komu oddaje pieniadze.
- Separacja danych musi byc wymuszona po stronie serwera.

## ADR-009: Backup Szyfrowany Od MVP

Status: Accepted

Kontekst:

Dane finansowe sa wrazliwe, a backup moze trafic na Google Drive lub inne miejsce poza hostem.

Decyzja:

Backupy powinny byc szyfrowane od pierwszej wersji produkcyjnej. Pusty fundament aplikacji moze powstac przed backupem, ale realne dane finansowe nie powinny byc uzywane przed dodaniem backup/restore.

Konsekwencje:

- Restore wymaga klucza.
- Trzeba dobrze opisac przechowywanie klucza.
- Backup bez szyfrowania nie powinien byc zalecanym wariantem.

## ADR-010: Brak Publicznego API W MVP

Status: Accepted

Kontekst:

Uzytkownik nie potrzebuje integracji z innymi narzedziami. API zwieksza powierzchnie utrzymania i bezpieczenstwa.

Decyzja:

Nie projektujemy publicznego API w MVP. Wewnetrzne endpointy frameworka sa dozwolone.

Konsekwencje:

- Mniejszy zakres.
- Mniej dokumentacji API.
- Integracje zewnetrzne mozna dodac pozniej, jesli pojawi sie realna potrzeba.

## ADR-011: 2FA Jako TOTP (RFC 6238)

Status: Accepted

Kontekst:

Potrzeba drugiego czynnika przy logowaniu bez SMS ani zewnetrznego IdP; dwa uzytkownicy self-hosted.

Decyzja:

Implementujemy **TOTP** (`otplib`), sekret w bazie (`users.totp_secret`), konfiguracja i wylaczenie w **`/settings/security`**, drugi krok logowania na **`/login/totp`** z krotkim TTL dla stanu oczekujacego (`login_totp_pending`). Brak kodow zapasowych w MVP.

Konsekwencje:

- Uzytkownik potrzebuje aplikacji authenticator; utrata sekretu wymaga recznego resetu w bazie albo kontaktu z administratorem hosta.
- Prostszy model niz WebAuthn/email codes na ten etap.

## ADR-012: Neutralny Import PDF (Tekst / Wektorowe Tabele)

Status: Accepted

Kontekst:

Etap 8 przewiduje import PDF. Pelne presety per bank i OCR to osobne, ciezsze prace.

Decyzja:

Dodajemy **neutralny** import PDF: biblioteka **`pdf-parse`** (klasa `PDFParse`) w `serverExternalPackages`. Kolejnosc: `getTable()` (tabele wektorowe), potem `getText()` i heurystyka kolumn (tabulatory / wielokrotne spacje). Skan PDF bez warstwy tekstowej: sugerowac zapis strony jako obraz do modulu **OCR** (ponizej) albo CSV/XLSX.

Konsekwencje:

- Uzytkownik nadal mapuje kolumny recznie; jakosc zalezy od PDF (czesto gorsza niz CSV).
- Wiekszy rozmiar deployu / zaleznosci serwerowych; skany PDF mozna kierowac do **OCR w aplikacji** (ADR-013) zamiast wylacznie do zewnetrznych narzedzi.

## ADR-013: OCR Paragonow (Tesseract, PL) W Importcie

Status: Accepted

Kontekst:

Paragony i niektore PDF-y to obrazy bez tekstu maszynowego; roadmapa przewiduje OCR.

Decyzja:

W **`parse-file`** dla PNG/JPEG/WebP uruchamiamy **`tesseract.js`** (`createWorker('pol')`, `serverExternalPackages`). Wynik OCR laczy sie z ta sama sciezka co tekst z PDF: **`neutralExtractedTextToMatrix`** → mapowanie kolumn jak przy CSV.

Konsekwencje:

- Pierwsze uruchomienie moze pobrac modele jezykowe; OCR jest obciazajacy czasowo i rozmiarowo.
- Jakosc zalezy od zdjecia; nadal brak gotowych szablonow paragonow — uzytkownik mapuje kolumny recznie.

## ADR-014: Szablony Nazw Kolumn Importu (Bez Parserow Bankowych)

Status: Accepted

Kontekst:

Roadmapa rozroznia neutralny import od przyszlych parserow dedykowanych. Uzytkownicy powtarzaja te same nazwy kolumn.

Decyzja:

Dodajemy statyczne **presety mapowania** w **`src/domain/import-presets.ts`** (np. typowe PL, przyklad mBank, EN). Strona **`/imports`** linkuje `?preset=...` i wypelnia pola formularza `defaultValue`. To nie wykonuje logiki bankowej — tylko oszczedza wpisywanie naglowkow.

Konsekwencje:

- Nadal wymagana reczna weryfikacja naglowkow w pliku.
- Prawdziwe parsery CSV/XML per bank pozostaja osobnym, wiekszym zakresem.

## Szablon Nowej Decyzji

```markdown
## ADR-XXX: Tytul Decyzji

Status: Proposed

Kontekst:

Opis problemu i ograniczen.

Decyzja:

Wybrany kierunek.

Konsekwencje:

- Skutek pozytywny.
- Skutek negatywny.
- Co trzeba monitorowac.
```
