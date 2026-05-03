# 02. Wymagania Funkcjonalne

Data dokumentu: 2026-05-01

Priorytety:

- P0 - wymagane w MVP.
- P1 - wymagane w pierwszej stabilnej wersji.
- P2 - pozniejszy rozwoj.

## 1. Konta Uzytkownikow

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| FR-AUTH-001 | P0 | Aplikacja pozwala utworzyc dwa lokalne konta uzytkownikow. | Administrator podczas konfiguracji moze utworzyc dwa konta z haslami. |
| FR-AUTH-002 | P0 | Uzytkownik loguje sie haslem. | Po poprawnym logowaniu widzi tylko swoje dane. |
| FR-AUTH-003 | P0 | Dane finansowe sa odseparowane per uzytkownik. | Uzytkownik A nie widzi transakcji, kont i raportow uzytkownika B. |
| FR-AUTH-004 | P1 | Aplikacja rejestruje audyt logowan. | Widoczna jest data, uzytkownik i wynik proby logowania. |
| FR-AUTH-005 | P1 | Aplikacja moze wlaczyc 2FA, jesli zostanie to zrobione prostym mechanizmem. | Konto moze wymagac drugiego skladnika przy logowaniu. |

## 2. Konta Finansowe

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| FR-ACC-001 | P0 | Uzytkownik moze dodac konto finansowe. | Konto ma nazwe, typ, walute bazowa i zrodlo. |
| FR-ACC-002 | P0 | Konto finansowe jest przypisane do jednego uzytkownika. | Raporty filtrują transakcje wedlug kont uzytkownika. |
| FR-ACC-003 | P0 | Aplikacja obsluguje wiele kont z jednego banku. | Uzytkownik moze miec np. dwa konta mBank. |
| FR-ACC-004 | P1 | Aplikacja pokazuje saldo konta na podstawie importu lub danych recznych. | Saldo jest widoczne na dashboardzie i w widoku kont. |

## 3. Transakcje

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| FR-TXN-001 | P0 | Uzytkownik moze dodac wydatek recznie. | Formularz przyjmuje date, kwote PLN, sklep/opis i kategorie. |
| FR-TXN-002 | P0 | Uzytkownik moze dodac przychod recznie. | Przychod pojawia sie w raportach przychodow. |
| FR-TXN-003 | P0 | Transakcja ma typ: przychod, wydatek, transfer albo inwestycja. | Typ jest zapisany i uzywany w raportach. |
| FR-TXN-004 | P0 | Transakcja ma date transakcji jako glowna date raportowania. | Raport miesieczny klasyfikuje transakcje wedlug tej daty. |
| FR-TXN-005 | P0 | Aplikacja przechowuje kwote w PLN. | Raporty sumuja wartosci w PLN. |
| FR-TXN-006 | P0 | Aplikacja moze zapisac oryginalna walute i kwote. | Transakcja walutowa pokazuje oryginalna kwote i przeliczenie. |
| FR-TXN-007 | P0 | Uzytkownik moze edytowac kategorie z listy transakcji. | Zmiana kategorii nie wymaga wejscia w osobny ekran szczegolow. |
| FR-TXN-008 | P0 | Uzytkownik moze wyszukiwac transakcje. | Wyszukiwarka znajduje po sklepie, opisie, kategorii i kwocie. |
| FR-TXN-009 | P0 | Uzytkownik moze filtrowac transakcje. | Filtry obejmuja date, konto, kategorie, tag, kwote i typ. |
| FR-TXN-010 | P1 | Aplikacja wykrywa transfery miedzy wlasnymi kontami. | Dopasowane transfery nie zawyzaja wydatkow i przychodow. |
| FR-TXN-011 | P1 | Aplikacja obsluguje transakcje cykliczne. | System pokazuje subskrypcje i stale koszty. |
| FR-TXN-012 | P2 | Jedna transakcja moze miec wiele kategorii, gdy jest to jasne. | Transakcja moze miec podzial kategorii bez dzielenia pozycji zakupowych. |

## 4. Kategorie

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| FR-CAT-001 | P0 | Kategorie sa zagniezdzone. | Kategoria moze miec rodzica i dzieci. |
| FR-CAT-002 | P0 | Aplikacja zawiera startowy zestaw kategorii z PRD. | Nowy uzytkownik ma gotowa liste kategorii. |
| FR-CAT-003 | P0 | Uzytkownik moze zmieniac kategorie transakcji. | Zmiana jest zapisana i widoczna w raportach. |
| FR-CAT-004 | P1 | Uzytkownik moze zarzadzac lista kategorii. | Mozna dodac, zmienic nazwe i ukryc kategorie. |
| FR-CAT-005 | P1 | Kategorie inwestycyjne sa oddzielone od zwyklych wydatkow. | Raport wydatkow nie miesza zakupow inwestycyjnych z konsumpcja. |

## 5. Import Plikow

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| FR-IMP-001 | P0 | Uzytkownik moze wrzucic plik CSV. | Aplikacja pokazuje podglad transakcji z pliku. |
| FR-IMP-002 | P0 | Uzytkownik moze wrzucic plik XLS/XLSX. | Aplikacja pokazuje podglad transakcji z arkusza. |
| FR-IMP-003 | P0 | Import wspiera mBank, PKO BP, Revolut i ZEN. | Dla kazdego zrodla istnieje parser lub mapowanie kolumn. |
| FR-IMP-004 | P0 | Aplikacja zapamietuje mapowanie kolumn. | Kolejny import tego samego formatu nie wymaga recznego mapowania. |
| FR-IMP-005 | P0 | Aplikacja wykrywa duplikaty. | Ponowny import tego samego pliku nie tworzy drugich transakcji. |
| FR-IMP-006 | P0 | Import pokazuje podsumowanie. | Uzytkownik widzi liczbe nowych, pominietych i niepewnych pozycji. |
| FR-IMP-007 | P1 | Import waliduje ciaglosc salda, jesli plik zawiera saldo. | Aplikacja ostrzega o przerwach lub niespojnosciach. |
| FR-IMP-008 | P2 | Aplikacja importuje PDF. | PDF przechodzi ekstrakcje i walidacje przed zapisaniem transakcji. |

