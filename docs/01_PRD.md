# 01. Product Requirements Document

Data dokumentu: 2026-05-01

## 1. Podsumowanie

Aplikacja jest self-hosted centrum finansow osobistych dla dwoch osob. Ma obslugiwac wydatki, przychody, majatek netto, inwestycje, importy bankowe oraz AI wspierajace kategoryzacje i optymalizacje wydatkow.

Najwazniejszy efekt produktu: uzytkownik po imporcie danych widzi, gdzie ida pieniadze, jakie kategorie rosna, jakie koszty sa potencjalnie niepotrzebne i ile moze przeznaczyc na cele inwestycyjne.

## 2. Cele Produktowe

- Kontrola wydatkow i przychodow w ujeciu miesiecznym oraz rocznym.
- Analiza kategorii i trendow.
- AI wspierajace klasyfikacje transakcji oraz rekomendacje ograniczenia niepotrzebnych kosztow.
- Oddzielne widoki dla dwoch uzytkownikow.
- Reczny i plikowy import danych.
- Widok majatku netto oraz inwestycji.
- Proste, tanie i dlugoterminowe self-hosted utrzymanie.

## 3. Antycele

Projekt na start nie ma byc:

- aplikacja bankowa z automatyczna synchronizacja kont,
- rozbudowanym systemem ksiegowym,
- aplikacja mobilna,
- narzedziem do rozliczania wydatkow miedzy domownikami,
- platforma SaaS dla wielu gospodarstw domowych,
- systemem podatkowym dla inwestycji.

## 4. Persony

### Uzytkownik rodzinny

Chce raz lub dwa razy w tygodniu sprawdzic sytuacje finansowa, zaimportowac pliki z banku, poprawic niepewne kategorie i zobaczyc, czy miesiac idzie zgodnie z planem.

### Uzytkownik inwestujacy

Chce wiedziec, ile zostalo po kosztach, ile powinien przeznaczyc na cele inwestycyjne, jaka jest wartosc portfela oraz czy alokacja wymaga rebalancingu.

## 5. Zakres Funkcjonalny

### Konta i dostep

- Dwa lokalne konta uzytkownikow.
- Proste logowanie haslem.
- Brak zaawansowanych rol w MVP.
- Dane uzytkownikow odseparowane w aplikacji.
- Opcjonalne 2FA jako funkcja po MVP, jesli zostanie wdrozone prosto.

### Transakcje

- Rejestr przychodow i wydatkow.
- Kwota raportowana w PLN.
- Data transakcji jako podstawowa data raportowania.
- Sklep/kontrahent, opis, kategoria, tagi opcjonalne.
- Szybkie reczne dodawanie transakcji.
- Wykrywanie przelewow miedzy wlasnymi kontami.
- Oznaczanie transakcji cyklicznych.

### Kategorie

Kategorie sa zagniezdzone i obejmuja co najmniej:

- Przychody:
  - wynagrodzenie,
  - zarobek z platform sprzedazowych,
  - obligacje,
  - akcje,
  - prezent.
- Wydatki:
  - jedzenie w domu,
  - jedzenie w pracy.
- Transport:
  - karta miejska/bilety,
  - taxi,
  - hulajnoga.
- Elektronika:
  - sprzet elektroniczny,
  - oprogramowanie,
  - subskrypcje.
- Zdrowie i higiena:
  - leki,
  - fryzjer,
  - kosmetyki,
  - lekarze,
  - inne.
- Ubrania:
  - ubrania zwykle,
  - ubrania sportowe,
  - buty,
  - dodatki.
- Nauka:
  - studia czesne,
  - kursy informatyka,
  - kursy inne.
- Rozrywka:
  - sport i silownia,
  - kino,
  - koncerty,
  - ksiazki,
  - wyjscia ze znajomymi.

Lista kategorii powinna byc edytowalna, ale MVP moze zaczac od kategorii predefiniowanych.

### Importy

