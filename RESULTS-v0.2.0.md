> Raport historyczny dla wersji 0.2.0, przed zmianą HP i zakazem ataków w pierwszej turze.

# Wyniki po zmianie zasad — 500 gier

Silnik **0.2.0**, zasady **galowie-v2**, seed serii **20260921**.

## Wprowadzone zmiany

- Rozpoczynający ma 6 kart i nie dobiera w swojej pierwszej turze.
- Drugi gracz zaczyna z 6 kartami i dobiera **1 kartę na początku swojej pierwszej tury**.
- Od drugiej własnej tury obaj dobierają po **2 karty**.
- Gęsi: **1 ataku / 1 życia / 1 energii**.
- Pozostałe reguły i bazowe karty pozostają bez zmian, w tym Obelix za 4.

## Wynik serii

| Wskaźnik | Wynik |
|---|---:|
| Partie zakończone | 500 / 500 |
| Zwycięstwa rozpoczynającego | 264 — 52.8% |
| Zwycięstwa drugiego gracza | 236 — 47.2% |
| Remisy | 0 |
| Przerwania limitem | 0 |
| Średnia długość | 23.87 tury gracza |
| Mediana długości | 22 tury gracza |
| 90. percentyl długości | 37 tur gracza |
| Zakończenia przez pustą talię | 2 |

Oba miejsca rozpoczynały po 250 razy. Wykorzystano te same cztery zestawienia
botów agresywny/kontrolny co wcześniej. Statystyki pierwszego/drugiego gracza
liczą kolejność gry, a nie stałe miejsce 0/1.

Wynik **52,8% do 47,2%** jest bliższy 50/50 niż poprzednia seria 1000 gier
(**66,3% do 33,7%**). Serie mają różne liczebności; to opisowe porównanie,
a nie izolowany pomiar wpływu jednej karty. Zmieniono jednocześnie dobieranie
i Gęsi, więc nie można przypisać całej różnicy wyłącznie dodatkowej karcie.
500 partii z heurystycznymi botami nie dowodzi idealnego balansu.

## Powtórzenie

```bash
npm ci
npm test
npm run typecheck
npm run simulate -- --games 500 --seed 20260921 --out reports/v2-500
```

**Weryfikacja:** 63 testy zaliczone, kontrola typów bez błędów. Nowe testy
sprawdzają dobieranie przy obu możliwych miejscach rozpoczynających i Gęsi 1/1/1.

Pełny [raport](reports/v2-500/simulate-20260921.md),
[dane JSON](reports/v2-500/simulate-20260921.json),
[statystyki kart CSV](reports/v2-500/simulate-20260921-cards.csv).

[Wyniki historyczne 0.1.0](RESULTS-v0.1.0.md) zachowano osobno.
