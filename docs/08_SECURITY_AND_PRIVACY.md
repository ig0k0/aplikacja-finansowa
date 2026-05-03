# 08. Bezpieczenstwo i Prywatnosc

Data dokumentu: 2026-05-01

## 1. Cel

Aplikacja przechowuje dane finansowe, dlatego bezpieczenstwo i prywatnosc sa wymaganiami podstawowymi. Ten dokument opisuje minimalny model ochrony danych dla wersji self-hosted.

## 2. Dane Wrazliwe

Za wrazliwe uznajemy:

- transakcje,
- kwoty,
- opisy i kontrahentow,
- numery rachunkow lub ich fragmenty,
- pliki importu,
- informacje o inwestycjach,
- strategie inwestycyjne,
- backupy,
- dane logowania.

## 3. Model Zagrozen

Najwazniejsze zagrozenia:

- nieuprawniony dostep do aplikacji,
- wyciek backupu,
- wyslanie danych do AI bez swiadomej zgody,
- ujawnienie danych w logach,
- blad separacji danych miedzy dwoma uzytkownikami,
- utrata danych przez awarie dysku,
- przypadkowy import duplikatow lub blednych danych,
- przejecie aplikacji wystawionej do internetu.

## 4. Zasady Dostepu

- Kazdy uzytkownik ma wlasne konto.
- Kazdy rekord finansowy musi byc przypisany do uzytkownika.
- Kontrola dostepu musi dzialac po stronie serwera.
- UI nie jest granica bezpieczenstwa.
- Brak rol w MVP, bo sa tylko dwa rownorzedne konta.

## 5. Hasla i Sesje

Wymagania:

- hasla hashowane nowoczesnym algorytmem,
- brak hasel jawnych w bazie,
- sekrety sesji poza repozytorium,
- ciasteczka sesji z bezpiecznymi flagami,
- wylogowanie uniewaznia sesje,
- opcjonalne 2FA jako P1, jesli nie komplikuje MVP.

## 6. AI i Prywatnosc

Tryb lokalny:

- preferowany,
- dane zostaja na infrastrukturze uzytkownika,
- nadal wymagane jest ograniczanie promptow do minimum.

Tryb zewnetrzny:

- musi byc swiadomie wlaczony,
- UI powinno pokazac, jaki provider jest aktywny,
- uzytkownik powinien wiedziec, jakie dane sa wysylane,
- nie nalezy wysylac danych drugiego uzytkownika,
- nie nalezy wysylac pelnej historii, jesli wystarczy pojedyncza transakcja i krotki kontekst.

## 7. Logi

Logi moga zawierac:

- identyfikator requestu,
- typ zdarzenia,
- status,
- czas trwania,
- techniczny kod bledu,
- identyfikator importu.

Logi nie powinny zawierac:

- pelnych opisow transakcji,
- kompletnych kwot z kontrahentem,
- numerow rachunkow,
- promptow AI z danymi finansowymi,
- zawartosci plikow importu,
- sekretow.

## 8. Backup

Backup jest wymagany od MVP.

Wymagania:

- backup bazy danych,
- backup szyfrowany,
- checksum backupu,
- metadane wersji aplikacji,
- instrukcja restore,
- okresowe testowanie restore.

Pierwszy mechanizm backupu jest lokalny:

- backup jest zaszyfrowanym plikiem JSON,
- klucz pochodzi z `BACKUP_ENCRYPTION_KEY`,
- backup zawiera checksum bazy i metadane wersji aplikacji,
- verify sprawdza checksum oraz integralnosc SQLite,
- restore zachowuje poprzednia baze jako `.pre-restore-*`.

Miejsca backupu:

- lokalny dysk lub NAS,
- Google Drive po skonfigurowaniu,
- inne miejsce dopiero po jawnej decyzji.

## 9. Szyfrowanie

Minimalnie:

- szyfrowane backupy,
- sekrety poza repozytorium,
- HTTPS przy dostepie przez internet.

Opcjonalnie:

- szyfrowanie wybranych pol w bazie,
- szyfrowanie plikow tymczasowych,
- osobny klucz per instalacja.

Decyzja o szyfrowaniu pol w bazie wymaga uwagi, bo moze utrudnic wyszukiwanie i raporty. Nie nalezy wdrazac skomplikowanego szyfrowania bez jasnego planu operacyjnego dla kluczy i restore.

## 10. Dostep Przez Internet

Najbezpieczniejsze warianty:

1. Tylko siec lokalna.
2. Dostep przez VPN lub Tailscale.
3. VPS z HTTPS, reverse proxy, aktualizacjami i ograniczeniem logowania.

Jesli aplikacja jest publicznie dostepna przez internet, wymagane sa:

- HTTPS,
- silne hasla,
- rate limiting logowania,
- regularne aktualizacje,
- ograniczenie logow,
- monitoring backupow,
- sprawdzony restore.

## 11. Audyt

Audyt powinien obejmowac:

- logowania,
- nieudane logowania,
- import pliku,
- usuniecie importu,
- backup,
- restore,
- zmiane konfiguracji AI,
- eksport danych,
- trwałe usuniecie danych.

Audyt nie powinien zawierac pelnych danych finansowych.

## 12. Usuwanie Danych

Uzytkownik powinien moc:

- usunac pojedyncze transakcje,
- usunac import batch,
- usunac swoje dane,
- wyeksportowac dane przed usunieciem.

Trwale usuwanie powinno byc oddzielone od zwyklej edycji, z potwierdzeniem.

## 13. Pliki Importu

Domyslnie:

- plik jest zapisywany tymczasowo,
- aplikacja parsuje i waliduje dane,
- po imporcie plik jest usuwany,
- w bazie zostaja tylko dane potrzebne do audytu i transakcji.

Archiwizacja plikow zrodlowych jest poza MVP i wymaga szyfrowania.

## 14. Sekrety

Sekrety:

- sekret sesji,
- haslo bazy,
- klucz szyfrowania backupu,
- token Google Drive,
- klucz zewnetrznego AI.

Zasady:

- nigdy nie commitowac sekretow,
- uzywac `.env` lokalnie,
- dostarczyc `.env.example` bez prawdziwych wartosci,
- opisac rotacje sekretow w dokumentacji wdrozenia.

## 15. Minimalna Checklista Bezpieczenstwa Przed Pierwszym Uzyciem

- Utworzono dwa konta z silnymi haslami.
- Ustawiono sekret sesji.
- Ustawiono klucz szyfrowania backupu.
- Wykonano pierwszy backup testowy.
- Przetestowano restore na pustej instalacji.
- Sprawdzono, czy logi nie zawieraja danych transakcji.
- Jesli aplikacja jest w internecie, wlaczono HTTPS i ograniczenie logowania.
- Ustalono, czy AI dziala lokalnie czy zewnetrznie.
