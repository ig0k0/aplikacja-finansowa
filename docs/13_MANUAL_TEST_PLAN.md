# 13. Plan testów manualnych

Data: 2026-09-06  
Cel: potwierdzić, że instalacja jest gotowa do użycia przez dwie osoby, zanim pojawią się w niej prawdziwe dane finansowe.

## Zasady bezpieczeństwa testu

- Test wykonuj na osobnej bazie `data/manual-test.db`, z wymyślonymi kwotami i hasłami. Nie mieszaj jej z produkcyjną `data/app.db`.
- Nie wysyłaj pliku źródłowego wyciągu ani klucza backupu do zewnętrznego AI.
- W tabeli wyników przy każdym przypadku wpisz: datę, osobę testującą, wynik (`OK` / `NOK`), zrzut ekranu przy `NOK` i opis różnicy.
- Kryterium końcowe: wszystkie przypadki P0 są `OK`, żaden błąd bezpieczeństwa ani utraty danych nie pozostaje otwarty.

## A. Przygotowanie czystej instalacji lokalnej

1. Zainstaluj **Node.js 24 LTS**. Sprawdź: `node --version`; wynik ma zaczynać się od `v24`.
2. W katalogu projektu uruchom `npm ci`.
3. Skopiuj konfigurację: `cp .env.example .env.local`.
4. W `.env.local` ustaw co najmniej:

   ```dotenv
   DATABASE_URL=./data/manual-test.db
   SESSION_SECRET=<losowy-sekret-z-openssl-rand-hex-32>
   BACKUP_ENCRYPTION_KEY=<inny-dlugi-losowy-sekret>
   SEED_USER_1_LOGIN=test1
   SEED_USER_1_DISPLAY_NAME=Test 1
   SEED_USER_1_PASSWORD=<silne-haslo-testowe-1>
   SEED_USER_2_LOGIN=test2
   SEED_USER_2_DISPLAY_NAME=Test 2
   SEED_USER_2_PASSWORD=<silne-haslo-testowe-2>
   AI_MODE=disabled
   ```

5. Utwórz dane startowe: `npm run db:seed`. Oczekiwany komunikat: `Seed completed.`
6. W pierwszym terminalu uruchom `npm run dev`. Otwórz podany adres, zazwyczaj `http://localhost:3000`.
7. W drugim terminalu uruchom kolejno: `npm run lint`, `npm run typecheck`, `npm run verify:foundation`, `npm run build`, `npm run test:e2e`. Każde polecenie musi zakończyć się kodem 0. Test E2E używa własnej, tymczasowej bazy.

## B. Checklista funkcjonalna P0

| ID | Kroki | Oczekiwany wynik |
| --- | --- | --- |
| AUTH-01 | Wejdź na `/dashboard` bez logowania. | Przekierowanie do `/login`; dashboard nie pokazuje danych. |
| AUTH-02 | Zaloguj się jako `test1`, potem wyloguj. | Po zalogowaniu widoczny dashboard; po wylogowaniu ponowne wejście na `/dashboard` wymaga logowania. |
| AUTH-03 | Zaloguj się jako `test2`. | Brak transakcji, kont i kategorii należących do `test1`; oba konta mają własny zestaw kategorii startowych. |
| TX-01 | Jako `test1` wejdź w **Transakcje**. Dodaj wydatek 49,99 PLN z dzisiejszą datą, kategorią, kontrahentem `Sklep testowy` i opisem `Zakupy manualne`. | Komunikat powodzenia, jeden rekord na liście, kwota prawidłowo sformatowana. |
| TX-02 | Dodaj przychód 5 000 PLN. Otwórz dashboard. | Przychód, wydatek i bilans miesiąca są zgodne z dodanymi pozycjami; wykres nie pokazuje danych przykładowych. |
| TX-03 | Zmień kategorię wydatku na liście, zaznacz **Zapamiętaj** i zapisz. Otwórz **Pamięć korekt**. | Nowa kategoria jest zapisana; pojawiła się reguła dla wzorca, bez kwoty transakcji w nazwie reguły. |
| ACC-01 | Wejdź w **Konta**, dodaj konto `Test Bank / Główne / PLN`. Następnie dodaj transakcję przypisaną do tego konta. | Konto jest dostępne na liście wyboru; transakcja zachowuje przypisanie. |
| IMP-01 | W **Import pliku** wybierz `file_sample/Wyciąg z konta PLN.csv`; użyj wykrytego parsera lub uzupełnij mapowanie; wybierz konto i kategorię, utwórz podgląd. | Podgląd ma poprawne daty, typy i sumy; plik źródłowy nie jest widoczny w repozytorium ani w katalogu `data`. |
| IMP-02 | Zatwierdź podgląd. | Widoczny licznik importowanych, duplikatów i błędów. Dane pojawiają się raz na liście transakcji, a pozycje bez potwierdzonej kategorii trafiają do kolejki. |
| IMP-03 | Utwórz drugi podgląd z tego samego pliku i zatwierdź. | Import nie tworzy drugiej kopii tych samych transakcji; licznik duplikatów rośnie. |
| REV-01 | Otwórz **Weryfikację** przy `AI_MODE=disabled`. Ustaw ręcznie kategorię dla jednej pozycji i zaznacz zapamiętanie. | Zapis jest możliwy bez AI; pozycja znika z kolejki i powstaje reguła korekty. |
| REV-02 | Opcjonalnie ustaw lokalny endpoint AI, dodaj niekategoryzowaną pozycję i uruchom batch. | Import nie czeka na model; batch przetwarza maksymalnie komunikowaną liczbę rekordów, a niski poziom pewności pozostaje do ręcznej weryfikacji. |
| REP-01 | Otwórz raport miesięczny, ustaw budżet dla kategorii, następnie raport roczny oraz **Analitykę**. | Sumy są zgodne z listą transakcji; trend, porównanie m/m, eksport CSV i PDF odpowiadają wybranemu miesiącowi. |
| INV-01 | Dodaj testowy składnik portfela i operację wyceny. | Wartość, koszt i wynik pojawiają się na dashboardzie oraz w widoku inwestycji. |
| SEC-01 | W **Bezpieczeństwie** włącz TOTP, zeskanuj kod w aplikacji uwierzytelniającej, potwierdź kodem, wyloguj się i zaloguj ponownie. | Po haśle wymagany jest prawidłowy kod TOTP; błędny kod nie daje sesji. |
| AUD-01 | Otwórz **Dziennik audytu** po logowaniu, imporcie i backupie. | Są zdarzenia techniczne, ale nie ma opisów transakcji, kwot, haseł, tokenów ani klucza backupu. |

