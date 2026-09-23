import { describe, expect, test } from 'vitest';
import { createCatalog } from '../src/cards.ts';
import { applyAction, createGame as createGameBase, getLegalActions, makePermanent, observe } from '../src/engine.ts';
import { pairedInterval, runExperiment, summarizePairs } from '../src/experiments.ts';
import { chooseAction } from '../src/bots.ts';
import { deriveSeed, Rng } from '../src/rng.ts';
import { createActionPreview, runGame, runSimulation, scoreFor } from '../src/simulate.ts';
import { main } from '../src/cli.ts';
import type { BotKind, GameOptions, GameState } from '../src/types.ts';

function createGame(options: GameOptions = {}): GameState {
  const s = createGameBase(options);
  applyAction(s, { type: 'mulligan', cardUids: [] });
  applyAction(s, { type: 'mulligan', cardUids: [] });
  return s;
}

describe('Reprodukowalność i izolacja', () => {
  test('ten sam seed daje tę samą pełną partię i ślad zdarzeń', () => {
    const options = { seed: 6789, trace: true, bots: ['aggressive', 'control'] as [BotKind, BotKind] };
    expect(runGame(options)).toEqual(runGame(options));
  });
  test('strumienie tasowania i decyzji są niezależne', () => {
    expect(deriveSeed(42, 'deck:0')).not.toBe(deriveSeed(42, 'bot:0'));
    expect(createGame({ seed: 42, botSeeds: [99, 98] }).players[0].deck).toEqual(createGame({ seed: 42 }).players[0].deck);
  });
  test.each(['aggressive', 'control', 'random'] as const)('bot %s wybiera legalną akcję', bot => {
    const s = createGame();
    for (let i = 0; i < 20 && !s.outcome; i++) {
      const legal = getLegalActions(s);
      const action = chooseAction(bot, observe(s), legal, new Rng(i));
      expect(legal).toContainEqual(action);
      applyAction(s, action);
    }
  });
  test('bot z podglądem jednego ruchu zachowuje Miecz i planuje wzmocnienie przed atakiem', () => {
    const s = createGame({ seed: 7 });
    s.turn = 3;
    s.currentPlayer = 0;
    s.players[0].turnsTaken = 2;
    s.players[1].turnsTaken = 1;
    for (const p of s.players) {
      p.deck.push(...p.hand);
      p.hand = [];
      p.board = [];
      p.maxEnergy = p.energy = 2;
    }
    const take = (owner: 0 | 1, id: 'gesi' | 'asterix' | 'miecz') => {
      const p = s.players[owner];
      const index = p.deck.findIndex(card => card.cardId === id);
      return p.deck.splice(index, 1)[0];
    };
    const geese = makePermanent(take(0, 'gesi'));
    s.players[0].board.push(geese);
    s.players[1].board.push(makePermanent(take(1, 'asterix')));
    const sword = take(0, 'miecz');
    s.players[0].hand.push(sword);
    const observation = observe(s);
    const legal = getLegalActions(s);
    const greedy = chooseAction('control', observation, legal, new Rng(1));
    const planned = chooseAction('control', observation, legal, new Rng(1), createActionPreview(s, 0));
    expect(greedy).toEqual({ type: 'createEnergy', cardUid: sword.uid });
    expect(planned).toEqual({ type: 'playCard', cardUid: sword.uid, targetUid: geese.uid });
  });
  test('planowanie nie zależy od ukrytej ręki ani kolejności talii przeciwnika', () => {
    const first = createGame({ seed: 91 });
    const second = structuredClone(first);
    second.players[1].hand.reverse();
    second.players[1].deck.reverse();
    const choose = (s: typeof first) => chooseAction('control', observe(s), getLegalActions(s), new Rng(44),
      createActionPreview(s, s.currentPlayer));
    expect(choose(first)).toEqual(choose(second));
  });
  test.each(['aggressive', 'control', 'random'] as const)('20 pełnych partii %s zachowuje karty, energię i żywe jednostki po każdej akcji', bot => {
    for (let seed = 0; seed < 20; seed++) {
      const result = runGame({ seed, bots: [bot, bot], verify: true });
      expect(result.outcome.kind).not.toBe('truncated');
      for (const side of result.metrics) for (const m of Object.values(side)) {
        expect(m.played).toBeLessThanOrEqual(m.drawn);
        expect(m.burned + m.played).toBeLessThanOrEqual(m.drawn);
        expect(m.played).toBeLessThanOrEqual(m.playableCopyTurns);
      }
    }
  }, 20000);
});

