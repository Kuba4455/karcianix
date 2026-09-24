# Karcianix — symulator talii Galów i Rzymian

Działający projekt TypeScript do testowania zasad, symulowania dowolnej liczby gier
i porównywania pojedynczych zmian kart. Obaj gracze mają po 60 kart: po trzy kopie
każdej z 20 kart wybranej talii (Galowie lub Rzymianie). Interfejs karcianej areny w przeglądarce, bez zależności produkcyjnych.

## Zagraj online 1 na 1

Wymagany Node.js **22.18 lub nowszy**. Po pobraniu repozytorium, w jego katalogu:

```bash
npm ci
npm run play
```

Na serwerze z Dockerem i Compose uruchom w katalogu repo:

```bash
docker compose up -d --build
```

Gra jest dostępna na porcie **3111** serwera. Port możesz zmienić przez
`GAME_PORT=8080 docker compose up -d --build`. Domyślnie Compose wystawia port
na wszystkie interfejsy; przy reverse proxy ustaw `GAME_BIND=127.0.0.1`,
aby dostęp do kontenera był tylko lokalny, i skonfiguruj HTTPS w proxy.
`docker compose logs -f` wyświetla logi, a `docker compose down` zatrzymuje grę.
Kontener nie wymaga bazy, wolumenu ani instalowania pakietów npm na serwerze.

Bez Dockera można użyć `npm run play`. Wtedy proces słucha domyślnie na
`127.0.0.1`; `HOST=0.0.0.0` pozwala słuchać na interfejsie sieciowym, a `PORT`
zmienia port. Obaj gracze otwierają ten
sam adres strony na **osobnych urządzeniach**. Gospodarz wybiera talię i tworzy
pokój, przekazuje drugiej osobie 12-znakowy kod pokoju. Gość dołącza, wybierając
własną talię. Gracz rozpoczynający jest losowany. Strona co 2,5 sekundy sprawdza,
czy przeciwnik skończył turę; nie trzeba ręcznie odświeżać. W turze przeciwnika
widać własną rękę oraz oba pola gry, ale nie można wykonywać ruchów. Każdy widzi
wyłącznie swoją rękę, a legalne ruchy dostaje w swojej turze.

### Obsługa areny

- Przycisk **Zasady** jest w górnej belce. Górna, lekko czerwona połowa planszy
  należy do przeciwnika; każda strona pokazuje talię, HP, energię i liczby kart.
- Koszt karty jest w prawym górnym rogu, a atak i obrona (pozostałe HP) pośrodku.
- Przycisk **Atakuj** na własnej karcie podświetla wyłącznie legalne cele wskazane
  przez serwer. Wybierz cel albo **Anuluj atak** (również klawisz Esc).
  Atak w gracza pojawia się na jego belce, kiedy pozwalają na to zasady.
- Zdolności kart są oddzielone jako **Akcje dodatkowe**. Gdy efekt ma kilka
  wariantów lub celów, wybierasz konkretny ruch w oknie dialogowym.
- Karty w ręce mają **Zagraj** i **Zamień na energię**. Wymiana wymaga
  potwierdzenia i zgodnie z zasadami zwiększa dostępną oraz maksymalną energię
  o 1, raz na turę, do maksimum 10.
- Zmiana stanu gry anuluje nieaktualny wybór celu. Zwykłe odświeżanie bez
  zmiany stanu zachowuje wybór, również podczas wymiany kart startowych.
- Na wąskich ekranach rzędy kart można przewijać poziomo.

Po dołączeniu przeglądarka zapamiętuje prywatny identyfikator miejsca gracza,
więc odświeżenie strony nie przerywa partii. Sam kod pokoju umożliwia tylko
zajęcie wolnego miejsca; po dołączeniu drugiego gracza nie można wejść jako
trzeci. Partie pozostają wyłącznie w RAM procesu i wygasają po czterech godzinach
bez żądań do pokoju; restart procesu usuwa wszystkie gry. Uruchom jeden proces
serwera (bez równoległych replik bez współdzielonego stanu). Przed udostępnieniem
w internecie skonfiguruj HTTPS w reverse proxy; nie umieszczaj identyfikatorów
graczy w adresie URL ani nie udostępniaj profilu przeglądarki.

