import { describe, expect, test } from 'vitest';
import { DECKS, createCatalog } from '../src/cards.ts';
import { applyAction, assertInvariants, createGame as createGameBase, getLegalActions, getStats, makePermanent, observe, protectedUnit, sweepDeaths } from '../src/engine.ts';
import { chooseAction } from '../src/bots.ts';
import { Rng } from '../src/rng.ts';
import { createActionPreview, runGame } from '../src/simulate.ts';
import { runExperiment } from '../src/experiments.ts';
import type { Action, CardId, GameOptions, GameState, PlayerId } from '../src/types.ts';

function createGame(options: GameOptions = {}): GameState {
  const s = createGameBase(options);
  applyAction(s, { type: 'mulligan', cardUids: [] });
  applyAction(s, { type: 'mulligan', cardUids: [] });
  return s;
}

function scenario(gauls = false) {
  const s = createGame({ seed: 13, decks: ['rzymianie', gauls ? 'galowie' : 'rzymianie'] });
  s.turn = 3;
  s.players[0].turnsTaken = 2;
  s.players[1].turnsTaken = 1;
  for (const p of s.players) {
    p.deck.push(...p.hand); p.hand = [];
    p.energy = p.maxEnergy = 10;
  }
  return s;
}
function take(s: GameState, owner: PlayerId, id: CardId) {
  const p = s.players[owner];
  const i = p.deck.findIndex(c => c.cardId === id);
  if (i < 0) throw new Error(`Missing ${id}`);
  return p.deck.splice(i, 1)[0];
}
function hand(s: GameState, owner: PlayerId, id: CardId) {
  const c = take(s, owner, id); s.players[owner].hand.push(c); return c;
}
function unit(s: GameState, owner: PlayerId, id: CardId) {
  const u = makePermanent(take(s, owner, id)); s.players[owner].board.push(u); return u;
}
function play(s: GameState, id: CardId, extra: Partial<Extract<Action, { type: 'playCard' }>> = {}) {
  const c = hand(s, s.currentPlayer, id);
  applyAction(s, { type: 'playCard', cardUid: c.uid, ...extra });
  return s.players[s.currentPlayer].board.find(u => u.uid === c.uid)!;
}
const end = (s: GameState) => applyAction(s, { type: 'endTurn' });

