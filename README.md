# Centrum Finansow Osobistych

Self-hosted aplikacja webowa do rejestrowania, importowania i analizowania finansow osobistych dla dwoch osob w rodzinie. Projekt ma laczyc szybkie wpisywanie wydatkow, import plikow bankowych, kategoryzacje wspierana przez AI, analize budzetow, majatku netto oraz inwestycji.

**Status implementacji (2026-05-01):** etapy **0–6 (MVP)** wedlug `docs/10_ROADMAP.md` — m.in. **`/investments`**, audyt **`/audit`**, `npm run backup:scheduled`, retencja `BACKUP_RETENTION_DAYS`. **Nastepny etap w kodzie:** **7** (analityka i rekomendacje) — **jeszcze nie wdrozony** (patrz *Punkt zatrzymania* w `docs/10_ROADMAP.md`). Presety importu pod konkretne banki nadal nie sa w kodzie; Google Drive w aplikacji — nie (mozliwy `rclone`).

**Punkt zatrzymania:** ostatnia pelna implementacja w repozytorium to **Etap 6**; **Etap 7** jest tylko w dokumentacji roadmapy.

**Cron backupu (przyklad):**

`0 3 * * * cd /sciezka/do/projektu && BACKUP_ENCRYPTION_KEY=twoj-klucz BACKUP_RETENTION_DAYS=14 npm run backup:scheduled`

## Glowny Cel

Aplikacja ma pomagac kontrolowac wydatki i przychody, zrozumiec strukture kosztow wedlug kategorii oraz podpowiadac, gdzie mozna ograniczyc niepotrzebne wydatki. Dane maja byc przechowywane pod kontrola wlasciciela aplikacji, najlepiej lokalnie lub na tanim, dobrze zabezpieczonym hostingu.

## Zakres MVP

- lokalne konta dla dwoch osob,
- oddzielne widoki i budzety,
- szybkie reczne dodawanie transakcji,
- import CSV/XLS z mBank, PKO BP, Revolut i ZEN,
- wykrywanie duplikatow,
- zagniezdzone kategorie przychodow, wydatkow i inwestycji,
- sugestie kategorii przez AI z kolejka recznej weryfikacji,
- dashboard roczny i miesieczny,
- raporty, trendy i prognoza konca miesiaca,
- podstawowe inwestycje i majatek netto,
- backup, odtwarzanie danych i audyt dostepu.

## Uruchomienie Developerskie

1. Zainstaluj zaleznosci:

```bash
npm install
```

2. Przygotuj lokalne zmienne:

```bash
cp .env.example .env.local
```

3. Ustaw w `.env.local` hasla dla `SEED_USER_1_PASSWORD` i `SEED_USER_2_PASSWORD`.

4. Utworz baze i dwa lokalne konta:

```bash
npm run db:seed
```

5. Uruchom aplikacje:

```bash
npm run dev
```

Aplikacja bedzie dostepna pod `http://localhost:3000`.

## Weryfikacja Fundamentu

```bash
npm run lint
npm run typecheck
npm run verify:foundation
```

## Lokalny Szyfrowany Backup

Przed realnym wpisywaniem danych ustaw mocny `BACKUP_ENCRYPTION_KEY` w `.env.local` albo w srodowisku terminala.

Utworzenie backupu:

```bash
BACKUP_ENCRYPTION_KEY=twoj-sekretny-klucz npm run backup:create
```

Weryfikacja backupu:

```bash
BACKUP_ENCRYPTION_KEY=twoj-sekretny-klucz npm run backup:verify -- ./backups/nazwa-pliku.cfo-backup.json
```

Restore:

```bash
BACKUP_ENCRYPTION_KEY=twoj-sekretny-klucz npm run backup:restore -- ./backups/nazwa-pliku.cfo-backup.json
```

Restore zachowuje poprzednia baze jako plik `.pre-restore-*` obok aktualnej bazy. Nie przechowuj klucza backupu w repozytorium.

## Inwestycje (Etap 6 MVP)

- Widok **`/investments`**: reczne aktywa (ETF, akcje, obligacje, krypto, IKE/IKZE, gotowka), startowa wartosc i koszt, operacje (wycena, kupno, dywidenda, wplata/wyplata, sprzedaz), strategia z poduszka PLN i do trzech celow procentowych — **sugestia podzialu** liczona od bilansu roku transakcji.
- Dashboard pokazuje lacznie wartosc portfela, koszt bazy i wynik (P/L).

## Zaplanowany backup i audyt

- `npm run backup:scheduled` — tworzy kopie jak `backup:create` oraz (jesli `BACKUP_RETENTION_DAYS` > 0) usuwa najstarsze pliki `*.cfo-backup.json` z `BACKUP_DESTINATION`. Uruchamiaj z crona (np. codziennie w nocy).
- Zdarzenia **logowania, wylogowania, importu, backupu/restore** trafiaja do tabeli audytu; w UI: **`/audit`** (bez kwot i opisow transakcji w meta).

