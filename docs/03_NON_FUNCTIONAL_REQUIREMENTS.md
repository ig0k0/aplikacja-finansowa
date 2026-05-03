# 03. Wymagania Niefunkcjonalne

Data dokumentu: 2026-05-01

## 1. Prywatnosc

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| NFR-PRI-001 | P0 | Dane finansowe sa przechowywane pod kontrola wlasciciela aplikacji. | Domyslne wdrozenie dziala lokalnie albo na wskazanym VPS bez zaleznosci od SaaS dla danych. |
| NFR-PRI-002 | P0 | Zewnetrzne AI jest opcjonalne. | Aplikacja dziala bez klucza do zewnetrznego modelu. |
| NFR-PRI-003 | P0 | Uzytkownik widzi, kiedy dane sa wysylane poza serwer. | Konfiguracja AI pokazuje provider, zakres danych i status wlaczenia. |
| NFR-PRI-004 | P0 | Logi nie zawieraja pelnych danych transakcji. | Logi techniczne nie zapisuja pelnego opisu, kwoty i kontrahenta w jednej linii. |
| NFR-PRI-005 | P1 | Tymczasowe pliki importu sa usuwane po przetworzeniu. | Po imporcie pliki zrodlowe nie pozostaja w katalogu roboczym. |

## 2. Bezpieczenstwo

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| NFR-SEC-001 | P0 | Hasla sa przechowywane jako bezpieczne hashe. | W bazie nie ma hasel jawnych. |
| NFR-SEC-002 | P0 | Sesje uzytkownikow sa chronione podpisanym sekretem. | Zmiana sekretu uniewaznia stare sesje. |
| NFR-SEC-003 | P0 | Dostep do danych jest sprawdzany po stronie serwera. | Zapytanie do danych innego uzytkownika jest odrzucone. |
| NFR-SEC-004 | P0 | Sekrety sa konfigurowane przez zmienne srodowiskowe. | Repozytorium nie zawiera kluczy, tokenow ani hasel. |
| NFR-SEC-005 | P1 | Aplikacja wspiera HTTPS przy dostepie przez internet. | Dokumentacja wdrozenia opisuje reverse proxy i certyfikat. |
| NFR-SEC-006 | P1 | Dostep przez internet powinien miec rate limiting logowania. | Wielokrotne bledne logowania sa ograniczane. |
| NFR-SEC-007 | P1 | Audyt zapisuje wazne zdarzenia bez ujawniania danych finansowych. | Audyt obejmuje logowanie, import, backup i restore. |

## 3. Szyfrowanie

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| NFR-ENC-001 | P0 | Backupy sa szyfrowane. | Plik backupu nie jest czytelny bez klucza. |
| NFR-ENC-002 | P1 | Wrazliwe pola moga byc szyfrowane aplikacyjnie. | Opis transakcji i kontrahent moga byc zaszyfrowane w bazie, jesli nie komplikuje to nadmiernie MVP. |
| NFR-ENC-003 | P1 | Klucze szyfrujace nie sa przechowywane w repozytorium. | Klucze pochodza ze zmiennych srodowiskowych albo managera sekretow. |

## 4. Wydajnosc

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| NFR-PERF-001 | P0 | Aplikacja jest wygodna dla dwoch osob i kilku lat historii. | Lista transakcji dziala plynnie dla co najmniej 50 000 transakcji. |
| NFR-PERF-002 | P0 | Import miesiecznego pliku konczy sie szybko. | Import 1 000 transakcji trwa ponizej 30 sekund bez AI albo pokazuje postep przy dluzszym przetwarzaniu AI. |
| NFR-PERF-003 | P1 | Kategoryzacja AI moze dzialac w tle. | Uzytkownik nie musi trzymac otwartego ekranu importu. |
| NFR-PERF-004 | P1 | Dashboard nie wykonuje kosztownych obliczen przy kazdym odswiezeniu. | Najciezsze agregacje sa cacheowane albo liczone efektywnym zapytaniem. |

## 5. Niezawodnosc

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| NFR-REL-001 | P0 | Import jest transakcyjny. | Nieudany import nie zapisuje polowy pliku jako gotowych danych. |
| NFR-REL-002 | P0 | Duplikaty nie moga byc latwo utworzone przez ponowny import. | System tworzy stabilny odcisk transakcji. |
| NFR-REL-003 | P0 | Restore z backupu jest testowalny. | Istnieje instrukcja odtworzenia na pustej instalacji. |
| NFR-REL-004 | P1 | Aplikacja pokazuje bledy importu w sposob zrozumialy. | Uzytkownik widzi problem z kolumna, data albo waluta bez czytania logow. |

## 6. Utrzymanie

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| NFR-MAINT-001 | P0 | Architektura jest prosta i monolityczna na start. | Podstawowe funkcje nie wymagaja wielu niezaleznych serwisow. |
| NFR-MAINT-002 | P0 | Aplikacja jest uruchamiana przez Docker Compose. | Nowa instalacja wymaga wypelnienia `.env` i uruchomienia compose. |
| NFR-MAINT-003 | P0 | Migracje bazy sa wersjonowane. | Aktualizacja aplikacji wykonuje kontrolowane migracje. |
| NFR-MAINT-004 | P0 | Dokument architektury jest aktualizowany przy istotnych zmianach. | Zmiana modelu danych lub integracji ma wpis w dokumentacji. |
| NFR-MAINT-005 | P1 | Decyzje architektoniczne sa zapisywane w `docs/11_DECISIONS.md`. | Kazda istotna decyzja ma kontekst i konsekwencje. |

## 7. Przenosnosc i Open Source

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| NFR-PORT-001 | P0 | Projekt nie blokuje danych w zamknietym formacie. | Dane mozna wyeksportowac do CSV lub JSON. |
| NFR-PORT-002 | P0 | Aplikacja dziala na macOS, Windows i Linux przez przegladarke. | Uzytkownik potrzebuje tylko przegladarki do korzystania. |
| NFR-PORT-003 | P0 | Repozytorium moze byc open-source bez ujawniania sekretow. | `.env` nie jest wersjonowany, a przyklady sekretow sa fikcyjne. |

## 8. Dostepnosc Operacyjna

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| NFR-OPS-001 | P0 | Aplikacja powinna dzialac na tanim sprzecie. | Wariant MVP nie wymaga dedykowanej karty GPU. |
| NFR-OPS-002 | P0 | Lokalny AI jest opcjonalny operacyjnie. | Bez Ollama mozna uzywac recznej kategoryzacji albo prostego fallbacku. |
| NFR-OPS-003 | P1 | System ma prosty health check. | Wdrozenie moze sprawdzic, czy aplikacja i baza dzialaja. |
| NFR-OPS-004 | P1 | Backup ma harmonogram. | Mozna ustawic automatyczny backup np. codziennie lub tygodniowo. |

## 9. Jakosc

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| NFR-QUAL-001 | P0 | Najwazniejsze przeplywy maja testy. | Testy obejmuja logowanie, import, deduplikacje i raporty. |
| NFR-QUAL-002 | P0 | Parsery importu maja testy na przykladowych plikach. | Kazdy bank ma fixture i oczekiwane transakcje. |
| NFR-QUAL-003 | P1 | AI ma testy kontraktu odpowiedzi. | Odpowiedz modelu jest walidowana przez schemat JSON. |
| NFR-QUAL-004 | P1 | UI ma test podstawowej sciezki uzytkownika. | Test E2E loguje sie, importuje plik i poprawia kategorie. |
