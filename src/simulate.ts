import { CARD_IDS } from './cards.ts';
import { chooseAction } from './bots.ts';
import type { ActionPreview } from './bots.ts';
import { applyAction, assertInvariants, createGame, emptyCardMetrics, getLegalActions, observe } from './engine.ts';
import { deriveSeed, Rng } from './rng.ts';
import type { Action, BotKind, GameOptions, GameState, Metrics, Outcome, PlayerId } from './types.ts';

export interface TraceStep { turn: number; player: PlayerId; action: Action }
export interface GameResult {
  seed: number;
  firstPlayer: PlayerId;
  bots: [BotKind, BotKind];
  botSeeds: [number, number];
  deckSeeds: [number, number];
  turns: number;
  actions: number;
  outcome: Outcome;
  metrics: [Metrics, Metrics];
  trace?: TraceStep[];
  events?: GameState['events'];
}
export function createActionPreview(s: GameState, owner: PlayerId): ActionPreview {
  return sequence => {
    const copy = structuredClone(s);
    for (const action of sequence) {
      if (copy.outcome || copy.currentPlayer !== owner) break;
      applyAction(copy, action);
    }
    const sameTurn = !copy.outcome && copy.currentPlayer === owner;
    return { observation: observe(copy, owner), actions: sameTurn ? getLegalActions(copy) : [],
      outcome: copy.outcome, sameTurn };
  };
}
export function runGame(options: GameOptions & { verify?: boolean } = {}): GameResult {
  const s = createGame(options);
  const bots = options.bots ?? ['aggressive', 'control'];
  const botSeeds: [number, number] = options.botSeeds ?? [deriveSeed(s.seed, 'bot:0'), deriveSeed(s.seed, 'bot:1')];
  const deckSeeds: [number, number] = options.deckSeeds ?? [deriveSeed(s.seed, 'deck:0'), deriveSeed(s.seed, 'deck:1')];
  const rngs = botSeeds.map(seed => new Rng(seed));
  const trace: TraceStep[] | undefined = options.trace ? [] : undefined;
  let lastTurn = -1;
  let handSeen = new Set<string>();
  let playableSeen = new Set<string>();
  let actions = 0;
  while (!s.outcome) {
    if (s.turn !== lastTurn) {
      lastTurn = s.turn;
      handSeen = new Set();
      playableSeen = new Set();
    }
    const owner = s.currentPlayer;
    const legal = getLegalActions(s);
    for (const card of s.players[owner].hand) if (!handSeen.has(card.uid)) {
      handSeen.add(card.uid);
      s.metrics[owner][card.cardId].handCopyTurns++;
    }
    for (const action of legal) if (action.type === 'playCard' && !playableSeen.has(action.cardUid)) {
      playableSeen.add(action.cardUid);
      const card = s.players[owner].hand.find(c => c.uid === action.cardUid)!;
      s.metrics[owner][card.cardId].playableCopyTurns++;
    }
    const action = chooseAction(bots[owner], observe(s), legal, rngs[owner], createActionPreview(s, owner));
    trace?.push({ turn: s.turn, player: owner, action });
    applyAction(s, action);
    actions++;
    if (options.verify) assertInvariants(s);
  }
  return { seed: s.seed, firstPlayer: s.firstPlayer, bots, botSeeds, deckSeeds,
    turns: s.turn, actions, outcome: s.outcome, metrics: s.metrics,
    ...(trace ? { trace, events: s.events } : {}) };
}

