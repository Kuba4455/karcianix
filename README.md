# Karcianix — symulator talii Galów

Działający projekt TypeScript do testowania zasad, symulowania dowolnej liczby gier
i porównywania pojedynczych zmian kart. Obaj gracze mają po 60 kart: po trzy kopie
każdej z 20 kart Galów. Bez interfejsu graficznego i bez zależności produkcyjnych.

**Zacznij od [RULES.md](RULES.md).** Zasady podane przez autora są oddzielone od
założeń potrzebnych do uruchomienia symulacji. Szczególnie istotna jest robocza
interpretacja obrony Falballi/Dobrominy, blokad i Spadającego nieba.

## Aktualne zasady — wersja 0.4.0

- Obaj gracze zaczynają z **15 HP**, leczenie gracza nie przekracza 15 HP.
- Spadające niebo kosztuje **2 energii**.
- W pierwszej własnej turze obu graczy nie można deklarować żadnego ataku. Można tworzyć energię i zagrywać karty. Od drugiej własnej tury jednostki, także nowo zagrane, mogą normalnie atakować.

### Zachowane zmiany z wersji 0.2.0

- Drugi gracz dobiera 1 kartę na początku pierwszej własnej tury. Rozpoczynający nie dobiera wtedy kart. Od drugiej własnej tury obaj dobierają po 2.
- Gęsi: **1 ataku / 1 życia / 1 energii**.
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

Ostatnie polecenie porównuje **Obelixa 5/5 za 4** z **Obelixem 5/5 za 5**.
`--games 10000` oznacza dokładnie 10 000 partii, czyli 5 000 par, a nie 10 000 par.
Zależności są przypięte w `package-lock.json`; używaj `npm ci`.

Node uruchamia pliki `.ts` bez kompilacji dzięki usuwaniu typów. Kontrolę typów
wykonuje osobno `npm run typecheck`. Dokumentacja:
[Node.js — uruchamianie TypeScript](https://nodejs.org/learn/typescript/run-natively),
[Vitest](https://vitest.dev/guide/).

## Co jest gotowe

- Wszystkie 20 kart i ich zdolności, 15 HP, 6 kart początkowych, dobieranie,
  odnawialna energia, legalne ruchy i jednoczesne obrażenia.
- Bot losowy, agresywny i kontrolny. Dwa ostatnie są prostymi heurystykami.
- Osobne, deterministyczne strumienie RNG do obu talii i decyzji obu botów.
- Boty dostają kopię własnej ręki i publicznych informacji. Nie dostają ręki
  przeciwnika, kolejności talii, seeda ani historii ukrytych zdarzeń.
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
npm run experiment -- --games 10000 --seed 42 --card obelix --field cost --value 5

# Niższy atak Obelixa
npm run experiment -- --games 10000 --seed 42 --card obelix --field attack --value 4

# Wartość trucizny Ahigienixa: wariant bez zdolności
npm run experiment -- --games 10000 --seed 99 --card ahigienix --field abilityEnabled --value false

# Koszt Kakofonixa 4 zamiast 3
npm run experiment -- --games 10000 --seed 99 --card kakofonix --field cost --value 4

# Tylko boty kontrolne
npm run experiment -- --games 10000 --seed 2027 --bots control,control

# Kontrola metody: identyczne warianty powinny dać 50% w każdej pełnej parze
npm run experiment -- --games 100 --seed 42 --card obelix --field cost --value 4
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
osobnych katalogów `--out reports/obelix-cost5` i `--out reports/obelix-attack4`.

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
| `damagePrevented` | Obrażenia pochłonięte przez Asterixa lub osłonę Falballi/Dobrominy |
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
