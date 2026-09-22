# Status wersji 0.6.0

- Początkowe i maksymalne życie obu graczy: **12 HP**.
- Spadające niebo kosztuje **3 energii**.
- W pierwszej własnej turze każdy gracz ma zakaz deklarowania ataków na gracza, jednostki i budowle.
- Zagrywanie kart i tworzenie energii pozostają dozwolone.
- Od drugiej własnej tury można normalnie atakować, także jednostkami właśnie zagranymi.
- Zachowano dodatkową kartę drugiego gracza w pierwszej turze; później każdy dobiera po jednej karcie.
- Gęsi mają 1/2 za 1, Miecz kosztuje 2, Obelix kosztuje 5, a Kakofonix ma 2/1 za 3.
- Falballa i Dobromina używają automatycznej premii ataku/warunkowego życia zależnej od kierunku walki; usunięto postawy.
- Zablokowane jednostki domyślnie nie oddają obrażeń (`stunRetaliation: true`).
- Panoramix daje wyłącznie +0/+2 jednostce już leżącej na stole i jest chroniony przed atakami do utraty tej premii lub śmierci celu.
- Boty agresywny i kontrolny przewidują najlepszy kolejny ruch w tej samej turze, bez dostępu do informacji ukrytych.

Nie uruchamiano nowej serii do oceny balansu. Testy zasad i integralności silnika są oddzielne od badań balansu.
Poprzednie wyniki **52,8% / 47,2%** dotyczą wyłącznie zasad **0.2.0**.

[Raport 500 gier dla 0.2.0](RESULTS-v0.2.0.md).
[Starszy raport dla 0.1.0](RESULTS-v0.1.0.md).

Aby przeprowadzić nową serię na aktualnych zasadach:

```bash
npm run simulate -- --games 500 --seed 20260921 --out reports/v6-500
```

Weryfikacja wersji 0.6.0: **71 testów Vitest zaliczonych**, kontrola typów TypeScript bez błędów.