export const BOT_MATCHUPS: [BotKind, BotKind][] = [
  ['aggressive', 'aggressive'], ['control', 'control'], ['aggressive', 'control'], ['control', 'aggressive'],
];
export function scoreFor(outcome: Outcome, player: PlayerId): number | null {
  return outcome.kind === 'truncated' ? null : outcome.kind === 'draw' ? 0.5 : outcome.winner === player ? 1 : 0;
}
export interface CardSummary {
  id: (typeof CARD_IDS)[number];
  totals: Metrics[(typeof CARD_IDS)[number]];
  drawnPlayerGames: number;
  playedPlayerGames: number;
  burnedPlayerGames: number;
  scoredDrawnPlayerGames: number;
  scoredPlayedPlayerGames: number;
  scoreWhenDrawn: number | null;
  scoreWhenPlayed: number | null;
  playPerOpportunity: number | null;
  burnPerDraw: number | null;
}
export interface Summary {
  games: number;
  completed: number;
  wins: [number, number];
  draws: number;
  truncated: number;
  emptyDeckWins: number;
  firstPlayerScore: number | null;
  averageTurns: number;
  medianTurns: number;
  p90Turns: number;
  cards: CardSummary[];
}
export function summarize(results: readonly GameResult[]): Summary {
  const completed = results.filter(r => r.outcome.kind !== 'truncated');
  const lengths = results.map(r => r.turns).sort((a, b) => a - b);
  const quantile = (q: number) => {
    if (!lengths.length) return 0;
    const index = (lengths.length - 1) * q;
    const lo = Math.floor(index), hi = Math.ceil(index);
    return lengths[lo] + (lengths[hi] - lengths[lo]) * (index - lo);
  };
  const cards: CardSummary[] = CARD_IDS.map(id => {
    const totals = emptyCardMetrics();
    let drawnPlayerGames = 0, playedPlayerGames = 0, burnedPlayerGames = 0;
    let scoredDrawnPlayerGames = 0, scoredPlayedPlayerGames = 0, drawnScore = 0, playedScore = 0;
    for (const r of results) for (const owner of [0, 1] as const) {
      const m = r.metrics[owner][id];
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += m[key];
      if (m.drawn) drawnPlayerGames++;
      if (m.played) playedPlayerGames++;
      if (m.burned) burnedPlayerGames++;
      const score = scoreFor(r.outcome, owner);
      if (score !== null && m.drawn) { scoredDrawnPlayerGames++; drawnScore += score; }
      if (score !== null && m.played) { scoredPlayedPlayerGames++; playedScore += score; }
    }
    return { id, totals, drawnPlayerGames, playedPlayerGames, burnedPlayerGames, scoredDrawnPlayerGames, scoredPlayedPlayerGames,
      scoreWhenDrawn: scoredDrawnPlayerGames ? drawnScore / scoredDrawnPlayerGames : null,
      scoreWhenPlayed: scoredPlayedPlayerGames ? playedScore / scoredPlayedPlayerGames : null,
      playPerOpportunity: totals.playableCopyTurns ? totals.played / totals.playableCopyTurns : null,
      burnPerDraw: totals.drawn ? totals.burned / totals.drawn : null };
  });
  return { games: results.length, completed: completed.length,
    wins: [0, 1].map(p => results.filter(r => r.outcome.kind === 'win' && r.outcome.winner === p).length) as [number, number],
    draws: results.filter(r => r.outcome.kind === 'draw').length,
    truncated: results.length - completed.length,
    emptyDeckWins: results.filter(r => r.outcome.kind === 'win' && r.outcome.reason === 'empty-deck').length,
    firstPlayerScore: completed.length ? completed.reduce((n, r) => n + scoreFor(r.outcome, r.firstPlayer)!, 0) / completed.length : null,
    averageTurns: results.length ? results.reduce((n, r) => n + r.turns, 0) / results.length : 0,
    medianTurns: quantile(0.5), p90Turns: quantile(0.9), cards };
}
export function runSimulation(options: { games: number; seed: number; bots?: [BotKind, BotKind]; rules?: GameOptions['rules']; onProgress?: (done: number) => void }) {
  if (!Number.isSafeInteger(options.games) || options.games < 1) throw new Error('Liczba gier musi być dodatnią liczbą całkowitą');
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xFFFFFFFF) throw new Error('Seed musi być liczbą uint32');
  const results: GameResult[] = [];
  for (let i = 0; i < options.games; i++) {
    // Every consecutive two games switch the first player for the same matchup.
    results.push(runGame({ seed: deriveSeed(options.seed, `game:${i}`),
      firstPlayer: i % 2 as PlayerId,
      bots: options.bots ?? BOT_MATCHUPS[Math.floor(i / 2) % BOT_MATCHUPS.length], rules: options.rules }));
    if ((i + 1) % 100 === 0) options.onProgress?.(i + 1);
  }
  return { results, summary: summarize(results) };
}