## C. Backup i odtworzenie (P0 — wymagane przed produkcją)

1. Na bazie testowej dodaj rozpoznawalną transakcję `MARKER PRZED BACKUPEM`.
2. W terminalu uruchom `npm run backup:create`. Zachowaj nazwę utworzonego pliku `*.cfo-backup.json`.
3. Uruchom `npm run backup:verify -- ./backups/<nazwa-pliku>`. Oczekiwany wynik: `Backup verified`.
4. Dodaj drugą transakcję `MARKER PO BACKUPIE`.
5. Zatrzymaj serwer developerski (`Ctrl+C`), a następnie uruchom `npm run backup:restore -- ./backups/<nazwa-pliku>`.
6. Uruchom ponownie `npm run dev`, zaloguj się i sprawdź listę transakcji.
7. Oczekiwany wynik: jest `MARKER PRZED BACKUPEM`, nie ma `MARKER PO BACKUPIE`, a obok poprzedniej bazy powstał plik `*.pre-restore-*`. Nie usuwaj go, dopóki ręcznie nie potwierdzisz pełnego odtworzenia.
8. Powtórz test na świeżym katalogu/bazie co najmniej raz przed przekazaniem systemu do produkcji.

## D. Google Drive i harmonogram

1. Skonfiguruj `rclone` poza repozytorium według `docs/14_ORACLE_CLOUD_SECURITY_RUNBOOK.md`; w `.env.local` ustaw nazwę zdalnego połączenia i folder Google Drive.
2. Uruchom `npm run backup:google-drive`.
3. Oczekiwany wynik: lokalna kopia przechodzi weryfikację przed wysłaniem, w Drive pojawia się nowy plik `*.cfo-backup.json`, a w audycie jest wyłącznie nazwa pliku i źródło `google_drive`.
4. Pobierz jedną kopię do osobnego katalogu, wskaż ten plik w `backup:verify`, a następnie wykonaj odtworzenie na testowej bazie. Sam widok pliku JSON nie może ujawniać transakcji.
5. Po skonfigurowaniu timera sprawdź jego stan i log po pierwszym nocnym uruchomieniu. Nie uznawaj harmonogramu za działający tylko dlatego, że usługa jest „enabled”.

## E. Kontrola UX i dostępności

1. Otwórz dashboard przy szerokości desktopowej oraz na telefonie lub w trybie responsywnym przeglądarki.
2. Sprawdź, że na telefonie nawigacja zawija się, wykres nie wychodzi poza ekran, a przyciski są łatwe do dotknięcia.
3. Przejdź klawiszem `Tab` przez logowanie, dodawanie transakcji, import i dashboard. Wskaźnik fokusu musi być widoczny, a kolejność logiczna.
4. Powiększ tekst przeglądarki do 200%. Wszystkie kluczowe akcje muszą pozostać dostępne bez poziomego przewijania całej strony.

## F. Protokół akceptacji

Po zakończeniu wpisz w zgłoszeniu/rejestrze: wersję aplikacji, datę, użyty system/przeglądarkę, wynik każdego ID, nazwę **zweryfikowanej** kopii backupu i wynik próbnego restore. Jeżeli którakolwiek pozycja P0 jest `NOK`, nie przenoś prawdziwych danych na tę instalację.
