# Status wersji 0.5.0

- Początkowe i maksymalne życie obu graczy: **12 HP**.
- Spadające niebo kosztuje **2 energii** (wcześniej 3).
- W pierwszej własnej turze każdy gracz ma zakaz deklarowania ataków na gracza, jednostki i budowle.
- Zagrywanie kart i tworzenie energii pozostają dozwolone.
- Od drugiej własnej tury można normalnie atakować, także jednostkami właśnie zagranymi.
- Zachowano dodatkową kartę drugiego gracza w pierwszej turze; później każdy dobiera po jednej karcie. Gęsi pozostają 1/1 za 1.
- Falballa i Dobromina używają automatycznej premii ataku/warunkowego życia zależnej od kierunku walki; usunięto postawy.

Nie uruchamiano nowej serii do oceny balansu. Testy zasad i integralności silnika są oddzielne od badań balansu.
Poprzednie wyniki **52,8% / 47,2%** dotyczą wyłącznie zasad **0.2.0**.

[Raport 500 gier dla 0.2.0](RESULTS-v0.2.0.md).
[Starszy raport dla 0.1.0](RESULTS-v0.1.0.md).

Aby przeprowadzić nową serię na aktualnych zasadach:

```bash
npm run simulate -- --games 500 --seed 20260921 --out reports/v5-500
```

Weryfikacja wersji 0.5.0: **67 testów Vitest zaliczonych**, kontrola typów TypeScript bez błędów.