## AI i kolejka weryfikacji

- Konfiguracja w `.env` / `.env.local`: `AI_MODE` (`disabled` domyslnie), `AI_BASE_URL` (np. Ollama `http://127.0.0.1:11434/v1`), `AI_MODEL`, opcjonalnie `AI_API_KEY`, `AI_CONFIDENCE_AUTO`, `AI_CONFIDENCE_REVIEW` — patrz `.env.example`.
- Widok **`/review`**: transakcje ze statusem `needs_review` (m.in. po imporcie), uruchomienie AI dla pojedynczej pozycji albo batch (25 najstarszych), reczny wybor kategorii z opcja **Zapamietaj** (pamiec korekt stosowana przed kolejnym wywolaniem modelu).
- Przy **zewnetrznym** API (`AI_MODE=external`) dane transakcji opuszczaja serwer — widok `/review` pokazuje przypomnienie.
- W **Dockerze** wywolanie Ollama na hoście czesto wymaga adresu typu `http://host.docker.internal:11434/v1` zamiast `127.0.0.1`.

## Transakcje Reczne

Po utworzeniu i przetestowaniu backupu mozna zaczac dodawac testowe transakcje w aplikacji:

- `/transactions` - formularz szybkiego dodania przychodu lub wydatku,
- podstawowe filtry po typie, kategorii i tekscie,
- zmiana kategorii z listy transakcji (z opcjonalnym zapamietaniem wzorca),
- dashboard pokazuje realne sumy przychodow, wydatkow i bilansu z biezacego roku.

## Budzety i Raport Miesieczny

Widok `/reports/monthly` pozwala wybrac miesiac, sprawdzic przychody, wydatki i bilans oraz ustawic limit PLN dla kategorii wydatkowej. Raport pokazuje wykorzystanie budzetu per kategoria i pozostala kwote.

## Raport Roczny

Widok `/reports/yearly` pokazuje podsumowanie roku, miesieczne przychody, wydatki i bilans oraz najwieksze kategorie wydatkow w wybranym roku.

## Neutralny Import CSV/XLSX

Widok `/imports` pozwala wgrac CSV albo XLSX, recznie wpisac nazwy kolumn, zobaczyc podglad i dopiero potem zapisac transakcje. Import nie przechowuje pliku zrodlowego po przetworzeniu. Legacy XLS jest na razie odrzucany; wyeksportuj plik jako CSV albo XLSX.

## Docker LAN

Docker Compose uruchamia aplikacje z trwalym wolumenem na SQLite:

```bash
cp .env.example .env
docker compose run --rm app npm run db:seed
docker compose up --build
```

Przed realnym uzyciem danych finansowych nalezy dodac i przetestowac szyfrowany backup/restore, zgodnie z `docs/10_ROADMAP.md`.

## Kolejnosc Czytania Dokumentow

1. `docs/00_PROJECT_OVERVIEW.md` - wizja, zakres i najwazniejsze decyzje.
2. `docs/01_PRD.md` - Product Requirements Document.
3. `docs/02_FUNCTIONAL_REQUIREMENTS.md` - wymagania funkcjonalne.
4. `docs/03_NON_FUNCTIONAL_REQUIREMENTS.md` - wymagania niefunkcjonalne.
5. `docs/04_ARCHITECTURE.md` - architektura aplikacji, utrzymywana wraz z projektem.
6. `docs/05_DATA_MODEL.md` - model danych.
7. `docs/06_IMPORTS.md` - importy bankowe.
8. `docs/07_AI_CATEGORIZATION.md` - AI, kategoryzacja i rekomendacje.
9. `docs/08_SECURITY_AND_PRIVACY.md` - bezpieczenstwo i prywatnosc.
10. `docs/09_DEPLOYMENT_AND_OPERATIONS.md` - wdrozenie i operacje.
11. `docs/10_ROADMAP.md` - etapy budowy.
12. `docs/11_DECISIONS.md` - decyzje architektoniczne.

## Zasady Projektowe

- Prostota utrzymania jest wazniejsza niz rozbudowana architektura.
- Kazda funkcja powinna miec jasny powod i mierzalny efekt.
- Importy bankowe musza byc walidowane na prawdziwych przykladowych plikach.
- AI ma pomagac, ale nie moze bez kontroli zmieniac danych finansowych.
- Dane finansowe nie powinny trafiac do logow aplikacji.
- Dokument `docs/04_ARCHITECTURE.md` jest zrodlem prawdy o architekturze i powinien byc aktualizowany przy kazdej istotnej zmianie technicznej.
