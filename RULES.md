# Zasady silnika — galowie-rzymianie-v12

Druga talia i zatwierdzone zdolności: [Rzymianie](ROMANS.md). Każdy gracz niezależnie wybiera Galów lub Rzymian; obie talie mają 60 kart (20 × 3).

## Ustalenia autora gry

- Obaj gracze zaczynają z 15 HP i sześcioma kartami.
- Przed pierwszą turą każdy kolejno może wymienić dowolną liczbę kart startowych (także zero). Wybrane karty wracają do jego talii, talia jest tasowana, po czym dobiera do sześciu. Te same karty mogą zostać ponownie dobrane; nic nie trafia na stos odrzuconych.
- Obaj gracze mają od początku 1 dostępną energię i maksimum energii równe 1. Wymiana kart startowych nie zużywa energii ani limitu akcji w turze.
- Każdy ma osobną talię 60 kart: 20 rodzajów × trzy kopie.
- W pierwszej rundzie rozpoczynający nie dobiera, a drugi gracz dobiera jedną kartę na początku swojej pierwszej tury. Od drugiej własnej tury obaj dobierają po jednej karcie.
- Gęsi mają 1 ataku, 2 życia i kosztują 1 energię.
- Po każdej pełnej rundzie, czyli po turach obu graczy, maksimum energii obu stron rośnie o 1, do 7.
  Na początku własnej tury energia odnawia się do aktualnego maksimum (od 1/1 w pierwszej rundzie do 7/7 od siódmej).
  Sam wzrost maksimum nie odnawia energii gracza oczekującego. Kart nie można wymieniać na energię.
- W pierwszej turze gracz rozpoczynający nie może deklarować ataków: ani na gracza, ani na jego jednostki lub budowle. Drugi gracz może atakować już w swojej pierwszej turze. Obaj mogą zagrywać karty.
- Zablokowana jednostka nie oddaje obrażeń do chwili odblokowania.
- Po pierwszej turze gracza rozpoczynającego nowe jednostki mogą atakować od razu (z wyjątkiem indywidualnych ograniczeń kart).
- Zanim zaatakuje się gracza, trzeba usunąć karty z jego pola, w tym palisadę.
- Obrażenia w walce są jednoczesne i zostają między turami.
- Geriatrix ma 3 ataku i 1 życia. Umiera na końcu swojej tury, nawet jeśli nie atakował.
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
| Dobieranie | Drugi gracz obowiązkowo dobiera 1 w pierwszej własnej turze; od drugiej własnej tury obaj obowiązkowo po 1 |
| Start energii | 1 dostępnej i 1 maksimum; po pełnej rundzie +1 maksimum dla obu graczy do 7; odnowienie na początku własnej tury |
| Wymiana na energię | Niedozwolona; karty pozostają w ręce do zagrania lub działania innego efektu |
| Ataki | Zakaz tylko w pierwszej turze gracza rozpoczynającego; drugi gracz może zaatakować w pierwszej własnej turze; potem jedna deklaracja ataku każdej jednostki na własną turę; Asterix ma w niej do dwóch uderzeń |
| Cel ataku | Dowolna legalna karta wrogiego pola; dopiero gdy całe pole jest puste, gracz |
| Budowle | Kociołek i Palisada blokują gracza, ale nie atakują; trucizna i premie „jednostkom” ich nie obejmują |
| Pole i ręka | Bez limitu rozmiaru i reakcji podczas ruchu rywala; wymiana wyłącznie przed pierwszą turą |
| Życie | Statystyka obrony jest maksymalnym HP; bieżące HP = maksimum - trwałe obrażenia |
| Zmiana maksimum | Premia do HP nie usuwa obrażeń; jej utrata może od razu zabić jednostkę |
| Śmierć | Po każdej rozliczonej wymianie/efekcie wszystkie martwe karty usuwa się jednocześnie; następnie rozlicza utratę ich efektów do stabilnego stanu |
| Ekwipunek | Koszt jednorazowy; po zagraniu karta trafia na stos odrzuconych, a jednostka zachowuje modyfikator; premie się sumują |
| Brak kart | Pierwsza nieudana próba obowiązkowego dobrania oznacza przegraną, bez obrażeń HP; opcjonalnie `emptyDeck: "skip"` |
| Remis | Tylko jednoczesna śmierć obu graczy; w obecnej talii zwykłe akcje rzadko mogą do niej doprowadzić |
| Limity techniczne | 200 tur gracza i 200 akcji w jednej turze; przekroczenie daje `truncated`, nie remis |
| Płeć kart | Męskie i żeńskie są wyłącznie postacie wskazane w katalogu; zwierzęta i budowle mają `none` |

