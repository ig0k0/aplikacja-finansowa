# 15. Ocena publicznych danych i API

Data analizy: 2026-09-06. Źródło: [bytewax/awesome-public-real-time-datasets](https://github.com/bytewax/awesome-public-real-time-datasets). To katalog źródeł HTTP i WebSocket, nie gwarancja stabilności, jakości ani bezpłatnego dostępu produkcyjnego.

## Wniosek

Nie dodajemy do aplikacji żadnego stałego strumienia czasu rzeczywistego. Projekt obsługuje dwie osoby, działa na SQLite i ma być oszczędny. WebSockety, okresowe odpytywanie i własne kolejki zwiększyłyby koszt, zużycie RAM oraz ryzyko bez poprawy podstawowego celu: kontroli własnych finansów.

| Źródło z katalogu | Związek z produktem | Decyzja | Uzasadnienie i warunek |
| --- | --- | --- | --- |
| Coinbase, Binance, CoinCap, CoinPaprika, DexPaprika, Pyth | Kryptowaluty w portfelu | **Później, opcjonalnie** | Mogą zasilać ręczne odświeżenie ceny aktywa krypto. Nie używać streamu; pojedynczy request dopiero po kliknięciu użytkownika, z limitem i możliwością ręcznej korekty. Sprawdzić licencję, limity i źródło ceny przed wdrożeniem. |
| Finnhub, Alpaca, Polygon, FinancialData.Net | Akcje/ETF | **Nie teraz** | Są przydatne wyłącznie do ceny rynkowej, lecz bezpłatne plany, opóźnienia i licencje różnią się między dostawcami. Projekt ma już adapter Stooq dla notowań i NBP dla FX; drugi dostawca powinien wejść tylko po konkretnym wymaganiu pokrycia instrumentów. |
| SEC EDGAR, FilingFirehose | Informacje o amerykańskich spółkach | **Nie teraz** | To dane raportowe, a nie dane potrzebne do księgowania prywatnych transakcji. Przydatne jako przyszły, odseparowany panel „wydarzenia emitenta”, nie jako element bilansu. |
| OANDA | Kursy FX | **Nie teraz** | Dla polskiego użytkownika NBP jest bardziej zrozumiałym źródłem kursu referencyjnego i jest już zaimplementowany. Nie tworzyć równoległego procesu pobierania. |
| OpenWeather, transport, wiadomości, IoT, sport, geodane | Brak | **Odrzucone** | Nie wspierają transakcji, raportów, backupu ani bezpieczeństwa; rozszerzyłyby powierzchnię ataku i koszty. |
| Certstream, URLhaus, OTX, GreyNoise, Shodan | Bezpieczeństwo infrastruktury | **Nie integrować z aplikacją** | Dane threat-intelligence nie powinny być pobierane przez aplikację finansową. Jeśli kiedyś potrzebne, mogą wspomóc proces administracyjny/SIEM poza aplikacją, po ocenie prywatności i retencji logów. |
| SSE.dev, Lenses Datagen, Mockingbird, EventSim | Testy techniczne | **Opcjonalnie dla dewelopera** | Przydają się do testowania ogólnego streamingu, którego ta architektura świadomie nie używa. Nie mają wartości funkcjonalnej dla użytkownika. |

## Zasada wdrożenia przyszłego API

Jeśli pojawi się konkretne zapotrzebowanie na cenę instrumentu, model ma najpierw:

1. sprawdzić regulamin, licencję, limit i opóźnienie danego dostawcy;
2. dodać adapter po stronie serwera z krótkim timeoutem i bez klucza w UI;
3. uruchamiać pobranie ręcznie lub rzadkim jobem systemowym, nigdy w ścieżce importu;
4. zapisać źródło, czas i walutę ceny oraz pozostawić ręczną edycję;
5. nie przekazywać opisów transakcji, sald ani identyfikatorów użytkownika do dostawcy danych;
6. dodać test niepowodzenia: brak sieci ma pozostawić ostatnią znaną cenę i działającą aplikację.

Bankowe dane nie są objęte tym katalogiem. Automatyczny import bankowy/PSD2 wymagałby osobnej analizy prawnej, zgód użytkownika i dostawcy open banking; nie wolno udawać go przez scraping lub publiczne API notowań.
