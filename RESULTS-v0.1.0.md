> Raport historyczny dla zasad 0.1.0, sprzed zmian dobierania i Gęsi. Aktualny raport: RESULTS.md.

# Pierwsze wyniki — 21.09.2026

Wersja silnika `0.1.0`, zasady `galowie-assumptions-v1`. Pełne założenia:
[RULES.md](RULES.md). Wyniki dotyczą aktualnych botów i tych założeń.

## Weryfikacja projektu

- **61 testów Vitest: zaliczone.** Obejmują zasady wszystkich kart, legalność
  ruchów, ochronę informacji ukrytej, powtarzalność, parowanie eksperymentów
  i niezmienniki podczas 60 pełnych partii botów.
- **TypeScript: brak błędów kontroli typów.**
- Kontrolny eksperyment Obelix koszt 4 vs 4: dokładnie 50% w każdej parze.
- Odtworzono obie gry pierwszej pary eksperymentu z raportu JSON. Zgadzały się
  wynik, liczba tur i liczba akcji; niezmienniki po każdej akcji zachowane.
- Sprawdzono także polecenie wyłączające zdolność Ahigienixa wraz z plikiem
  alternatywnych zasad. Ta mała seria była sprawdzeniem działania polecenia,
  nie podstawą wniosków o balansie.

## Obelix: koszt 4 kontra 5

Polecenie:

```bash
npm run experiment -- --games 10000 --seed 42 --card obelix --field cost --value 5 --out reports/obelix
```

| Wskaźnik | Wynik |
|---|---:|
| Partie | 10 000 |
| Kompletne pary | 5 000 / 5 000 |
| Wariant | Obelix 5/5 za 5 zamiast za 4, wszystkie trzy kopie |
| Wynik wariantu | **46,39%** |
| Różnica względem 50% | **−3,61 p.p.** |
| Konserwatywny przedział ufności 95% dla wyniku wariantu | **44,47–48,31%** |
| Przerwane partie | 0 |
| Średnia długość | 24,02 tury gracza |
| Zakończenia przez pustą talię | 120 |

| Bot miejsca 0 / bot miejsca 1 | Pary | Wynik wariantu za 5 |
|---|---:|---:|
| Agresywny / agresywny | 1 250 | 47,28% |
| Kontrolny / kontrolny | 1 250 | 45,44% |
| Agresywny / kontrolny | 1 250 | 46,52% |
| Kontrolny / agresywny | 1 250 | 46,32% |

Podwyżka kosztu osłabia talię w tych symulacjach. Przedział dla całego
eksperymentu nie obejmuje 50%. Nie jest to dowód, że obecny Obelix jest za
silny: eksperyment mierzy skutek konkretnej zmiany, nie docelowy poziom siły.
W każdej podgrupie kierunek estymaty jest taki sam, lecz nie wszystkie
przedziały podgrup wykluczają 50%; są w pełnym raporcie.

Pełne dane: [raport eksperymentu](reports/obelix/experiment-obelix-42.md),
[JSON z seedami i parami](reports/obelix/experiment-obelix-42.json),
[CSV kart](reports/obelix/experiment-obelix-42-cards.csv).

## Identyczne talie — 1 000 gier

```bash
npm run simulate -- --games 1000 --seed 20260921 --out reports/baseline
```

| Wskaźnik | Wynik |
|---|---:|
| Partie | 1 000 |
| Wynik rozpoczynającego | **66,30%** |
| Średnia długość | 23,71 tury gracza |
| Mediana długości | 21 tur gracza |
| 90. percentyl długości | 39 tur gracza |
| Przerwania | 0 |
| Zakończenia przez pustą talię | 13 |

Przewaga rozpoczynającego jest sygnałem do kolejnego badania zasad startu.
Obecnie nowo zagrane jednostki atakują od razu, obaj gracze pomijają dobieranie
w swojej pierwszej turze i zaczynają z 0 energii. Ta seria nie rozdziela
przyczyn przewagi; nie przypisuj jej automatycznie jednej z tych zasad.

Pełne dane: [raport bazowy](reports/baseline/simulate-20260921.md).

## Zalecany następny eksperyment

Po potwierdzeniu założeń mechaniki powtórz Obelixa na nowym seedzie, np.
`--seed 20260922 --out reports/obelix-validation`, a następnie sprawdź wariant
rekompensaty dla gracza nierozpoczynającego. Nie zmieniaj równocześnie kosztu
Obelixa i zasad startu, jeśli chcesz przypisać wynik konkretnej zmianie.