## Pełna talia Galów

| ID | Nazwa | Atak / HP | Koszt | Zachowanie |
|---|---|---:|---:|---|
| `asterix` | Asterix | 3 / 3 | 4 | Jedna akcja ataku wykonuje do dwóch wymian z tą samą kartą. Pierwsze obrażenia zwrotne ignorowane. Druga wymiana tylko jeśli obie karty żyją. Bez przenoszenia drugiego uderzenia. Atak gracza tylko raz |
| `obelix` | Obelix | 5 / 5 | 5 | Bez dodatkowej zdolności |
| `panoramix` | Panoramix | 1 / 3 | 3 | Przy wejściu wybiera swoją jednostkę, która już leży na stole, i daje jej wyłącznie +0/+2. Ten konkretny Panoramix nie jest legalnym celem ataku, dopóki żyją wybrana jednostka i jej premia. Bez innej jednostki wchodzi bez premii i ochrony |
| `falballa` | Falballa | 2 / 2 | 2 | Atakując mężczyznę dostaje +2 ataku; atakowana przez mężczyznę korzysta z dodatkowej puli 2 HP |
| `dobromina` | Dobromina | 1 / 3 | 2 | Jak Falballa, lecz przeciw wrogiemu Asparanoixowi obie premie wynoszą 4 zamiast 2 |
| `asparanoix` | Asparanoix | 2 / 4 | 3 | Przy wejściu wybiera kartę wrogiego pola i -1/-1, -2/0 lub 0/-2. Osłabienie znika po śmierci Asparanoixa; może zabić cel przez obniżenie HP. Bez wrogiej karty wchodzi bez efektu |
| `ahigienix` | Ahigienix | 1 / 4 | 3 | Na początku tury rywala, przed dobieraniem, zadaje 1 obrażenie każdej jego jednostce. Tylko gdy źródło żyje. Kilka źródeł sumuje się; opcja `poisonStacks: false` ogranicza do jednego |
| `automatix` | Automatix | 1 / 5 | 3 | Bez dodatkowej zdolności |
| `geriatrix` | Geriatrix | 3 / 1 | 1 | Pozostaje na polu po swoim ataku; ginie przy końcu tury gracza, który nim steruje, nawet jeśli nie zaatakował. Może wcześniej zginąć od obrażeń; wyłączenie zdolności wyłącza śmierć na końcu tury |
| `kakofonix` | Kakofonix | 2 / 1 | 3 | Jednorazowo przy wejściu blokuje obecne jednostki przeciwnika do początku następnej własnej tury |
| `miecz` | Miecz | — | 2 | Stałe +2 ataku wybranej własnej jednostki |
| `tarcza` | Tarcza | — | 1 | Stałe +1 maksymalnego HP wybranej własnej jednostki |
| `magiczny_napoj` | Magiczny napój | — | 2 | +3/+3 wybranej własnej jednostce przez turę zagrywającego i kolejną turę przeciwnika. Na początku następnej własnej tury zagrywającego usuwa premię i nakłada stałe -1/-1. Każdy napój daje osobny kac, nawet jeśli Spadające niebo usunęło premię wcześniej |
| `kociolek` | Kociołek | 0 / 3 | 4 | Aura +1/+1 wszystkim własnym jednostkom, w tym później zagranym. Nie obejmuje budowli. Kilka kociołków sumuje się. Aura znika po zniszczeniu źródła |
| `palisada` | Palisada | 0 / 1 | 0 | Blokuje atak gracza tak jak pozostałe karty pola; nie wymusza atakowania jej przed innymi kartami |
| `dzik` | Dzik | 2 / 1 | 1 | Zwykła jednostka, bez męskiej płci dla premii bojowych |
| `pieczony_dzik` | Pieczony dzik | — | 1 | Leczy o maksymalnie 2 własnego gracza albo własną jednostkę, do jej maksimum. Bez brakujących HP nie można go zagrać |
| `sierp` | Sierp | — | 1 | Stałe +1 ataku wybranej własnej jednostki |
| `spadajace_niebo` | Spadające niebo | — | 3 | Blokada obecnych wrogich jednostek jak u Kakofonixa oraz usunięcie dodatnich modyfikatorów z obu pól. Wyłącza aury obecnych kociołków. Nowo zagrany kociołek działa normalnie |
| `gesi` | Gęsi | 1 / 2 | 1 | Zwykła jednostka bez zdolności; od drugiej własnej tury może atakować od razu po zagraniu |

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
- Domyślnie zablokowana karta nie oddaje obrażeń do chwili odblokowania.
  Opcja `stunRetaliation: false` pozwala zbadać wariant z obrażeniami zwrotnymi.