- Import z plikow CSV, XLS i XLSX.
- Obslugiwane zrodla: mBank, PKO BP, Revolut, ZEN.
- Kazdy import jest przypisany do uzytkownika i konta finansowego.
- Aplikacja zapamietuje mapowanie kolumn dla banku i typu pliku.
- Aplikacja wykrywa duplikaty.
- Import PDF jest zaplanowany po MVP.

### AI

- AI sugeruje kategorie, opis transakcji oraz potencjalne tagi.
- AI uwzglednia sklep, opis, kwote, historie uzytkownika, konto i date.
- AI zwraca poziom pewnosci.
- Transakcje niepewne trafiaja do recznej weryfikacji.
- Reczna korekta uczy system przyszlych decyzji.
- Reguly i korekty uzytkownika maja pierwszenstwo przed odpowiedzia AI.
- Lokalny model jest preferowany; zewnetrzne API moze byc opcjonalne.

### Dashboard i raporty

Dashboard powinien pokazac:

- przychody w roku,
- wydatki w roku,
- saldo miesieczne,
- majatek netto,
- kwote zainwestowana,
- wynik inwestycji,
- trendy wydatkow,
- kategorie o najwiekszym wzroscie,
- prognoze konca miesiaca.

Raporty:

- miesieczny,
- roczny,
- porownanie miesiac do miesiaca,
- eksport CSV/PDF.

### Inwestycje

Zakres obejmuje:

- ETF,
- akcje,
- obligacje,
- krypto,
- IKE/IKZE,
- gotowke.

Aplikacja ma wspierac:

- reczne wpisywanie pozycji,
- wartosc w PLN,
- wplaty,
- zyski,
- dywidendy,
- alokacje portfela,
- cele inwestycyjne,
- miesieczna strategie inwestowania nadwyzki,
- rebalancing.

Automatyczne pobieranie cen aktywow jest wazne, ale moze byc etapem po MVP.

## 6. Wymagania UX

- UI po polsku.
- Najwazniejszy widok: dashboard.
- Lista transakcji ma miec szybkie wyszukiwanie, filtrowanie i edycje kategorii.
- Import ma byc prowadzony krok po kroku.
- Widok "do weryfikacji" ma byc latwy do opracowania w krotkiej sesji.
- Dark mode jest mile widziany, ale nie powinien opozniac MVP.

## 7. Bezpieczenstwo i Prywatnosc

- Dane finansowe sa wrazliwe i powinny byc chronione domyslnie.
- Aplikacja moze dzialac lokalnie w domu albo na tanim VPS.
- Backup jest wymagany.
- Restore z backupu jest wymagany.
- Logi nie powinny zawierac pelnych danych transakcji.
- Aplikacja powinna miec audyt logowan i dostepu.
- Uzytkownik powinien moc trwale usunac dane.

## 8. Wymagania Techniczne

- Preferowany prosty stack full-stack.
- Docker Compose jako domyslna metoda uruchomienia.
- Lekka baza danych na start, z decyzja SQLite vs PostgreSQL opisana w ADR.
- Brak publicznego API w MVP, chyba ze wymaga tego framework.
- Projekt open-source.
- Komponent AI powinien byc wymienialny: lokalny model lub zewnetrzny provider.

## 9. Mierniki Sukcesu

- Import typowego miesiaca transakcji konczy sie bez duplikatow.
- Uzytkownik moze poprawic wszystkie niepewne transakcje z jednego widoku.
- Dashboard odpowiada na pytanie: "ile zarobilem, ile wydalem, ile zostalo i ile moge zainwestowac".
- Aplikacja pozwala odtworzyc dane po awarii z backupu.
- Dokumentacja architektury zgadza sie z implementacja.

## 10. Otwarte Decyzje

Te decyzje wymagaja potwierdzenia przed implementacja:

- SQLite czy PostgreSQL jako pierwsza baza produkcyjna.
- Lokalny AI jako domyslny czy opcjonalny modul uruchamiany osobno.
- Czy aplikacja ma byc dostepna tylko w LAN, czy takze przez internet.
- Jaki dokladnie poziom szyfrowania danych wdrozyc w MVP.
- Ktore formaty plikow bankowych sa pierwsze po analizie przykladowych eksportow.
