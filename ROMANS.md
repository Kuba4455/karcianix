# Rzymianie — zasady i symulacje

Każda z poniższych 20 kart występuje w trzech kopiach: łącznie **60 kart**.
Wspólne zasady energii, HP, dobierania, blokad i walki pozostają jak w RULES.md.

| ID | Nazwa | Atak / HP | Koszt |
|---|---|---:|---:|
| cezar | Juliusz Cezar | 5 / 2 | 4 |
| brutus | Brutus | 3 / 2 | 3 |
| legionista | Legionista | 1 / 1 | 1 |
| wieniec | Wieniec laurowy | — | 1 |
| katapulta | Rzymska katapulta | 6 / 2 | 4 |
| antywirus | Antywirus | 2 / 2 | 3 |
| zolw | Formacja żółwia | 0 / 4 | 2 |
| zapchlenius | Zapchlenius | 3 / 1 | 2 |
| popus | Gajusz Popus | 1 / 3 | 2 |
| a38 | Zaświadczenie A38 | — | 3 |
| pieknus | Gajusz Pięknus | 2 / 4 | 3 |
| tester_luster | Tester Luster | 0 / 2 | 1 |
| kalimatis | Kalimatis | 3 / 2 | 4 |
| ceplus | Gajusz Ceplus | 4 / 2 | 2 |
| tarcza_rzymska | Tarcza rzymska | — | 2 |
| kodeks | Kodeks prawa rzymskiego | — | 1 |
| hasta | Hasta | — | 1 |
| lew | Lew | 2 / 2 | 1 |
| koloseum | Koloseum | 0 / 5 | 4 |
| oszczep | Rzut oszczepem | — | 1 |

## Zatwierdzone zdolności

- **Cezar:** nie może być celem ataku, gdy kontrolujesz inną jednostkę niż Cezar. Zdolności i trucizna omijają tę ochronę. Dwa Cezary bez trzeciej, innej jednostki nie chronią siebie nawzajem.
- **Brutus:** w swojej turze poświęć inną kontrolowaną jednostkę, aby ten Brutus dostał trwałe +1/+1. Bez kosztu energii i bez jej tworzenia, wielokrotnie, także w turze wejścia. Nie można poświęcić jednostki czasowo przejętej przez A38. Premię usuwa Spadające niebo.
- **Antywirus:** jednorazowo przy zagraniu wybierz liczbę Legionistów z ręki (od zera do wszystkich) do wystawienia za darmo. Silnik nie ogranicza miejsc na stole. Legionistów obowiązuje zakaz atakowania w pierwszej własnej turze gracza.
- **A38:** przejmuje wrogą jednostkę do końca bieżącej tury. Dostaje możliwość ataku nawet po wykorzystaniu wcześniejszego ataku; nadal obowiązują blokada i zakaz ataków w pierwszej turze gracza. Nie można jej poświęcić ani przepalić na energię. Wraca z obrażeniami i premiami; po śmierci trafia do stosu pierwotnego właściciela. Przejęcie odsłania jednostkę. Zmiana kontrolera Koloseum odsłania jego podopiecznych.
- **Kalimatis:** jednorazowo przy zagraniu wybiera podgląd dwóch losowych kart przeciwnika (lub wszystkich, gdy jest ich mniej) albo kradzież jednej losowej karty z ręki do własnej ręki. Przy pustej ręce przeciwnika efekt nic nie robi. Podgląd widzi tylko gracz używający zdolności; zapamiętana karta znika z listy, gdy opuszcza rękę przeciwnika. Kradzież nie zmienia pierwotnego właściciela karty.
- **Wieniec / Hasta / Tarcza rzymska:** trwałe odpowiednio +2 ataku / +1 ataku / +2 maksymalnego HP własnej jednostce. Premie sumują się i mogą zostać usunięte przez Spadające niebo.
- **Kodeks:** oprócz zagrania Kodeksu odrzuć jedną inną kartę z ręki, następnie dobierz dwie. Bez innej karty nie można go zagrać. Nieudane dobieranie stosuje zwykłą zasadę pustej talii.
- **Ceplus / Lew:** atakują najwcześniej w następnej własnej turze po wystawieniu. Mogą normalnie oddawać obrażenia w obronie.
- **Koloseum:** jednostka 0/5. W swojej turze za 2 energii na jednostkę chowa inną własną jednostkę, ale nie Koloseum. Schowana nie atakuje i nie może być celem ataku, lecz nadal podlega zdolnościom i truciznie oraz może używać swoich zdolności. Wyjście w swojej turze jest darmowe i nie odnawia ataku. Zniszczenie lub utrata kontroli nad Koloseum odsłania schowane jednostki.
- **Oszczep:** natychmiast zadaje 2 obrażenia wybranej karcie wrogiego pola, również chronionej. Może zabić. Jeśli cel przeżyje, na początku najbliższej tury gracza kontrolującego go w chwili trafienia usuwane są tylko te obrażenia, przed trucizną i dobieraniem. Leczenie najpierw usuwa rany tymczasowe, aby ich wygaśnięcie nie leczyło drugi raz. Kilka oszczepów rozlicza się osobno.

Pozostałe karty nie mają zdolności. Formacja żółwia, Katapulta i Koloseum są jednostkami, nie globalnymi premiami ani budowlami. Nazwane postacie mają płeć męską; Lew, Katapulta, Formacja i Koloseum mają `none`.

## Uruchamianie

```bash
# Gracz 0: Galowie; gracz 1: Rzymianie. Rozpoczynający zmienia się co partię.
npm run simulate -- --games 1000 --seed 42 --decks galowie,rzymianie
# Pojedynek dwóch rzymskich talii
npm run simulate -- --games 1000 --seed 42 --decks rzymianie,rzymianie
# Odtworzenie konkretnej partii z raportu (talie są zapisane w raporcie)
npm run replay -- --from reports/simulate-42.json --index 0
# Eksperyment rzymskiej karty automatycznie wybiera dwie talie Rzymian
npm run experiment -- --games 100 --card ceplus --field cost --value 3
```

API: `createGame`, `runGame` i `runSimulation` przyjmują `decks: ['galowie', 'rzymianie']`.
`runExperiment` przyjmuje pojedyncze `deck`; CLI eksperymentu dopuszcza tylko takie same talie po obu stronach, aby izolować zmianę jednej karty. Domyślnie dobiera frakcję badanej karty.

Boty oceniają nowe akcje i krótkie sekwencje heurystycznie. Podgląd planowania zatrzymuje się przed dobieraniem, kradzieżą i ujawnieniem kart; bot nie poznaje wyniku losowania przed podjęciem decyzji. To nie jest uczenie maszynowe ani pełne planowanie kilku tur. Replay zawiera pełny zapis gry do analizy i nie jest widokiem przeznaczonym dla gracza podczas rozgrywki.
