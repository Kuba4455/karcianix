# Zasady silnika — galowie-v5

## Ustalenia autora gry

- Obaj gracze zaczynają z 12 HP i sześcioma kartami.
- Każdy ma osobną talię 60 kart: 20 rodzajów × trzy kopie.
- W pierwszej rundzie rozpoczynający nie dobiera, a drugi gracz dobiera jedną kartę na początku swojej pierwszej tury. Od drugiej własnej tury obaj dobierają po jednej karcie.
- Gęsi mają 1 ataku, 1 życia i kosztują 1 energię.
- Raz we własnej turze można dobrowolnie przepalić jedną kartę z ręki na energię.
  Energia odnawia się na początku własnej tury, maksymalnie 10.
- W pierwszej własnej turze żaden gracz nie może deklarować ataków: ani na gracza, ani na jego jednostki lub budowle. Może tworzyć energię i zagrywać karty.
- Od drugiej własnej tury nowe jednostki mogą atakować od razu.
- Zanim zaatakuje się gracza, trzeba usunąć karty z jego pola, w tym palisadę.
- Obrażenia w walce są jednoczesne i zostają między turami.
- Geriatrix ma 3 ataku i 1 życia. Umiera po rozliczeniu swojego ataku.
- Kakofonix kosztuje 3.
- Ahigienix zadaje obrażenia tylko jednostkom, nie graczowi.
- Kac po magicznym napoju to trwałe -1/-1 dla tej karty.
- Wzmocnienia/debuffy powiązane z żyjącą postacią znikają po jej śmierci;
  własne efekty czasowe mają szczegółowe wyjątki niżej.

## Jawne założenia wymagane przez symulator

To robocze rozstrzygnięcia miejsc niedopowiedzianych w opisie, a nie nowe
ustalenia autora. Ich zmiana może znacząco zmienić wyniki balansu.

| Kwestia | Przyjęte zachowanie |
|---|---|
| Tura i runda | Liczniki używają pojedynczych tur gracza; pierwszy gracz nie dobiera w pierwszej turze, drugi dobiera 1 |
| Dobieranie | Drugi gracz obowiązkowo dobiera 1 w pierwszej własnej turze; od drugiej własnej tury obaj obowiązkowo po 1; dobrowolne jest tworzenie energii |
| Start energii | 0; nowy zasób zwiększa jednocześnie maksimum i dostępną energię o 1 |
| Przepalona karta | Osobna strefa energii, nie ręka ani stos kart odrzuconych; bez późniejszego użycia |
| Ataki | Zakaz w pierwszej własnej turze obu graczy; potem jedna deklaracja ataku każdej jednostki na własną turę; Asterix ma w niej do dwóch uderzeń |
| Cel ataku | Dowolna legalna karta wrogiego pola; dopiero gdy całe pole jest puste, gracz |
| Budowle | Kociołek i Palisada blokują gracza, ale nie atakują; trucizna i premie „jednostkom” ich nie obejmują |
| Pole i ręka | Bez limitu rozmiaru, bez mulligana, bez reakcji podczas ruchu rywala |
| Życie | Statystyka obrony jest maksymalnym HP; bieżące HP = maksimum - trwałe obrażenia |
| Zmiana maksimum | Premia do HP nie usuwa obrażeń; jej utrata może od razu zabić jednostkę |
| Śmierć | Po każdej rozliczonej wymianie/efekcie wszystkie martwe karty usuwa się jednocześnie; następnie rozlicza utratę ich efektów do stabilnego stanu |
| Ekwipunek | Koszt jednorazowy; po zagraniu karta trafia na stos odrzuconych, a jednostka zachowuje modyfikator; premie się sumują |
| Brak kart | Pierwsza nieudana próba obowiązkowego dobrania oznacza przegraną, bez obrażeń HP; opcjonalnie `emptyDeck: "skip"` |
| Remis | Tylko jednoczesna śmierć obu graczy; w obecnej talii zwykłe akcje rzadko mogą do niej doprowadzić |
| Limity techniczne | 200 tur gracza i 200 akcji w jednej turze; przekroczenie daje `truncated`, nie remis |
| Płeć kart | Męskie i żeńskie są wyłącznie postacie wskazane w katalogu; zwierzęta i budowle mają `none` |

