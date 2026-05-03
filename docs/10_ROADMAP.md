# 10. Roadmapa

Data dokumentu: 2026-05-01

## Stan implementacji (gdzie skonczylismy)

### Punkt zatrzymania pracy (ostatnia synchronizacja z kodem)

**Data odniesienia: 2026-05-01.** Przy **zmianie czatu / kontekstu** traktuj ten fragment jako zrodlo prawdy o tym, co jest juz w repozytorium, a co nie.

| Co | Stan |
| --- | --- |
| **Zakonczone w kodzie (MVP)** | Etapy **0–7 (MVP)** — m.in. `/transactions`, import, `/review` + AI, backup i `/audit`, **`/investments`**, **`/insights`**. |
| **Etap 8** | **Zakonczony (planowany zakres):** 2FA TOTP, PDF/OCR importu, szablony kolumn, wykres 12 mies., responsywnosc. **Poza zakresem Etapu 8:** dedykowane parsery per bank — [Backlog](#backlog). |
| **Opcjonalne rozszerzenia** | **Poza roadmapa MVP:** glebsze wykresy na `/insights`; automatyczne ceny/kursy; wdrozenie produkcyjne na VPS z HTTPS. |
| **Pierwszy nastepny krok (backlog)** | Wedlug priorytetu: parser dedykowany pod wybrany bank; kolejne metryki/wykresy; ceny aktywow; twarde utwardzenie dostepu z internetu. |

**Aktualizacja tabeli etapow:** 2026-05-01.

| Etap | Status | Uwagi |
| --- | --- | --- |
| 0. Doprecyzowanie przed kodem | **Zakonczony** | Dokumentacja w `docs/`, decyzje w `docs/11_DECISIONS.md`. |
| 1. Fundament aplikacji | **Zakonczony** | Next.js, SQLite, Drizzle, Docker, logowanie, seed, dashboard z danymi rocznymi. |
| 2. Transakcje reczne | **Zakonczony** | `/transactions`, budzety, `/reports/monthly`, `/reports/yearly`. |
| 3. Import CSV/XLS/PDF/OCR | **Zakonczony (MVP)** | Widok `/imports`: CSV, XLSX, PDF, OCR obrazow (`pol`), mapowanie kolumn, **szablony nazw kolumn** (`import-presets`), podglad, deduplikacja. Legacy `.xls` odrzucony. Brak automatycznych parserow per bank. |
| 4. AI kategoryzacji | **Zakonczony (MVP)** | Endpoint OpenAI-compatible (`src/ai/openai-compatible.ts`), walidacja JSON (`src/domain/ai-categorization.ts`), progi z ENV, pamiec korekt (`user_correction_memory`), zapis sugestii (`ai_suggestions`), widok `/review`, opcja „Zapamietaj” przy zmianie kategorii. |
| 5. Backup, restore, bezpieczenstwo | **Zakonczony (MVP)** | Szyfrowany backup CLI + **`npm run backup:scheduled`** (cron), retencja opcjonalna `BACKUP_RETENTION_DAYS`, naprawa `createEncryptedBackup` (osobne polaczenie SQLite). Audyt: `audit_events`, **`/audit`**. Google Drive: poza kodem (`rclone`). |
| 6. Inwestycje i majatek netto | **Zakonczony (MVP)** | Tabele `investment_assets`, `investment_operations`, `investment_strategies`; widok **`/investments`**; operacje reczne (kupno, wycena, dywidenda, wplata/wyplata, sprzedaz); strategia z procentami i **sugestia podzialu** nadwyzki od bilansu roku; dashboard: suma wartosci portfela, koszt, P/L. |
| 7 | **Zakonczony (MVP)** | `/insights`, agregacje, CSV/PDF, `is_recurring`, heurystyka merchant/opis. Opcjonalnie pozniej: kolejne wykresy. |
| 8 | **Zakonczony (zakres Etapu 8)** | Jak w tabeli powyzej; parsery per bank = osobny backlog, nie blokuja zamkniecia Etapu 8. |

## Podsumowanie: czy sa jeszcze etapy?

| Zakres | Stan |
| --- | --- |
| **Etapy 0–7 (MVP produktu)** | **Zakonczone w kodzie** — transakcje, import neutralny, AI/review, backup/audit, inwestycje, analityka. |
| **Etap 8 (rozszerzenia self-hosted)** | **Wdrozone:** 2FA TOTP, PDF/OCR importu, szablony kolumn, wykres 12 mies. na `/insights`, iteracja **UI mobilnego** (klasy pomocnicze + naglowki/raporty). |
| **Nie sa czescia zamknietego MVP** | **Parsery dedykowane pod konkretne banki** (wymagaja utrzymania i przykladowych plikow), **automatyczne ceny aktywow / kursy walut**, **zaawansowany rebalancing**, **publiczny dostep internetowy** (reverse proxy, twarde HTTPS) — to **backlog** na kolejne iteracje, opisany m.in. w sekcji „Poza MVP” ponizej. |

**Poza MVP Etapu 6 (kolejne iteracje):** automatyczne ceny aktywow, rebalancing z historii brokerow, powiazanie operacji inwestycyjnych z kontami bankowymi.

Roadmapa jest ukladana tak, aby najpierw powstal uzywalny, prosty produkt, a dopiero potem bardziej ryzykowne funkcje: PDF, automatyczne ceny inwestycji i glebsza analityka AI.

## Etap 0. Doprecyzowanie Przed Kodem

Cel: przygotowac implementacje bez zgadywania.

Zakres:

- potwierdzic stack technologiczny,
- wybrac SQLite albo PostgreSQL,
- zdecydowac LAN/VPS/VPN jako pierwszy wariant wdrozenia,
- przygotowac zanonimizowane przykladowe pliki z bankow,
- potwierdzic startowa liste kategorii,
- ustalic tryb AI na start: brak AI, lokalne Ollama albo zewnetrzne API.

Kryterium zakonczenia:

- decyzje sa zapisane w `docs/11_DECISIONS.md`,
- parsery maja przykladowe pliki do testow,
- wiadomo, jaki jest zakres pierwszej implementacji.

## Etap 1. Fundament Aplikacji

Cel: uruchomic pusta aplikacje z logowaniem i baza.

Zakres:

- projekt aplikacji webowej,
- Docker Compose,
- baza danych i migracje,
- lokalne konta dla dwoch osob,
- sesje,
- startowy layout,
- seed kategorii,
- podstawowy dashboard bez danych importowanych,
- dokumentacja uruchomienia.

Kryterium zakonczenia:

- mozna uruchomic aplikacje lokalnie,
- dwie osoby moga sie zalogowac,
- dane sa odseparowane,
- aplikacja ma trwaly wolumen danych.

## Etap 2. Transakcje Reczne

Cel: aplikacja jest uzywalna bez importow.

Zakres:

- reczne dodawanie wydatkow,
- reczne dodawanie przychodow,
- lista transakcji,
- wyszukiwanie i filtrowanie,
- edycja kategorii,
- budzety miesieczne,
- raport miesieczny,
- raport roczny w podstawowej wersji.

Kryterium zakonczenia:

- uzytkownik moze prowadzic budzet recznie,
- dashboard pokazuje realne dane,
- mozna szybko poprawiac kategorie.

## Etap 3. Import CSV/XLS/PDF/OCR

Cel: miesieczny import danych bankowych dziala stabilnie.

**Implementacja na 2026-05-01:** kryteria zakonczenia ponizej sa spelnione dla **neutralnego** importera (upload, mapowanie kolumn, podglad, dedupe, zapis). Formaty: **CSV**, **XLSX**, **PDF** (`pdf-parse`), **zdjecia OCR** (`tesseract.js`, `pol`). Ponizsza lista `parser mBank` itd. opisuje docelowy **zakres produktowy**; osobne presety bankowe mozna dodac jako rozszerzenie bez zmiany rdzenia importu.

Zakres:

- upload pliku,
- detekcja formatu,
- mapowanie kolumn,
- parser mBank,
- parser Revolut,
- parser PKO BP,
- parser ZEN,
- deduplikacja,
- podglad importu,
- podsumowanie importu,
- testy parserow na przykladowych plikach.

Kryterium zakonczenia:

- ponowny import tego samego pliku nie tworzy duplikatow,
- import pokazuje liczbe nowych i pominietych transakcji,
- parsery dzialaja na zanonimizowanych przykladach.

## Etap 4. AI Kategoryzacji

Cel: zmniejszyc reczna prace przy kategoriach.

**Implementacja (MVP, 2026-05-01):** dziala adapter HTTP do API zgodnego z OpenAI (`/v1/chat/completions`), tryb `AI_MODE=disabled|local|external`, progi `AI_CONFIDENCE_*`, kolejka `/review`, pamiec korekt przy zapisie kategorii (opcja „Zapamietaj”), tabele `ai_suggestions` i `user_correction_memory`. Nie zaimplementowano masowej akceptacji wielu transakcji naraz ani osobnego UI do edycji regul pamieci.

Zakres:

- adapter AI,
- structured JSON output,
- walidacja odpowiedzi,
- progi pewnosci,
- kolejka recznej weryfikacji,
- pamiec korekt uzytkownika,
- generowanie opisu transakcji,
- tryb bez AI jako fallback.

Kryterium zakonczenia:

- transakcje z wysoka pewnoscia dostaja kategorie,
- transakcje niepewne trafiaja do weryfikacji,
- reczne poprawki wplywaja na przyszle sugestie.

## Etap 5. Backup, Restore i Bezpieczenstwo

Cel: aplikacja nadaje sie do dlugoterminowego uzywania.

**Implementacja (MVP, 2026-05-01):** backup szyfrowany CLI; `npm run backup:scheduled` + `BACKUP_RETENTION_DAYS` pod crona; restore bez zamykania dzialajacego polaczenia aplikacji przy tworzeniu kopii (osobne `Database` w `createEncryptedBackup`); audyt w `audit_events` + `/audit`; import i backup zapisuja meta bez kwot i opisow transakcji. Brak natywnej integracji Google Drive — uzyj `rclone` lub recznego kopiowania pliku `.cfo-backup.json`.

Zakres:

- backup reczny,
- backup automatyczny,
- szyfrowanie backupow,
- restore,
- audyt logowan i importow,
- ograniczenie danych w logach,
- instrukcja wdrozenia,
- opcjonalne Google Drive.

Kryterium zakonczenia:

- restore dziala na pustej instalacji,
- backup jest szyfrowany,
- logi nie ujawniaja danych finansowych.

## Etap 6. Inwestycje i Majatek Netto

Cel: pokazac pelniejszy obraz finansow.

**Implementacja (MVP, 2026-05-01):** tabele `investment_assets`, `investment_operations`, `investment_strategies`; UI **`/investments`** (aktywa, operacje, strategia z podzialem procentowym); dashboard rozszerzony o metryki portfela. Nadwyzka do podzialu liczona od **bilansu roku transakcji** (przychody minus wydatki), po odjeciu poduszki z strategii — bez laczenia automatycznie z saldem kont bankowych.

Zakres:

- aktywa inwestycyjne,
- reczne operacje,
- gotowka,
- majatek netto,
- zysk/strata,
- dywidendy,
- cele inwestycyjne,
- strategia alokacji nadwyzki.

Kryterium zakonczenia:

- dashboard pokazuje majatek netto i inwestycje,
- uzytkownik widzi, ile zostalo do zainwestowania,
- strategia miesieczna daje czytelna sugestie podzialu nadwyzki.

## Etap 7. Analityka i Rekomendacje

Cel: aplikacja pomaga podejmowac decyzje.

**Status wdrozenia w kodzie (2026-05-01):** **MVP zakonczony** — jak wyzej oraz **heurystyka** powtarzalnych oplat (`listHeuristicRecurringCandidates`, okno 6 miesiecy, grupowanie kontrahent/opis, filtr stabilnosci kwoty). **Etap 8 (czesciowo):** na **`/insights`** dodano **wykres liniowy** przychodow vs wydatkow (**12 miesiecy** konczacych sie na wybrany miesiac, `summarizeRollingMonthsForUser`, SVG).

Zakres:

- najwieksze wzrosty kosztow — **MVP (sortowanie zmiany m/m)**,
- subskrypcje i stale oplaty — **MVP (reczne `is_recurring` + heurystyka)**,
- prognoza konca miesiaca — **MVP (run-rate)**,
- rekomendacje optymalizacji wydatkow — **MVP (tekst z top wzrostami + prognoza + stale oplaty)**,
- porownania miesiac do miesiaca — **MVP**,
- eksport raportow CSV/PDF — **tak (raport analityczny z `/insights`)**; inne raporty PDF — opcjonalnie.

Kryterium zakonczenia (pelne):

- raport wskazuje konkretne kategorie do uwagi,
- rekomendacje pokazuja dane zrodlowe,
- uzytkownik moze podjac decyzje bez recznego liczenia.

## Etap 8. Funkcje Pozniejsze

**Stan kodu (2026-05-01):** Etap 8 **wdrozony** w planowanym zakresie: neutralny **PDF**, **OCR** paragonow (obrazy), **2FA TOTP**, **responsywnosc** (viewport, breakpointy, **`inline-form`**, **`card-heading-row`**, **`field-row`** na m.in. `/insights`, raportach, transakcjach, kolejce), **wykres 12 mies.** na `/insights`, **szablony nazw kolumn** (`import-presets`). **Backlog** (nie Etap 8): zautomatyzowane parsery per bank, automatyczne ceny/kursy (por. lista „Poza MVP”).

**Historyczna lista „po stabilizacji”** — wiele punktow jest juz w kodzie (m.in. PDF, OCR, 2FA, responsywnosc). Aktualne **otwarte** tematy: [Backlog](#backlog).

## Backlog

Lista rzeczy **swiadomie poza zamknietym MVP i Etapem 8** albo wymagajacych osobnej iniciatywy. Priorytety ustalacie Wy — kolejnosc ponizej nie jest narzucona.

### Import i dane bankowe

- **Automatyczne parsery** dla konkretnych bankow (format + testy na zanonimizowanych plikach, utrzymanie przy zmianach eksportow).
- Opcjonalnie: **bezpieczny parser legacy `.xls`** (obecnie odrzucony na rzecz CSV/XLSX).

### Analityka i AI

- **Kolejne wykresy / drill-down** na `/insights` (np. wybrane kategorie w czasie).
- **Masowa akceptacja** w kolejce `/review` (jesli nadal poza kodem).
- **UI do edycji regul pamieci korekt** (`user_correction_memory`).
- Rozszerzenia AI poza obecnym MVP (jasny zakres + limity kosztow).

### Inwestycje i majatek (por. tez „Poza MVP Etapu 6” w dokumencie)

- **Automatyczne ceny** aktywow (API broker / zrodla zewnetrzne + polityka odswiezania).
- **Automatyczne kursy walut** dla wielowalutowosci (jesli pojawi sie w modelu).
- **Zaawansowany rebalancing** z historii brokerow.
- **Powiazanie operacji inwestycyjnych z kontami bankowymi**.

### Bezpieczenstwo i wdrozenie

- **Publiczny dostep** (VPS): reverse proxy, **HTTPS**, limitowanie prob logowania, naglowki bezpieczenstwa, aktualizacje — patrz `docs/09_DEPLOYMENT_AND_OPERATIONS.md`.
- Opcjonalnie: **integracja backupu z Google Drive** w aplikacji (vs recznie/rclone).

### Jakosc i utrzymanie

- **Testy automatyczne** (np. E2E krytycznych sciezek) — obecnie glownie weryfikacja reczna.
- **Monitoring / alerty** na backup i dzialanie aplikacji (poza zakresem MVP).

---

## Plan weryfikacji recznej

Checklista do przejscia **przed uznaniem instalacji za „sprawdzona”** albo przed wiekszym releasem. Zaznaczaj punkty po kolei; zapisuj odstepstwa w notatkach wdrozenia. Pelniejszy kontekst operacyjny: `docs/09_DEPLOYMENT_AND_OPERATIONS.md`.

### A. Srodowisko i migracje

| # | Czynnosc | Oczekiwany wynik |
| --- | --- | --- |
| A1 | Uruchomienie wg `README` / Compose | Aplikacja startuje bez bledow w logach. |
| A2 | `npm run db:migrate` (lub rownowaznik w kontenerze) | Migracje aktualne, brak bledow SQL. |
| A3 | Seed / konta testowe | Mozna sie zalogowac dwoma uzytkownikami (lub jednym — jak w projekcie). |
| A4 | Zmienne srodowiskowe | `SESSION_SECRET` i ewent. klucze AI/backup ustawione zgodnie z `docs/09_*`. |

### B. Uwierzytelnianie i 2FA

| # | Czynnosc | Oczekiwany wynik |
| --- | --- | --- |
| B1 | Logowanie poprawne haslo | Przejscie do `/dashboard`, wpis w audycie `login_success`. |
| B2 | Logowanie zle haslo | Komunikat bledu, brak sesji. |
| B3 | **Wlaczenie 2FA** w `/settings/security` | QR + potwierdzenie kodem, komunikat sukcesu. |
| B4 | Wylogowanie i logowanie z 2FA | Po hasle redirect na `/login/totp`, po kodzie sesja i dashboard. |
| B5 | **Wylaczenie 2FA** (haslo + TOTP) | 2FA wylaczone, kolejne logowanie bez drugiego kroku. |

### C. Transakcje i raporty

| # | Czynnosc | Oczekiwany wynik |
| --- | --- | --- |
| C1 | Dodanie transakcji recznej | Widoczna na liscie, poprawna kwota i data. |
| C2 | Filtry na `/transactions` | Lista zgodna z filtrem. |
| C3 | Zmiana kategorii z listy | Zapis bez bledu. |
| C4 | Raport miesieczny / roczny | Kwoty zgodne z oczekiwaniami dla znanych danych testowych. |
| C5 | `/insights` — zmiana miesiaca, wykres 12 mies. | Dane i wykres sensowne przy niepustej historii. |

### D. Import (neutralny)

| # | Czynnosc | Oczekiwany wynik |
| --- | --- | --- |
| D1 | CSV z mapowaniem kolumn | Podglad wierszy, po zapisie transakcje w bazie. |
| D2 | Ten sam plik ponownie | Duplikaty pominiete lub zgodnie z regula deduplikacji. |
| D3 | Szablon kolumn (`?preset=...`) | Pola wypelnione nazwami kolumn; poprawka reczna gdy naglowki roznia sie. |
| D4 | PDF z tekstem / tabela | Parsowanie lub sensowny blad z komunikatem. |
| D5 | Obraz paragonu (OCR) | Tekst rozpoznany albo komunikat o braku tekstu / jakosci. |

### E. Review i AI (jesli wlaczone)

| # | Czynnosc | Oczekiwany wynik |
| --- | --- | --- |
| E1 | Transakcja w kolejce `/review` | Mozliwa zmiana kategorii i zapis. |
| E2 | Uruchomienie AI dla pozycji (jesli `AI_MODE` pozwala) | Sugestia albo kontrolowany blad; brak blokady calej aplikacji. |

### F. Inwestycje

| # | Czynnosc | Oczekiwany wynik |
| --- | --- | --- |
| F1 | Dodanie aktywa i operacji | Metryki na `/investments` i/lub dashboardzie sensowne. |
| F2 | Strategia z procentami | Sugestia podzialu bez bledu przy typowych danych. |

### G. Backup, audyt

| # | Czynnosc | Oczekiwany wynik |
| --- | --- | --- |
| G1 | `backup:create` (lub skrypt dokumentowany) | Plik kopii powstaje. |
| G2 | Restore na czystej instalacji (wg dokumentacji) | Dane odtworzone. |
| G3 | `/audit` | Widoczne zdarzenia logowania/importu (bez ujawniania pelnych kwot w logach serwera — spot check). |

### H. UI mobilny (smukły viewport)

| # | Czynnosc | Oczekiwany wynik |
| --- | --- | --- |
| H1 | Dashboard, import, transakcje, insights, raporty (~375px szer.) | Brak poziomego „lamania” krytycznych formularzy; przyciski zawijaja sie. |

### I. Release engineerski

| # | Czynnosc | Oczekiwany wynik |
| --- | --- | --- |
| I1 | `npm run build` | Sukces. |
| I2 | `npm run lint` | Bez ostrzezen ponad limit. |

**Uwaga:** pelna lista funkcji jest w kodzie i w `docs/04_ARCHITECTURE.md`; ta checklista pokrywa **sciezki krytyczne**, nie kazdy przycisk.

## Kolejnosc Priorytetow

1. Dane i prywatnosc.
2. Stabilny import.
3. Szybka korekta kategorii.
4. Raporty miesieczne i roczne.
5. Backup i restore.
6. AI jako pomocnik, nie fundament.
7. Inwestycje i strategia.