describe('Rzymianie', () => {
  test('statystyki wszystkich 20 kart odpowiadają tabeli autora', () => {
    const catalog = createCatalog();
    expect(DECKS.rzymianie.map(id => [id, catalog[id].attack, catalog[id].health, catalog[id].cost])).toEqual([
      ['cezar', 5, 2, 4], ['brutus', 3, 2, 3], ['legionista', 1, 1, 1], ['wieniec', 0, 0, 1],
      ['katapulta', 6, 2, 4], ['antywirus', 2, 2, 3], ['zolw', 0, 4, 2], ['zapchlenius', 3, 1, 2],
      ['popus', 1, 3, 2], ['a38', 0, 0, 3], ['pieknus', 2, 4, 3], ['tester_luster', 0, 2, 1],
      ['kalimatis', 3, 2, 4], ['ceplus', 4, 2, 2], ['tarcza_rzymska', 0, 0, 2], ['kodeks', 0, 0, 1],
      ['hasta', 0, 0, 1], ['lew', 2, 2, 1], ['koloseum', 0, 5, 4], ['oszczep', 0, 0, 1],
    ]);
  });
  test('eksperyment rzymskiej karty dobiera talię i zachowuje kontrolę 50%', () => {
    const r = runExperiment({ games: 4, seed: 55, card: 'ceplus', patch: { cost: 2 } });
    expect(r.results.every(g => g.decks.every(d => d === 'rzymianie'))).toBe(true);
    expect(r.comparison.variantScore).toBe(0.5);
    expect(() => runExperiment({ games: 2, seed: 1, card: 'ceplus', patch: { cost: 3 }, deck: 'galowie' })).toThrow('należeć');
  });
  test('obie talie mają 20 rodzajów po trzy kopie, wybór jest niezależny', () => {
    for (const decks of [['galowie', 'rzymianie'], ['rzymianie', 'rzymianie']] as const) {
      const s = createGame({ decks: [...decks] });
      decks.forEach((deck, i) => {
        const cards = [...s.players[i].deck, ...s.players[i].hand];
        expect(cards).toHaveLength(60);
        expect(DECKS[deck]).toHaveLength(20);
        for (const id of DECKS[deck]) expect(cards.filter(c => c.cardId === id)).toHaveLength(3);
      });
      assertInvariants(s);
    }
  });
  test('Cezar chroniony przez jednostkę, ale nie budowlę; oszczep pomija ochronę', () => {
    const s = scenario();
    const caesar = unit(s, 1, 'cezar');
    const legion = unit(s, 1, 'legionista');
    const attacker = unit(s, 0, 'legionista');
    expect(protectedUnit(s, 1, caesar)).toBe(true);
    expect(getLegalActions(s)).not.toContainEqual({ type: 'attack', attackerUid: attacker.uid, targetUid: caesar.uid });
    legion.damage = 1; sweepDeaths(s);
    expect(protectedUnit(s, 1, caesar)).toBe(false);
    unit(s, 1, 'legionista');
    play(s, 'oszczep', { targetUid: caesar.uid });
    expect(s.players[1].board).not.toContain(caesar);
  });
  test('Cezary bez innych jednostek nie chronią się wzajemnie; Legionista chroni obu', () => {
    const s = scenario();
    const first = unit(s, 1, 'cezar');
    const second = unit(s, 1, 'cezar');
    const attacker = unit(s, 0, 'legionista');
    expect(protectedUnit(s, 1, first)).toBe(false);
    expect(protectedUnit(s, 1, second)).toBe(false);
    expect(getLegalActions(s)).toContainEqual({ type: 'attack', attackerUid: attacker.uid, targetUid: first.uid });
    expect(getLegalActions(s)).toContainEqual({ type: 'attack', attackerUid: attacker.uid, targetUid: second.uid });
    const protector = unit(s, 1, 'legionista');
    expect(protectedUnit(s, 1, first)).toBe(true);
    expect(protectedUnit(s, 1, second)).toBe(true);
    protector.damage = 1; sweepDeaths(s);
    expect(protectedUnit(s, 1, first)).toBe(false);
    expect(protectedUnit(s, 1, second)).toBe(false);
  });
  test('Brutus wybiera trzy premie z jednostek na polu przed ich atakiem, także po swoim wejściu', () => {
    const s = scenario();
    const b = play(s, 'brutus');
    for (const bonus of ['attack', 'health', 'both'] as const) {
      const l = unit(s, 0, 'legionista');
      expect(getLegalActions(s)).toContainEqual({ type: 'sacrifice', sourceUid: b.uid, targetUid: l.uid, bonus });
      applyAction(s, { type: 'sacrifice', sourceUid: b.uid, targetUid: l.uid, bonus });
      expect(s.players[0].discard.some(c => c.uid === l.uid)).toBe(true);
    }
    expect(getStats(s, 0, b)).toMatchObject({ attack: 6, health: 5 });
    expect(s.players[0].energy).toBe(7);
    expect(getLegalActions(s).some(a => a.type === 'sacrifice' && a.targetUid === b.uid)).toBe(false);
    const attacker = unit(s, 0, 'lew');
    const building = unit(s, 0, 'koloseum');
    const inHand = hand(s, 0, 'ceplus');
    applyAction(s, { type: 'attack', attackerUid: attacker.uid, targetUid: 'player:1' });
    expect(getLegalActions(s).some(a => a.type === 'sacrifice' && a.targetUid === attacker.uid)).toBe(false);
    expect(getLegalActions(s).some(a => a.type === 'sacrifice' && a.targetUid === inHand.uid)).toBe(false);
    expect(getLegalActions(s)).toContainEqual({ type: 'sacrifice', sourceUid: b.uid, targetUid: building.uid, bonus: 'health' });
  });
  test('Antywirus wybiera liczbę Legionistów, nie płaci za nich i nie ponawia efektu', () => {
    const s = scenario();
    for (let i = 0; i < 3; i++) hand(s, 0, 'legionista');
    play(s, 'antywirus', { summonCount: 2 });
    expect(s.players[0].board.filter(c => c.cardId === 'legionista')).toHaveLength(2);
    expect(s.players[0].hand.filter(c => c.cardId === 'legionista')).toHaveLength(1);
    expect(s.players[0].energy).toBe(7);
    end(s); end(s);
    expect(s.players[0].board.filter(c => c.cardId === 'legionista')).toHaveLength(2);
  });
  test('A38 pozwala zaatakować, ale po ataku zabrania poświęcenia i zwraca ocalałą jednostkę', () => {
    const s = scenario();
    const target = unit(s, 1, 'ceplus'); target.attacksUsed = 1; target.enteredTurn = s.turn;
    const b = unit(s, 0, 'brutus');
    play(s, 'a38', { targetUid: target.uid });
    expect(getLegalActions(s)).toContainEqual({ type: 'attack', attackerUid: target.uid, targetUid: 'player:1' });
    expect(getLegalActions(s)).toContainEqual({ type: 'sacrifice', sourceUid: b.uid, targetUid: target.uid, bonus: 'attack' });
    applyAction(s, { type: 'attack', attackerUid: target.uid, targetUid: 'player:1' });
    expect(getLegalActions(s).some(a => a.type === 'sacrifice' && a.targetUid === target.uid)).toBe(false);
    play(s, 'hasta', { targetUid: target.uid });
    target.damage = 1;
    end(s);
    expect(s.players[1].board).toContain(target);
    expect(target.borrowedFrom).toBeUndefined();
    expect(getStats(s, 1, target)).toMatchObject({ attack: 5, health: 1 });
  });
  test('Brutus poświęca przejętą A38 jednostkę przed atakiem; karta wraca do stosu właściciela', () => {
    const s = scenario();
    const stolen = unit(s, 1, 'legionista');
    const brutus = unit(s, 0, 'brutus');
    play(s, 'a38', { targetUid: stolen.uid });
    applyAction(s, { type: 'sacrifice', sourceUid: brutus.uid, targetUid: stolen.uid, bonus: 'health' });
    expect(getStats(s, 0, brutus)).toMatchObject({ attack: 3, health: 4 });
    expect(s.players[1].discard.some(c => c.uid === stolen.uid)).toBe(true);
    expect(s.players[0].discard.some(c => c.uid === stolen.uid)).toBe(false);
    end(s);
    expect(s.players[1].board.some(c => c.uid === stolen.uid)).toBe(false);
  });
  test('śmierć przejętej jednostki trafia do stosu właściciela', () => {
    const s = scenario();
    const target = unit(s, 1, 'legionista');
    play(s, 'a38', { targetUid: target.uid });
    target.damage = 1; sweepDeaths(s); end(s);
    expect(s.players[1].discard.some(c => c.uid === target.uid)).toBe(true);
    expect(s.players.flatMap(p => p.board).some(c => c.uid === target.uid)).toBe(false);
  });
  test('Kalimatis ujawnia tylko właścicielowi dwie karty, wiedza znika po opuszczeniu ręki', () => {
    const s = scenario();
    hand(s, 1, 'legionista'); hand(s, 1, 'lew'); hand(s, 1, 'hasta');
    play(s, 'kalimatis', { choice: 'peek' });
    const known = observe(s).self.knownOpponentHand;
    expect(known).toHaveLength(2);
    expect(observe(s, 1).self.knownOpponentHand).toHaveLength(0);
    expect(observe(s).opponent).not.toHaveProperty('hand');
    end(s);
    s.players[1].maxEnergy = s.players[1].energy = 9;
    applyAction(s, { type: 'createEnergy', cardUid: known[0].uid });
    expect(observe(s, 0).self.knownOpponentHand.some(c => c.uid === known[0].uid)).toBe(false);
  });
  test('Kalimatis kradnie deterministycznie, a obca karta działa i wraca do właściciela po śmierci', () => {
    const s = scenario(true);
    const geese = hand(s, 1, 'gesi');
    play(s, 'kalimatis', { choice: 'steal' });
    expect(s.players[0].hand).toContainEqual(geese);
    applyAction(s, { type: 'playCard', cardUid: geese.uid });
    const stolen = s.players[0].board.find(c => c.uid === geese.uid)!;
    stolen.damage = 2; sweepDeaths(s);
    expect(s.players[1].discard).toContainEqual(geese);
  });
  test('planowanie Kalimatisa i Kodeksu nie ujawnia losowych ani przyszłych kart', () => {
    const s = scenario(); hand(s, 1, 'lew');
    const k = hand(s, 0, 'kalimatis'); const code = hand(s, 0, 'kodeks');
    const actions: Action[] = [{ type: 'playCard', cardUid: k.uid, choice: 'steal' },
      { type: 'playCard', cardUid: k.uid, choice: 'peek' },
      { type: 'playCard', cardUid: code.uid, discardUid: k.uid }];
    const different = structuredClone(s); different.players[1].hand[0].cardId = 'katapulta'; different.players[0].deck.reverse();
    for (const action of actions) {
      expect(createActionPreview(s, 0)([action])).toEqual(createActionPreview(different, 0)([action]));
      expect(createActionPreview(s, 0)([action]).observation.self.knownOpponentHand).toHaveLength(0);
    }
    const choose = (state: GameState) => chooseAction('control', observe(state), getLegalActions(state), new Rng(9), createActionPreview(state, 0));
    expect(choose(s)).toEqual(choose(different));
  });
  test.each(['ceplus', 'lew'] as const)('%s czeka z atakiem, ale oddaje obrażenia', id => {
    const s = scenario(); const u = play(s, id);
    expect(getLegalActions(s).some(a => a.type === 'attack' && a.attackerUid === u.uid)).toBe(false);
    const enemy = unit(s, 1, 'tester_luster'); enemy.modifiers.push({ origin: 'hasta', attack: 1, health: 0 });
    end(s);
    applyAction(s, { type: 'attack', attackerUid: enemy.uid, targetUid: u.uid });
    expect(s.players[1].board).not.toContain(enemy);
    end(s);
    expect(getLegalActions(s).some(a => a.type === 'attack' && a.attackerUid === u.uid)).toBe(true);
  });
  test('Koloseum kosztuje 2 za schowanie, odsłania za darmo i po zniszczeniu', () => {
    const s = scenario(); const col = unit(s, 0, 'koloseum'); const l = unit(s, 0, 'legionista');
    applyAction(s, { type: 'hide', sourceUid: col.uid, targetUid: l.uid });
    expect(s.players[0].energy).toBe(8);
    expect(protectedUnit(s, 0, l)).toBe(true);
    expect(getLegalActions(s).some(a => a.type === 'attack' && a.attackerUid === l.uid)).toBe(false);
    applyAction(s, { type: 'unhide', targetUid: l.uid });
    expect(s.players[0].energy).toBe(8);
    expect(protectedUnit(s, 0, l)).toBe(false);
    applyAction(s, { type: 'hide', sourceUid: col.uid, targetUid: l.uid });
    col.damage = 5; sweepDeaths(s);
    expect(l.hiddenBy).toBeUndefined();
  });
  test('Koloseum nie chowa Koloseum; schowana zwykła jednostka nadal podlega truciznie', () => {
    const s = scenario(true); const a = unit(s, 0, 'koloseum'); const b = unit(s, 0, 'koloseum');
    const l = unit(s, 0, 'legionista'); unit(s, 1, 'ahigienix');
    expect(getLegalActions(s)).not.toContainEqual({ type: 'hide', sourceUid: a.uid, targetUid: b.uid });
    expect(getLegalActions(s)).not.toContainEqual({ type: 'hide', sourceUid: b.uid, targetUid: a.uid });
    expect(() => applyAction(s, { type: 'hide', sourceUid: a.uid, targetUid: b.uid })).toThrow('Nielegalny');
    applyAction(s, { type: 'hide', sourceUid: a.uid, targetUid: l.uid });
    expect(protectedUnit(s, 0, l)).toBe(true);
    end(s); end(s);
    expect(s.players[0].board).not.toContain(l);
  });
  test('oszczep dosięga schowanej karty; A38 odsłania jednostki za przejętym Koloseum', () => {
    const s = scenario(); const col = unit(s, 1, 'koloseum'); const l = unit(s, 1, 'legionista'); l.hiddenBy = col.uid;
    expect(getLegalActions(s).some(a => a.type === 'attack' && a.targetUid === l.uid)).toBe(false);
    play(s, 'a38', { targetUid: col.uid });
    expect(l.hiddenBy).toBeUndefined();
    play(s, 'oszczep', { targetUid: l.uid });
    expect(s.players[1].board).not.toContain(l);
  });
  test('oszczep znika na początku tury, zachowując inne obrażenia', () => {
    const s = scenario(); const target = unit(s, 1, 'koloseum'); target.damage = 1;
    play(s, 'oszczep', { targetUid: target.uid });
    expect(target.damage).toBe(3);
    end(s); expect(target.damage).toBe(1);
  });
  test('leczenie oszczepu nie usuwa ponownie starszych ran przy wygaśnięciu', () => {
    const s = scenario(true); const target = unit(s, 1, 'automatix'); target.damage = 1;
    play(s, 'oszczep', { targetUid: target.uid });
    play(s, 'a38', { targetUid: target.uid });
    const heal = hand(s, 1, 'pieczony_dzik');
    s.players[1].hand = s.players[1].hand.filter(c => c.uid !== heal.uid); s.players[0].hand.push(heal);
    applyAction(s, { type: 'playCard', cardUid: heal.uid, targetUid: target.uid });
    expect(target.damage).toBe(1);
    end(s); expect(target.damage).toBe(1);
  });
  test('Kodeks odrzuca inną kartę i dobiera dokładnie dwie, wymaga kosztu dodatkowego', () => {
    const s = scenario(); const code = hand(s, 0, 'kodeks');
    expect(getLegalActions(s).some(a => a.type === 'playCard' && a.cardUid === code.uid)).toBe(false);
    const l = hand(s, 0, 'legionista'); const count = s.players[0].deck.length;
    applyAction(s, { type: 'playCard', cardUid: code.uid, discardUid: l.uid });
    expect(s.players[0].hand).toHaveLength(2);
    expect(s.players[0].deck).toHaveLength(count - 2);
    expect(s.players[0].discard).toEqual(expect.arrayContaining([code, l]));
  });
  test('rzymskie premie sumują się i znikają po Spadającym niebie', () => {
    const s = scenario(true); const l = unit(s, 0, 'legionista');
    play(s, 'wieniec', { targetUid: l.uid }); play(s, 'hasta', { targetUid: l.uid }); play(s, 'tarcza_rzymska', { targetUid: l.uid });
    expect(getStats(s, 0, l)).toMatchObject({ attack: 4, health: 3 });
    end(s); play(s, 'spadajace_niebo');
    expect(getStats(s, 0, l)).toMatchObject({ attack: 1, health: 1 });
  });
  test('wyłączenie zdolności działa również dla nowych kart', () => {
    const s = scenario(); s.catalogs[0] = createCatalog({ ceplus: { abilityEnabled: false }, antywirus: { abilityEnabled: false } });
    hand(s, 0, 'legionista'); play(s, 'antywirus'); const c = play(s, 'ceplus');
    expect(s.players[0].hand.some(c => c.cardId === 'legionista')).toBe(true);
    expect(getLegalActions(s).some(a => a.type === 'attack' && a.attackerUid === c.uid)).toBe(true);
  });
  test.each(['random', 'aggressive', 'control'] as const)('pełne partie %s zachowują karty i deterministyczność', bot => {
    for (let seed = 0; seed < 8; seed++) {
      const options = { seed, decks: ['rzymianie', seed % 2 ? 'galowie' : 'rzymianie'] as ['rzymianie', 'galowie' | 'rzymianie'], bots: [bot, bot] as [typeof bot, typeof bot], verify: true };
      const result = runGame(options);
      expect(result.outcome.kind).not.toBe('truncated');
      if (seed === 0) expect(runGame(options)).toEqual(result);
    }
  }, 30000);
});