describe('Eksperymenty i statystyki', () => {
  test('identyczny wariant daje dokładnie 50% w KAŻDEJ parze, również z różnymi botami', () => {
    const result = runExperiment({ games: 24, seed: 42, card: 'obelix', patch: { cost: 5 } });
    expect(result.pairs).toHaveLength(12);
    expect(result.pairs.every(p => p.meanVariantScore === 0.5)).toBe(true);
    expect(result.comparison.variantScore).toBe(0.5);
    expect(result.results[0].deckSeeds).toEqual(result.results[1].deckSeeds);
    expect(result.results[0].botSeeds).toEqual(result.results[1].botSeeds);
    expect(result.results[0].outcome).toEqual(result.results[1].outcome);
  }, 20000);
  test('wariant zmienia dokładnie jedną definicję, bez mutowania bazowej', () => {
    const original = createCatalog();
    const variant = createCatalog({ obelix: { cost: 4 } });
    expect(original.obelix.cost).toBe(5);
    expect(variant.obelix.cost).toBe(4);
    expect(variant.asterix).toEqual(original.asterix);
    expect(createCatalog().obelix.cost).toBe(5);
  });
  test('przedział używa liczby par i nie jest zerowy przy zerowej wariancji', () => {
    const data = Array.from({ length: 100 }, () => 0.5);
    const [lo, hi] = pairedInterval(data)!;
    const radius = Math.sqrt(Math.log(40) / 200);
    expect(lo).toBeCloseTo(0.5 - radius);
    expect(hi).toBeCloseTo(0.5 + radius);
    expect(pairedInterval([])).toBeNull();
  });
  test('niekompletne pary są wykluczone, wyniki ucięte nie stają się remisami', () => {
    const result = runExperiment({ games: 4, seed: 42, card: 'obelix', patch: { cost: 5 }, rules: { maxTurns: 1 } });
    expect(result.summary.truncated).toBe(4);
    expect(result.summary.draws).toBe(0);
    expect(result.comparison.completePairs).toBe(0);
    expect(result.comparison.variantScore).toBeNull();
    expect(result.comparison.ci95).toBeNull();
    expect(result.comparison.allRequestedGamesScoreBounds).toEqual([0, 1]);
    expect(scoreFor({ kind: 'truncated', reason: 'turn-limit' }, 0)).toBeNull();
  });
  test('cała para odpada nawet jeśli tylko jedna z jej gier się nie zakończyła', () => {
    const report = summarizePairs([{ pair: 0, seed: 0, bots: ['control', 'control'], gameIndices: [0, 1],
      variantScores: [1, null], meanVariantScore: null }]);
    expect(report.excludedPairs).toBe(1);
    expect(report.allRequestedGamesScoreBounds).toEqual([0.5, 1]);
  });
  test('obie strony rozpoczynają po równo w pełnym cyklu symulacji', () => {
    const r = runSimulation({ games: 8, seed: 2 });
    expect(r.results.filter(g => g.firstPlayer === 0)).toHaveLength(4);
    expect(r.results.filter(g => g.firstPlayer === 1)).toHaveLength(4);
  });
  test('walidacja liczby gier, parametrów kart i zasad', async () => {
    expect(() => runExperiment({ games: 3, seed: 1, card: 'obelix', patch: { cost: 5 } })).toThrow('parzystej');
    expect(() => runExperiment({ games: 2, seed: 1, card: 'obelix', patch: { cost: 5, attack: 6 } })).toThrow('jeden');
    expect(() => createCatalog({ obelix: { cost: -1 } })).toThrow();
    expect(() => createGame({ rules: { maxTurns: 0 } })).toThrow();
    await expect(main(['simulate', '--games', 'NaN'])).rejects.toThrow();
    await expect(main(['simulate', '--card', 'obelix'])).rejects.toThrow('nie działa');
    await expect(main(['experiment', '--field', 'abilityEnabled', '--value', '0'])).rejects.toThrow('true lub false');
  });
});