**Zacznij od [RULES.md](RULES.md).** Zasady podane przez autora są oddzielone od
założeń potrzebnych do uruchomienia symulacji. Szczególnie istotna jest robocza
interpretacja warunkowego życia Falballi/Dobrominy, blokad i Spadającego nieba.

## Aktualne zasady — wersja 0.11.1

Karty i szczegóły nowej talii: [ROMANS.md](ROMANS.md).
Geriatrix umiera na końcu swojej tury, także gdy nie zaatakuje; po ataku może pozostać na polu do zakończenia tury.
Rzymianie: Kalimatis kosztuje 4, Gajusz Pięknus ma 2/4, a Kodeks kosztuje 1. Cezarów nie chronią inne Cezary; Koloseum nie chowa Koloseum.
Przykład: `npm run simulate -- --games 1000 --decks galowie,rzymianie`.

- Dostępne są dwie niezależne talie po 60 kart. Domyślnie obaj gracze używają Galów.
- Przed grą obaj wybierają karty startowe do wymiany (lub zatrzymują wszystkie). Wybrane karty wracają do talii; po jej potasowaniu gracz dobiera do 6 i może ponownie trafić na tę samą kartę. Drugi gracz dobiera potem dodatkową kartę na początku swojej pierwszej tury.
- Każdy zaczyna z 1 dostępną energią (i maksimum 1); zamiana karty na energię podnosi oba zasoby o 1.
- Rzymianie dodają m.in. poświęcanie jednostek, darmowe przyzwanie Legionistów, przejęcie kontroli, podgląd/kradzież ręki i chowanie w Koloseum.
- Lew i Gajusz Ceplus czekają z pierwszym atakiem do następnej własnej tury.

- Obaj gracze zaczynają z **15 HP**, leczenie gracza nie przekracza 15 HP.
- Spadające niebo kosztuje **3 energii**.
- Gęsi mają **1/2 za 1**, Miecz kosztuje **2**, Obelix kosztuje **5**, a Kakofonix ma **2/1 za 3**.
- W pierwszej turze gracz rozpoczynający nie może deklarować ataków. Drugi gracz może atakować już w swojej pierwszej turze. Obaj mogą tworzyć energię i zagrywać karty.
- Zablokowana jednostka nie oddaje obrażeń do chwili odblokowania.
- Panoramix daje wybranej jednostce już leżącej na stole wyłącznie +0/+2 i pozostaje chroniony przed atakami, dopóki żyją ta jednostka oraz jej premia.
- Falballa i Dobromina automatycznie dostają premię ataku, gdy atakują mężczyznę, oraz zużywalną pulę dodatkowego HP, gdy są przez niego atakowane. Nie wymagają przełączania postawy.

### Zachowane zmiany z wersji 0.2.0

- Drugi gracz dobiera 1 kartę na początku pierwszej własnej tury. Rozpoczynający nie dobiera wtedy kart. Od drugiej własnej tury obaj dobierają po 1.
- Ostatnia seria 500 gier dotyczy wcześniejszych zasad 0.2.0: [RESULTS-v0.2.0.md](RESULTS-v0.2.0.md). Raporty historyczne wymagają do replayu zgodnej wersji silnika; nie są wynikami obecnych zasad. Status bieżącej wersji: [RESULTS.md](RESULTS.md).

## Szybki start

Wymagania: **Node.js 22.18+ lub 24+**, npm. Polecenia działają również w PowerShell.
Rozpakuj archiwum, otwórz katalog `karcianix` w VS Code i terminal:

```bash
npm ci
npm test
npm run typecheck
npm run simulate -- --games 1000 --seed 42
npm run experiment -- --games 10000 --seed 42
```

Statyczne dane jednostek obu talii są w [CSV Galów](data/galowie-jednostki.csv)
i [CSV Rzymian](data/rzymianie-jednostki.csv): identyfikator, nazwa, bazowy atak,
życie, koszt i opis zdolności. Pliki obejmują tylko jednostki
(`kind: unit`), więc nie zawierają zaklęć, wyposażenia ani budowli. Po zmianie
definicji kart uruchom `npm run cards:csv` i dołącz oba aktualne CSV do zmiany.
`npm test` sprawdza ich zgodność z definicjami i zgłosi brak aktualizacji.