## Pełna talia

| ID | Nazwa | Atak / HP | Koszt | Zachowanie |
|---|---|---:|---:|---|
| `asterix` | Asterix | 3 / 3 | 4 | Jedna akcja ataku wykonuje do dwóch wymian z tą samą kartą. Pierwsze obrażenia zwrotne ignorowane. Druga wymiana tylko jeśli obie karty żyją. Bez przenoszenia drugiego uderzenia. Atak gracza tylko raz |
| `obelix` | Obelix | 5 / 5 | 4 | Bez dodatkowej zdolności |
| `panoramix` | Panoramix | 1 / 3 | 3 | Przy wejściu wybiera inną swoją jednostkę: +0/+2, dopóki Panoramix żyje. Dopóki ta jednostka i premia istnieją, Panoramix nie jest legalnym celem ataku. Bez innej jednostki wchodzi bez premii i ochrony |
| `falballa` | Falballa | 2 / 2 | 2 | Atakując mężczyznę dostaje +2 ataku; atakowana przez mężczyznę korzysta z dodatkowej puli 2 HP |
| `dobromina` | Dobromina | 1 / 3 | 2 | Jak Falballa, lecz przeciw wrogiemu Asparanoixowi obie premie wynoszą 4 zamiast 2 |
| `asparanoix` | Asparanoix | 2 / 4 | 3 | Przy wejściu wybiera kartę wrogiego pola i -1/-1, -2/0 lub 0/-2. Osłabienie znika po śmierci Asparanoixa; może zabić cel przez obniżenie HP. Bez wrogiej karty wchodzi bez efektu |
| `ahigienix` | Ahigienix | 1 / 4 | 3 | Na początku tury rywala, przed dobieraniem, zadaje 1 obrażenie każdej jego jednostce. Tylko gdy źródło żyje. Kilka źródeł sumuje się; opcja `poisonStacks: false` ogranicza do jednego |
| `automatix` | Automatix | 1 / 5 | 3 | Bez dodatkowej zdolności |
| `geriatrix` | Geriatrix | 3 / 1 | 1 | Ginie po własnym ataku jednostki lub gracza. Nie ginie automatycznie na koniec tury. Samo bronienie się nie uruchamia tej zdolności |
| `kakofonix` | Kakofonix | 3 / 1 | 3 | Jednorazowo przy wejściu blokuje obecne jednostki przeciwnika do początku następnej własnej tury |
| `miecz` | Miecz | — | 1 | Stałe +2 ataku wybranej własnej jednostki |
| `tarcza` | Tarcza | — | 1 | Stałe +1 maksymalnego HP wybranej własnej jednostki |
| `magiczny_napoj` | Magiczny napój | — | 2 | +3/+3 wybranej własnej jednostce do końca bieżącej tury właściciela. Potem usuwa tę premię i nakłada stałe -1/-1. Każdy napój daje osobny kac |
| `kociolek` | Kociołek | 0 / 3 | 4 | Aura +1/+1 wszystkim własnym jednostkom, w tym później zagranym. Nie obejmuje budowli. Kilka kociołków sumuje się. Aura znika po zniszczeniu źródła |
| `palisada` | Palisada | 0 / 1 | 0 | Blokuje atak gracza tak jak pozostałe karty pola; nie wymusza atakowania jej przed innymi kartami |
| `dzik` | Dzik | 2 / 1 | 1 | Zwykła jednostka, bez męskiej płci dla premii bojowych |
| `pieczony_dzik` | Pieczony dzik | — | 1 | Leczy o maksymalnie 2 własnego gracza albo własną jednostkę, do jej maksimum. Bez brakujących HP nie można go zagrać |
| `sierp` | Sierp | — | 1 | Stałe +1 ataku wybranej własnej jednostki |
| `spadajace_niebo` | Spadające niebo | — | 2 | Blokada obecnych wrogich jednostek jak u Kakofonixa oraz usunięcie dodatnich modyfikatorów z obu pól. Wyłącza aury obecnych kociołków. Nowo zagrany kociołek działa normalnie |
| `gesi` | Gęsi | 1 / 1 | 1 | Zwykła jednostka bez zdolności; od drugiej własnej tury może atakować od razu po zagraniu |

