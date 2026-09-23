import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createCatalog } from './cards.ts';
import { DEFAULT_RULES } from './engine.ts';
import { variantSeatForGame } from './experiments.ts';
import type { runExperiment } from './experiments.ts';
import type { GameResult, Summary } from './simulate.ts';
import type { BotKind, CardId, CardPatch, Rules } from './types.ts';

export const ENGINE_VERSION = '0.11.0';
export const RULESET_VERSION = 'galowie-rzymianie-v11';
export const percentage = (x: number | null) => x === null ? 'brak danych' : `${(x * 100).toFixed(2)}%`;
export interface ReportMetadata {
  mode: 'simulate' | 'experiment';
  games: number;
  seed: number;
  rules: Rules;
  bots?: [BotKind, BotKind];
  card?: CardId;
  patch?: CardPatch;
}
type Experiment = ReturnType<typeof runExperiment>;
export async function saveReport(directory: string, metadata: ReportMetadata, results: GameResult[], summary: Summary, experiment?: Experiment) {
  const catalog = createCatalog();
  const stem = `${metadata.mode}${metadata.card ? `-${metadata.card}` : ''}-${metadata.seed}`;
  const dir = resolve(directory);
  await mkdir(dir, { recursive: true });
  const meta = { ...metadata, engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION, defaultRules: DEFAULT_RULES,
    catalogs: { baseline: experiment?.baseline ?? catalog, variant: experiment?.variant ?? null } };
  const gameRecords = results.map((r, index) => ({ index, seed: r.seed, firstPlayer: r.firstPlayer, bots: r.bots,
    botSeeds: r.botSeeds, deckSeeds: r.deckSeeds, decks: r.decks, turns: r.turns, actions: r.actions, outcome: r.outcome,
    ...(experiment ? { pair: Math.floor(index / 2), variantSeat: variantSeatForGame(index) } : {}) }));
  const json = { metadata: meta, summary, comparison: experiment?.comparison ?? null, pairs: experiment?.pairs ?? null, games: gameRecords };
  const lines = [
    '# Karcianix — raport symulacji', '',
    `Silnik: ${ENGINE_VERSION}. Zasady: ${RULESET_VERSION}. Seed serii: ${metadata.seed}.`, '',
    `Talie (gracze 0 / 1): ${results[0]?.decks.join(' / ') ?? 'brak gier'}.`, '',
    `Gry: **${summary.games}**, zakończone: **${summary.completed}**, remisy: **${summary.draws}**, przerwane limitem: **${summary.truncated}**.`,
    `Średnia długość: **${summary.averageTurns.toFixed(1)} tur gracza**; mediana ${summary.medianTurns}, P90 ${summary.p90Turns}.`,
    `Wynik rozpoczynającego (wygrana = 1, remis = 0,5): **${percentage(summary.firstPlayerScore)}**. Przegrane przez pustą talię: ${summary.emptyDeckWins}.`, '',
  ];
  if (experiment) {
    const c = experiment.comparison;
    lines.push('## Kontrolowany eksperyment', '',
      `Karta: **${catalog[metadata.card!].name}**. Zmiana wszystkich trzech kopii po stronie wariantu: \`${JSON.stringify(metadata.patch)}\`.`,
      `Wynik wariantu: **${percentage(c.variantScore)}**. Różnica względem 50%: **${c.differenceFrom50PercentagePoints?.toFixed(2) ?? 'brak danych'} p.p.**.`,
      `Konserwatywny przedział ufności 95%: **${c.ci95 ? c.ci95.map(percentage).join(' – ') : 'brak danych'}** (nierówność Hoeffdinga, jednostką próby jest para).`,
      `Kompletne pary: **${c.completePairs}**; wyłączone z estymacji: **${c.excludedPairs}**.`, '',
      'W każdej parze zachowano kolejność obu talii i osobne strumienie RNG botów. Zamieniono warianty między miejscami; miejsce 0 rozpoczyna. Reguły i boty są takie same w obu grach.', '',
      'Wynik powyżej 50% oznacza przewagę zmienionego wariantu nad bazowym w tym zestawie botów. Jeśli przedział obejmuje 50%, wynik nie rozstrzyga kierunku przewagi na tym poziomie ufności.', '',
      '| Bot miejsca 0 / bot miejsca 1 | Kompletne pary | Wynik wariantu | Przedział 95% |',
      '|---|---:|---:|---|',
      ...c.byMatchup.map(row => `| ${row.matchup} | ${row.completePairs} | ${percentage(row.variantScore)} | ${row.ci95?.map(percentage).join(' – ') ?? 'brak danych'} |`), '');
    if (c.excludedPairs) lines.push(`**Uwaga: cenzurowane wyniki.** Przedział dotyczy tylko kompletnych par. Zakres wyniku dla wszystkich zamówionych gier przy dowolnym rozstrzygnięciu przerwanych: ${c.allRequestedGamesScoreBounds!.map(percentage).join(' – ')}. Zwiększ limit przed wnioskowaniem o balansie.`, '');
  }
  lines.push('## Obserwacje kart', '',
    '**To wskaźniki opisowe, nie ranking siły.** Wynik po zagraniu/dobraniu jest obciążony selekcją sytuacji i strategią bota. Tabela łączy obie strony; w eksperymencie również obie wersje karty.', '',
    '| Karta | Dobrania | Zagrania | Przepalone / dobrane | Zagrania / okazje | Obrażenia jednostkom | Obrażenia graczowi | Wynik po zagraniu |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...summary.cards.map(r => `| ${catalog[r.id].name} | ${r.totals.drawn} | ${r.totals.played} | ${percentage(r.burnPerDraw)} | ${percentage(r.playPerOpportunity)} | ${r.totals.unitDamage} | ${r.totals.directDamage} | ${percentage(r.scoreWhenPlayed)} |`), '',
    'Okazja = konkretna kopia miała co najmniej jedną legalną akcję zagrania w danej własnej turze, niezależnie od liczby celów i pozostałych akcji. Licznik czasu na ręce używa analogicznych kopio-tur. Obrażenia są efektywne, bez nadmiarowych obrażeń. Zabójstwa obejmują bezpośrednie obrażenia walki/trucizny; usunięcia przez spadek maksymalnego HP i śmierć źródła nie są przypisywane jako zabójstwa.', '',
    'Leczenie, warunkowe pule życia, blokady i pełne liczniki są w CSV/JSON. „Nałożone blokady” nie oznaczają liczby udaremnionych ataków. Wkład wzmocnień w późniejsze obrażenia przypisywany jest atakującej jednostce; wpływ kart wsparcia badaj eksperymentem z wyłączoną zdolnością.', '',
    '## Granice wnioskowania', '',
    '- Boty agresywny i kontrolny używają heurystyk oraz podglądu jednego kolejnego ruchu. Nie dostają informacji ukrytej i nie przeszukują pełnych tur ani przyszłych tur przeciwnika.',
    '- Założenia mechaniki, w tym warunkowe życie Falballi/Dobrominy i działanie Spadającego nieba, opisuje RULES.md.',
    '- Przerwania limitu nie są remisami i nie mają przypisanego wyniku 0,5.',
    '- Po badaniu wielu kart potwierdź wybrany wynik na nowych seedach; nie interpretuj wielu przedziałów 95% jako jednoczesnej gwarancji.',
    '- Sprawdź przebiegi gier i rozgrywki ludzi przed zmianą wydrukowanych kart.', '',
    'Pełne parametry, kolejność par i seedy poszczególnych gier znajdują się w JSON. Użyj `npm run replay -- --from <raport.json> --index 0`.', '',
  );
  const fields = Object.keys(summary.cards[0].totals) as (keyof Summary['cards'][number]['totals'])[];
  const csvRows = [ ['id', 'name', ...fields, 'drawnPlayerGames', 'playedPlayerGames', 'scoreWhenDrawn', 'scoreWhenPlayed', 'playPerOpportunity', 'burnPerDraw'],
    ...summary.cards.map(r => [r.id, catalog[r.id].name, ...fields.map(k => r.totals[k]), r.drawnPlayerGames, r.playedPlayerGames,
      r.scoreWhenDrawn, r.scoreWhenPlayed, r.playPerOpportunity, r.burnPerDraw]) ];
  const csv = '\uFEFF' + csvRows.map(row => row.map(x => `"${String(x ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
  const files = { json: join(dir, `${stem}.json`), csv: join(dir, `${stem}-cards.csv`), markdown: join(dir, `${stem}.md`) };
  await writeFile(files.json, JSON.stringify(json, null, 2) + '\n');
  await writeFile(files.csv, csv);
  await writeFile(files.markdown, lines.join('\n'));
  return files;
}