## 6. AI i Weryfikacja

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| FR-AI-001 | P0 | AI sugeruje kategorie transakcji. | Sugestia zawiera kategorie i poziom pewnosci. |
| FR-AI-002 | P0 | AI sugeruje krotki opis transakcji. | Opis jest zrozumialy po polsku i mozna go edytowac. |
| FR-AI-003 | P0 | Niska pewnosc trafia do recznej weryfikacji. | Transakcja jest widoczna w kolejce "do weryfikacji". |
| FR-AI-004 | P0 | Reczna korekta ma pierwszenstwo przed AI. | Poprawiona transakcja nie jest nadpisywana przez kolejna sugestie. |
| FR-AI-005 | P1 | System uczy sie z recznych korekt. | Podobne przyszle transakcje dostaja lepsza sugestie. |
| FR-AI-006 | P1 | AI generuje rekomendacje optymalizacji wydatkow. | Raport wskazuje kategorie i transakcje, ktore wygladaja na niepotrzebne lub rosnace. |
| FR-AI-007 | P1 | AI moze dzialac lokalnie lub przez zewnetrzny provider. | Konfiguracja jasno pokazuje aktywny tryb i ryzyka prywatnosci. |

## 7. Dashboard i Raporty

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| FR-REP-001 | P0 | Dashboard pokazuje przychody i wydatki roku. | Dane sa widoczne po zalogowaniu. |
| FR-REP-002 | P0 | Dashboard pokazuje majatek netto. | Majatek uwzglednia konta, gotowke i inwestycje. |
| FR-REP-003 | P0 | Dashboard pokazuje kwote zainwestowana i wynik inwestycji. | Uzytkownik widzi, czy jest stratny lub zyskowny. |
| FR-REP-004 | P0 | Raport miesieczny pokazuje kategorie wydatkow. | Wydatki sa pogrupowane po kategoriach. |
| FR-REP-005 | P0 | Raport roczny pokazuje trendy. | Wykresy pokazuja zmiany w czasie. |
| FR-REP-006 | P1 | Aplikacja prognozuje koniec miesiaca. | Prognoza wykorzystuje dotychczasowe tempo wydatkow. |
| FR-REP-007 | P1 | Aplikacja wykrywa najwieksze wzrosty wydatkow. | Raport wskazuje kategorie z istotnym wzrostem. |
| FR-REP-008 | P1 | Aplikacja eksportuje raport do CSV/PDF. | Plik zawiera dane zgodne z filtrem raportu. |

## 8. Budzety

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| FR-BUD-001 | P0 | Uzytkownik moze ustawic miesieczne limity kategorii. | Dashboard pokazuje wykorzystanie limitu. |
| FR-BUD-002 | P0 | Budzety sa osobne per uzytkownik. | Uzytkownik widzi tylko swoje limity. |
| FR-BUD-003 | P1 | Aplikacja pokazuje przewidywane przekroczenie budzetu. | Prognoza ostrzega wizualnie, bez wymagania push alertow. |

## 9. Inwestycje

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| FR-INV-001 | P0 | Uzytkownik moze dodac aktywo inwestycyjne recznie. | Aktywo ma typ, nazwe, ilosc i wartosc PLN. |
| FR-INV-002 | P0 | Aplikacja obsluguje ETF, akcje, obligacje, krypto, IKE/IKZE i gotowke. | Typ aktywa jest wybieralny w formularzu. |
| FR-INV-003 | P0 | Inwestycje wchodza do majatku netto. | Dashboard uwzglednia wartosc inwestycji. |
| FR-INV-004 | P1 | Aplikacja liczy zysk/strate. | Widoczna jest roznica miedzy wplatami a aktualna wartoscia. |
| FR-INV-005 | P1 | Aplikacja sledzi wplaty, zyski i dywidendy. | Operacje inwestycyjne sa widoczne w historii. |
| FR-INV-006 | P1 | Uzytkownik moze zapisac strategie inwestycyjna. | Po miesiacu aplikacja pokazuje, ile przeznaczyc na cele. |
| FR-INV-007 | P2 | Aplikacja pobiera aktualne ceny aktywow. | Wyceny moga odswiezac sie automatycznie. |
| FR-INV-008 | P2 | Aplikacja wspiera rebalancing. | System pokazuje odchylenie od docelowej alokacji. |

## 10. Backup, Eksport i Usuwanie

| ID | Priorytet | Wymaganie | Kryterium Akceptacji |
| --- | --- | --- | --- |
| FR-OPS-001 | P0 | Aplikacja wykonuje backup danych. | Backup mozna uruchomic recznie i zaplanowac automatycznie. |
| FR-OPS-002 | P0 | Aplikacja pozwala odtworzyc dane z backupu. | Restore dziala na swiezej instalacji. |
| FR-OPS-003 | P0 | Uzytkownik moze wyeksportowac swoje dane. | Eksport zawiera transakcje, kategorie, konta i inwestycje. |
| FR-OPS-004 | P1 | Uzytkownik moze trwale usunac swoje dane. | Po usunieciu dane nie sa widoczne w aplikacji. |
| FR-OPS-005 | P1 | Backup moze trafic lokalnie lub do Google Drive. | Konfiguracja wskazuje aktywne miejsce backupu. |
