# Status wersji 0.7.0

Dodano talię Rzymian: 20 kart po trzy kopie, wszystkie zatwierdzone zdolności,
wybór talii graczy, obsługę botów i odtwarzanie raportów z wybranymi taliami.
Szczegóły: [ROMANS.md](ROMANS.md).

Weryfikacja: **95 testów zaliczonych**, kontrola typów TypeScript i `git diff --check` bez błędów.

Testy integracyjne CLI: raport i replay pojedynku Galowie–Rzymianie oraz
eksperymentu kosztu Ceplusa odtwarzają wynik, liczbę tur i akcji.

Próbna seria techniczna: po 100 gier, seedy 1000–1099, naprzemienny gracz
rozpoczynający, boty aggressive/control, kontrola integralności po każdej akcji.

| Talie graczy 0 / 1 | Ukończone | Przerwane | Wygrane gracza 0 / 1 |
|---|---:|---:|---:|
| Galowie / Rzymianie | 100 | 0 | 55 / 45 |
| Rzymianie / Rzymianie | 100 | 0 | 49 / 51 |

To weryfikacja działania, nie miarodajny ranking balansu: strategie botów były
przypisane do miejsc, a próba jest mała. Nie zmieniono statystyk podanych przez autora.

## Historyczny status wersji 0.6.0

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