Ostatnie polecenie porównuje **Obelixa 5/5 za 5** z **Obelixem 5/5 za 6**.
`--games 10000` oznacza dokładnie 10 000 partii, czyli 5 000 par, a nie 10 000 par.
Zależności są przypięte w `package-lock.json`; używaj `npm ci`.

Node uruchamia pliki `.ts` bez kompilacji dzięki usuwaniu typów. Kontrolę typów
wykonuje osobno `npm run typecheck`. Dokumentacja:
[Node.js — uruchamianie TypeScript](https://nodejs.org/learn/typescript/run-natively),
[Vitest](https://vitest.dev/guide/).

## Co jest gotowe

- Wszystkie 40 rodzajów kart i ich zdolności, 15 HP, 6 kart początkowych, dobieranie,
  odnawialna energia, legalne ruchy i jednoczesne obrażenia.
- Bot losowy, agresywny i kontrolny. Dwa ostatnie łączą heurystyki z podglądem
  najlepszego następnego ruchu w tej samej turze, dzięki czemu rozpoznają krótkie combo.
- Osobne, deterministyczne strumienie RNG do obu talii i decyzji obu botów.
- Boty dostają kopię własnej ręki i publicznych informacji. Nie dostają ręki
  przeciwnika (poza kartami legalnie ujawnionymi przez Kalimatisa), kolejności talii, seeda ani historii ukrytych zdarzeń.
- Kontrolowane eksperymenty: zmiana jednego parametru, zamiana miejsc, przedział
  ufności liczony na poziomie par.
- Raporty Markdown, JSON i CSV; odtwarzanie pojedynczej gry z pełną listą akcji
  i zdarzeń.
- Testy jednostkowe, przypadki brzegowe i serie pełnych gier z kontrolą
  niezmienników po każdej akcji.

## Uruchamianie symulacji

```bash
# Standardowe talie, 4 zestawienia botów agresywny/kontrolny
npm run simulate -- --games 10000 --seed 123

# Stałe strategie obu miejsc
npm run simulate -- --games 1000 --seed 123 --bots aggressive,control

# Losowe boty służą głównie do wykrywania błędów silnika
npm run simulate -- --games 500 --seed 7 --bots random,random

# Zmiana wybranych założeń
npm run simulate -- --games 1000 --rules config/no-poison-stacking.json

# Pomoc
npm run simulate -- --help
```

Domyślne zestawienia to aggressive/aggressive, control/control,
aggressive/control i control/aggressive. Każde zestawienie dostaje po dwie
kolejne partie ze zmianą rozpoczynającego. Pełny cykl ma 8 gier.
Przy niepełnym cyklu liczebności zestawień mogą się nieznacznie różnić;
liczba startów obu miejsc różni się najwyżej o 1.

## Eksperymenty kart

```bash
# Wyższy koszt Obelixa
npm run experiment -- --games 10000 --seed 42 --card obelix --field cost --value 6

# Niższy atak Obelixa
npm run experiment -- --games 10000 --seed 42 --card obelix --field attack --value 4

# Wartość trucizny Ahigienixa: wariant bez zdolności
npm run experiment -- --games 10000 --seed 99 --card ahigienix --field abilityEnabled --value false

# Koszt Kakofonixa 4 zamiast 3
npm run experiment -- --games 10000 --seed 99 --card kakofonix --field cost --value 4

# Tylko boty kontrolne
npm run experiment -- --games 10000 --seed 2027 --bots control,control

# Kontrola metody: identyczne warianty powinny dać 50% w każdej pełnej parze
npm run experiment -- --games 100 --seed 42 --card obelix --field cost --value 5
```

Wariant nadpisuje wszystkie trzy kopie jednej karty **tylko w jednej talii**.
Silnik nie zmienia definicji bazowych. Publiczne statystyki wariantu są znane
botom, ale ręka i kolejność talii przeciwnika pozostają ukryte.

Każda para ma własny seed. W pierwszej partii bazowa talia jest na miejscu 0,
a wariant na miejscu 1. W drugiej talie zamieniają się miejscami; miejsce 0
zaczyna w obu. Tasowanie i RNG decyzji są przypisane do miejsc. Zmiana długości
gry nie przesuwa losowań następnej pary. Różne liczby legalnych akcji mogą
powodować rozchodzenie się strumieni decyzji wewnątrz pary; wspólny seed nie
oznacza identycznych decyzji przy różnym stanie gry.

Domyślnie kolejne pary rotują przez cztery zestawienia botów. W każdej parze
wariant jest raz kierowany przez każdego z dwóch botów i raz rozpoczyna.

**Wynik wariantu**: 1 za wygraną, 0,5 za remis, 0 za przegraną, średnia z dwóch
gier w parze, następnie średnia po parach. Powyżej 50% oznacza przewagę wariantu
w danym modelu gry. Nie jest to automatyczne zalecenie zmiany kosztu.

Przedział 95% używa nierówności Hoeffdinga dla niezależnych wyników par
z zakresu [0,1]: `średnia ± sqrt(ln(40) / (2 * liczba_par))`, ograniczony do
[0,1]. Jest konserwatywny i uwzględnia zależność dwóch partii w parze.
Przy 5 000 pełnych par promień wynosi około 1,92 p.p. Nie wolno podstawiać
w tym wzorze liczby partii. Ziarna traktujemy jako niezależne próby Monte Carlo;
sam generator jest oczywiście deterministyczny.

Partia zatrzymana limitem nie jest remisem. Jeśli choć jedna gra pary została
przerwana, cała para wypada z głównej estymacji. Raport podaje także przedział
możliwego wyniku wszystkich gier przy dowolnym rozstrzygnięciu uciętych partii.
Jeśli przerwania występują, zwiększ limit i sprawdź przyczynę przed oceną balansu.

## Raporty i odtwarzanie gier

Polecenia tworzą w `reports/` trzy pliki:

| Plik | Zawartość |
|---|---|
| `*.md` | Czytelne wyniki, tabela kart, ograniczenia interpretacji |
| `*.json` | Parametry, zasady, katalogi kart, seed i wynik każdej gry, pary |
| `*-cards.csv` | Liczniki kart, gotowe do otwarcia/importu w Excelu |

Domyślne nazwy zawierają tryb, kartę i seed. Powtórzenie polecenia z tą samą
nazwą nadpisuje raport; do zachowania kilku zmian tej samej karty używaj
osobnych katalogów `--out reports/obelix-cost6` i `--out reports/obelix-attack4`.

```bash
# Indeks 0 oznacza pierwszą grę zapisaną w raporcie
npm run replay -- --from reports/experiment-obelix-42.json --index 0

# Pojedyncza gra bez raportu — tutaj seed gry, nie seed serii
npm run replay -- --seed 42 --bots aggressive,control --first 0
```

Replay z raportu przywraca także warianty, reguły, boty i ich seedy, sprawdza
niezmienniki po każdej akcji i porównuje wynik z oryginałem. Zapisuje akcje,
zdarzenia i metryki w `replay-<seed>-game<indeks>.json` (lub `replay-<seed>.json`
dla samodzielnej gry). Zdarzenia zawierają także dobrane
karty obu stron — to zapis do debugowania po grze, nigdy wejście bota.

Seed wraz z tą samą wersją silnika i reguł daje powtarzalny wynik. Po zmianach
kodu zaktualizuj `ENGINE_VERSION` w `src/report.ts`; po zmianie domyślnych zasad
również `RULESET_VERSION`. Replay odrzuca raport z inną wersją silnika.

## Jak czytać liczniki kart

| Pole | Znaczenie |
|---|---|
| `drawn`, `played`, `burned` | Liczba kopii dobranych, zagranych, zamienionych w energię |
| `playableCopyTurns` | Liczba par kopia–własna tura, w których kopia miała legalne zagranie |
| `handCopyTurns` | Liczba par kopia–własna tura, w których była na ręce |
| `unitDamage`, `directDamage` | Rzeczywiste zabrane HP, bez obrażeń ponad pozostałe życie |
| `kills` | Bezpośrednie zabójstwa obrażeniami walki/trucizny, bez kaskad utraty premii |
| `healing` | Rzeczywiście przywrócone HP |
| `damagePrevented` | Obrażenia zwrotne zignorowane przez Asterixa; warunkowe HP Falballi/Dobrominy jest liczone jako otrzymane obrażenia |
| `stunsApplied` | Jednostki, którym nałożono blokadę, gdy nie miały już blokady |
| `scoreWhenDrawn`, `scoreWhenPlayed` | Wynik gracza w zakończonych partiach, gdy dobrał/zagrał przynajmniej jedną kopię |

Metryki są agregowane po obu graczach. W eksperymencie także po obu wersjach
karty; wynik eksperymentu jest osobno w `comparison`. Liczniki użycia obejmują
też przebieg uciętych partii; wskaźniki wyniku pomijają ucięte partie.

Karta trzymana pięć tur może mieć pięć okazji do zagrania, ale tylko jedno
zagranie. Wskaźnik `playPerOpportunity` nie jest prawdopodobieństwem zagrania
każdej dobranej karty. Dobrania obejmują rękę startową.

Obrażenia ze wzmocnionego Obelixa przypisywane są Obelixowi. Raport nie próbuje
arbitralnie podzielić ich między miecz, napój i kociołek. Te karty badaj przez
eksperymenty kosztu lub wyłączenia zdolności. Wysoki wynik po zagraniu nie
dowodzi przyczynowej siły karty; może być zagrywana dopiero podczas wygrywania.

## Gdzie zmieniać kod

| Plik | Odpowiedzialność |
|---|---|
| `src/cards.ts` | Nazwy, statystyki, koszty, opisy i nadpisania wariantów |
| `src/types.ts` | Typy stanu, obserwacji, akcji, reguł, metryk |
| `src/engine.ts` | Legalne akcje, rozliczanie zasad, śmierć, obserwacja bota |
| `src/bots.ts` | Ocena akcji wyłącznie z publicznego stanu i własnej ręki |
| `src/rng.ts` | Seedowany RNG i niezależne strumienie losowań |
| `src/simulate.ts` | Pojedyncze gry, serie i liczniki obserwacyjne |
| `src/experiments.ts` | Zamiana wariantów, pary i statystyki porównawcze |
| `src/report.ts` | Zapis JSON/CSV/Markdown i wersjonowanie reguł |
| `src/cli.ts` | Walidacja argumentów i polecenia |
| `tests/` | Scenariusze zasad i integracyjne gry z niezmiennikami |

`applyAction(state, action)` **mutuje** stan i zwraca ten sam obiekt. Waliduje
ruch przed zmianą stanu. Do przeszukiwania alternatywnych gałęzi kopiuj stan
przez `structuredClone(state)`. Obecne boty nie dostają `GameState`.

Zdolności są zaimplementowane w silniku, a opisy kart są tekstem informacyjnym.
Zmiana samego `text` nie zmienia zachowania. Nowa zdolność wymaga logiki
legalnych akcji, rozliczania i testów; samo dopisanie nazwy do katalogu nie
wystarczy.

## Następne kroki w balansowaniu

1. Potwierdź interpretacje z RULES.md na kilku ręcznych partiach.
2. Sprawdź przewagę rozpoczynającego i długość gry w zwykłych symulacjach.
3. Wybierz jedną hipotezę (np. koszt Obelixa 4 → 5) i wykonaj eksperyment.
4. Podejrzaną różnicę sprawdź na świeżym seedzie oraz osobno z obiema strategiami.
5. Obejrzyj kilka replayów. Bot może źle planować wzmocnienia lub nie widzieć
   kombinacji kilku ruchów. Milion partii nie naprawia takiego błędu strategii.
6. Zweryfikuj z ludźmi przed utrwaleniem zmian w grze.

Nie ma automatycznych etykiet „OP/słaba”: wymagają arbitralnego progu, docelowej
roli karty i wystarczająco dobrych graczy. Przy badaniu wielu kart potwierdzaj
wybrane hipotezy na nowej serii; przedziały 95% nie stanowią jednoczesnej
gwarancji dla wszystkich przetestowanych wariantów.