- Nowe jednostki rywala zagrane po blokadzie nie są nią objęte.
- Blokada nałożona przy wejściu działa do terminu również po śmierci Kakofonixa.
  Nie odnawia się co turę przez samą obecność Kakofonixa.
- Panoramix zwiększa wyłącznie obronę wybranej własnej jednostki już leżącej
  na stole: daje jej +0/+2, bez premii do ataku. Ten konkretny Panoramix nie
  może zostać wybrany jako cel ataku, dopóki żyje wzmocniona postać i działa
  jej premia. Ochrona ogranicza wyłącznie cele ataków: trucizna i zdolność
  Asparanoixa nadal mogą go dosięgnąć. Po usunięciu premii przez Spadające
  niebo znika również powiązana ochrona.
- Spadające niebo pozostawia ujemne modyfikatory: osłabienia Asparanoixa i kac.
  Usunięcie aktywnej premii napoju nie usuwa zobowiązania do kaca na początku następnej własnej tury.
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

Wersja 0.3.0 (historycznie): `startingHp: 15` ustala początkowe i maksymalne HP gracza. Wtedy `allowFirstTurnAttacks: false` blokowało ataki obu graczy w ich pierwszych własnych turach. Od wersji 0.10.0 blokuje wyłącznie pierwszą turę rozpoczynającego. Nie wyłącza zdolności pasywnych ani normalnych obrażeń zwrotnych, gdy ataki są już możliwe.

Wersja 0.5.0: domyślne zasady to `startingHp: 12`, `openingHand: 6`, `drawPerTurn: 1`, `secondPlayerFirstDraw: 1`, `allowFirstTurnAttacks: false`, `maxEnergy: 10` i `stunRetaliation: true`. Falballa i Dobromina używają automatycznej premii kierunkowej zamiast postaw.

Wersja 0.6.0: Gęsi mają 1/2 za 1, Miecz kosztuje 2, Obelix kosztuje 5, Kakofonix ma 2/1 za 3, a Spadające niebo kosztuje 3. Boty agresywny i kontrolny oceniają również najlepszy kolejny ruch w tej samej turze.

Wersja 0.8.0: Geriatrix ginie na końcu swojej tury bez względu na to, czy wykonał atak. Przeżywa własny atak, o ile nie otrzyma w nim śmiertelnych obrażeń. Kalimatis kosztuje 4, Gajusz Pięknus ma 2/4, Kodeks kosztuje 1; Cezarów nie chronią inni Cezarowie, a Koloseum nie chowa Koloseum. Historyczne raporty korzystają z wcześniejszej wersji silnika i nie są odtwarzane przez tę wersję.

Wersja 0.10.0: przy `allowFirstTurnAttacks: false` zakaz ataków dotyczy tylko gracza rozpoczynającego w pierwszej turze całej gry; `true` pozwala również jemu atakować. Drugi gracz może atakować jednostkę albo gracza (jeśli pole przeciwnika jest puste) w swojej pierwszej turze.

Wersja 0.11.0: startowa wymiana kart następuje najpierw u rozpoczynającego, potem u drugiego gracza. Drugi gracz dobiera dodatkową kartę dopiero po wymianie, na początku pierwszej własnej tury. `startingEnergy: 1` to startowe dostępne maksimum; tworzenie energii z karty nadal zwiększa maksimum i dostępny zasób o 1.

Wersja 0.11.1: karty wybrane podczas wymiany wracają do talii przed jej tasowaniem i ponownym doborem. Nie zwiększają stosu odrzuconych.

Wersja 0.12.0: domyślne `startingEnergy: 1`, `maxEnergy: 7`. Maksimum rośnie automatycznie po pełnej rundzie. Usunięto akcję `createEnergy` i strefę kart energii. Wcześniejsze opisy przepalania kart w historii wersji nie obowiązują w aktualnych zasadach.
