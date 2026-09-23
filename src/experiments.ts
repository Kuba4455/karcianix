import { DECKS, createCatalog } from './cards.ts';
import { deriveSeed } from './rng.ts';
import { BOT_MATCHUPS, runGame, scoreFor, summarize } from './simulate.ts';
import type { GameResult } from './simulate.ts';
import type { BotKind, CardId, CardPatch, GameOptions, PlayerId, DeckId } from './types.ts';

export interface PairResult {
  pair: number;
  seed: number;
  bots: [BotKind, BotKind];
  gameIndices: [number, number];
  variantScores: [number | null, number | null];
  meanVariantScore: number | null;
}
/** Distribution-free Hoeffding interval on independent bounded PAIR means.
 * The two games inside each pair are deliberately not independent observations.
 * More conservative than a normal approximation, including at zero variance. */
export function pairedInterval(pairMeans: readonly number[], confidence = 0.95): [number, number] | null {
  if (!pairMeans.length) return null;
  if (confidence <= 0 || confidence >= 1 || pairMeans.some(x => !Number.isFinite(x) || x < 0 || x > 1)) throw new Error('Nieprawidłowe dane przedziału');
  const mean = pairMeans.reduce((a, b) => a + b, 0) / pairMeans.length;
  const radius = Math.sqrt(Math.log(2 / (1 - confidence)) / (2 * pairMeans.length));
  return [Math.max(0, mean - radius), Math.min(1, mean + radius)];
}
export function summarizePairs(pairs: readonly PairResult[]) {
  const complete = pairs.filter(p => p.meanVariantScore !== null);
  const means = complete.map(p => p.meanVariantScore!);
  const mean = means.length ? means.reduce((a, b) => a + b, 0) / means.length : null;
  const allScores = pairs.flatMap(p => p.variantScores);
  const knownPoints = allScores.reduce<number>((sum, score) => sum + (score ?? 0), 0);
  const missing = allScores.filter(score => score === null).length;
  return { pairs: pairs.length, completePairs: complete.length, excludedPairs: pairs.length - complete.length,
    variantScore: mean, differenceFrom50PercentagePoints: mean === null ? null : (mean - 0.5) * 100,
    ci95: pairedInterval(means), ciMethod: 'Hoeffding; independent paired means, range [0,1]',
    allRequestedGamesScoreBounds: allScores.length ? [knownPoints / allScores.length, (knownPoints + missing) / allScores.length] : null,
    byMatchup: [...new Set(pairs.map(p => p.bots.join(' / ')))].map(matchup => {
      const group = complete.filter(p => p.bots.join(' / ') === matchup);
      const values = group.map(p => p.meanVariantScore!);
      return { matchup, completePairs: values.length, variantScore: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, ci95: pairedInterval(values) };
    }) };
}
export interface ExperimentOptions {
  deck?: DeckId;
  games: number;
  seed: number;
  card: CardId;
  patch: CardPatch;
  bots?: [BotKind, BotKind];
  rules?: GameOptions['rules'];
  onProgress?: (done: number) => void;
}
export function runExperiment(options: ExperimentOptions) {
  if (!Number.isSafeInteger(options.games) || options.games < 2 || options.games % 2 !== 0) throw new Error('Eksperyment wymaga dodatniej, parzystej liczby gier (2 gry na parę)');
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xFFFFFFFF) throw new Error('Seed musi być liczbą uint32');
  if (Object.keys(options.patch).length !== 1) throw new Error('Zmieniaj dokładnie jeden parametr naraz');
  const baseline = createCatalog();
  const deck = options.deck ?? (DECKS.rzymianie.includes(options.card) ? 'rzymianie' : 'galowie');
  if (!Object.hasOwn(DECKS, deck) || !DECKS[deck].includes(options.card)) throw new Error('Karta eksperymentu musi należeć do wybranej talii');
  const variant = createCatalog({ [options.card]: options.patch });
  const results: GameResult[] = [];
  const pairs: PairResult[] = [];
  for (let i = 0; i < options.games / 2; i++) {
    const seed = deriveSeed(options.seed, `pair:${i}`);
    const bots = options.bots ?? BOT_MATCHUPS[i % BOT_MATCHUPS.length];
    const common: GameOptions = { seed, firstPlayer: 0, bots, rules: options.rules, decks: [deck, deck] };
    // Deck orders and decision RNG streams stay attached to seats, not variants.
    // Both variants are tested once in each starting position and bot strategy.
    const a = runGame({ ...common, catalogs: [baseline, variant] });
    const b = runGame({ ...common, catalogs: [variant, baseline] });
    const scores: [number | null, number | null] = [scoreFor(a.outcome, 1), scoreFor(b.outcome, 0)];
    pairs.push({ pair: i, seed, bots, gameIndices: [results.length, results.length + 1], variantScores: scores,
      meanVariantScore: scores[0] === null || scores[1] === null ? null : (scores[0] + scores[1]) / 2 });
    results.push(a, b);
    if (results.length % 100 === 0) options.onProgress?.(results.length);
  }
  return { baseline, variant, results, pairs, summary: summarize(results), comparison: summarizePairs(pairs) };
}
export const variantSeatForGame = (index: number): PlayerId => index % 2 === 0 ? 1 : 0;