## Falballa i Dobromina — pasywna premia kierunkowa

Nie ma postaw ani ręcznego przełączania zdolności. Gdy Falballa lub Dobromina
**deklaruje atak** na męską postać, automatycznie dostaje premię do ataku.
Nie dostaje wtedy premii obronnej przeciw obrażeniom zwrotnym. Gdy natomiast
jest **celem ataku** męskiej postaci, nie zwiększa obrażeń zwrotnych, lecz
korzysta z warunkowej puli dodatkowego życia.

Pula Falballi wynosi 2 HP. Pula Dobrominy wynosi 2 HP, a przeciw Asparanoixowi
4 HP. Obrażenia od kolejnych męskich napastników zużywają tę samą pulę i nie
odnawia się ona między atakami ani turami. Dopiero nadwyżka trafia w bazowe HP.
Przykład: po dwóch atakach Automatixów po 1 Falballa nadal ma swoje bazowe
2 HP, ale jej pula warunkowa jest już wyczerpana.

Atak kobiety, zwierzęcia lub karty bez męskiej płci całkowicie omija tę pulę
i odejmuje bazowe HP. Dlatego Falballa z 2 bazowymi HP po jednym ataku
Automatixa nadal zginie od ataku innej Falballi za 2. Dwa uderzenia Asterixa
zużywają jedną wspólną pulę, a nie odnawiają premię przed drugim uderzeniem.

## Blokady, ochrona i usuwanie efektów

- Blokada uniemożliwia deklarowanie ataku. Nie wyłącza pasywnej trucizny,
  aury ani zdolności przy wejściu nowych kart.
- Domyślnie zablokowana karta oddaje obrażenia. Opcja `stunRetaliation: true`
  pozwala zbadać przeciwną interpretację.
- Nowe jednostki rywala zagrane po blokadzie nie są nią objęte.
- Blokada nałożona przy wejściu działa do terminu również po śmierci Kakofonixa.
  Nie odnawia się co turę przez samą obecność Kakofonixa.
- Ochrona Panoramixa ogranicza wyłącznie cele ataków. Trucizna i zdolność
  Asparanoixa mogą go dosięgnąć. Po usunięciu jego premii przez Spadające niebo
  znika również powiązana ochrona.
- Spadające niebo pozostawia ujemne modyfikatory: osłabienia Asparanoixa i kac.
  Usunięcie aktywnej premii napoju nie usuwa zobowiązania do kaca na koniec tury.
- Wrodzone zdolności Asterixa/Falballi/Dobrominy nie są dodatnim modyfikatorem
  i nie znikają po Spadającym niebie.
- Wyłączenie zdolności w eksperymencie (`abilityEnabled: false`) wyłącza
  cały specjalny efekt. Statystyki i koszt karty zostają. Czary/ekwipunek
  bez zdolności można zagrać bez celu, ale nie wywierają efektu.

## Konfiguracja

Ogólne opcje znajdują się w `DEFAULT_RULES` w `src/engine.ts`. Plik JSON
przekazany przez `--rules` nadpisuje tylko podane klucze. Drobne warianty
statystyk jednej karty ustawiaj argumentami eksperymentu, nie przez edycję
katalogu bazowego. Zmiana mechaniki opisanej powyżej wymaga zmiany silnika
i testów; nie wszystkie założenia mają przełącznik.

Wersja 0.2.0: `secondPlayerFirstDraw: 1` określa dodatkowe dobieranie drugiego gracza w pierwszej turze. Zasada zależy od kolejności gry, nie od indeksu miejsca 0/1.

Wersja 0.3.0: `startingHp: 15` ustala początkowe i maksymalne HP gracza. `allowFirstTurnAttacks: false` blokuje deklaracje ataków podczas pierwszej własnej tury każdego gracza. Od drugiej tury blokada znika. Nie wyłącza zdolności pasywnych ani normalnych obrażeń zwrotnych, gdy ataki są już możliwe.

Wersja 0.5.0: domyślne zasady to `startingHp: 12`, `openingHand: 6`, `drawPerTurn: 1`, `secondPlayerFirstDraw: 1`, `allowFirstTurnAttacks: false` i `maxEnergy: 10`. Falballa i Dobromina używają automatycznej premii kierunkowej zamiast postaw.
