import { describe, expect, test } from 'vitest';
import { DECKS, createCatalog } from '../src/cards.ts';
import {
  applyAction, createGame as createGameBase, getLegalActions, getStats, makePermanent, observe,
  playerTarget, sweepDeaths,
} from '../src/engine.ts';
import type { Action, CardId, GameOptions, GameState, Permanent, PlayerId } from '../src/types.ts';

function createGame(options: GameOptions = {}): GameState {
  const s = createGameBase(options);
  applyAction(s, { type: 'mulligan', cardUids: [] });
  applyAction(s, { type: 'mulligan', cardUids: [] });
  return s;
}

function scenario(): GameState {
  const s = createGame({ seed: 13, rules: { startingHp: 12 } });
  // General combat scenarios take place after the protected opening round.
  s.turn = 3;
  s.players[0].turnsTaken = 2;
  s.players[1].turnsTaken = 1;
  for (const p of s.players) {
    p.deck.push(...p.hand);
    p.hand = [];
    p.maxEnergy = p.energy = 10;
  }
  return s;
}
function take(s: GameState, owner: PlayerId, id: CardId) {
  const p = s.players[owner];
  const i = p.deck.findIndex(c => c.cardId === id);
  if (i < 0) throw new Error(`Brak karty testowej ${id}`);
  return p.deck.splice(i, 1)[0];
}
function hand(s: GameState, owner: PlayerId, id: CardId) {
  const card = take(s, owner, id);
  s.players[owner].hand.push(card);
  return card;
}
function unit(s: GameState, owner: PlayerId, id: CardId): Permanent {
  const u = makePermanent(take(s, owner, id));
  s.players[owner].board.push(u);
  return u;
}
function play(s: GameState, id: CardId, targetUid?: string, debuff?: 'both' | 'attack' | 'health') {
  const c = hand(s, s.currentPlayer, id);
  applyAction(s, { type: 'playCard', cardUid: c.uid, ...(targetUid ? { targetUid } : {}), ...(debuff ? { debuff } : {}) });
  return s.players[s.currentPlayer].board.find(u => u.uid === c.uid);
}
const end = (s: GameState) => applyAction(s, { type: 'endTurn' });
const hit = (s: GameState, attacker: Permanent, defender: Permanent | string) => applyAction(s, {
  type: 'attack', attackerUid: attacker.uid, targetUid: typeof defender === 'string' ? defender : defender.uid,
});

describe('Podstawowe zasady', () => {
  test('domyślne zasady zachowują obecne 15 HP', () => {
    expect(createGame().rules).toMatchObject({
      startingHp: 15,
      startingEnergy: 1,
      openingHand: 6,
      drawPerTurn: 1,
      secondPlayerFirstDraw: 1,
      allowFirstTurnAttacks: false,
      maxEnergy: 10,
      stunRetaliation: true,
    });
  });
  test.each([0, 1] as const)('wymiana startowa obu graczy, ponowne tasowanie i energia; zaczyna %s', firstPlayer => {
    const s = createGameBase({ seed: 41, firstPlayer });
    const initial = s.players[firstPlayer].hand.map(c => c.uid);
    const oldDeck = s.players[firstPlayer].deck.map(c => c.uid);
    expect(s.players.map(p => [p.energy, p.maxEnergy, p.hand.length])).toEqual([[1, 1, 6], [1, 1, 6]]);
    expect(getLegalActions(s)).toEqual([{ type: 'mulligan', cardUids: [] }]);
    expect(() => applyAction(s, { type: 'endTurn' })).toThrow('Nielegalny');
    expect(() => applyAction(s, { type: 'mulligan', cardUids: [initial[0], initial[0]] })).toThrow('Nielegalny');
    const returned = initial.slice(0, 2);
    applyAction(s, { type: 'mulligan', cardUids: returned });
    expect(s.currentPlayer).toBe(1 - firstPlayer);
    expect(s.players[firstPlayer].hand).toHaveLength(6);
    expect(s.players[firstPlayer].discard).toHaveLength(0);
    expect([...s.players[firstPlayer].hand, ...s.players[firstPlayer].deck].filter(c => returned.includes(c.uid))).toHaveLength(2);
    expect(s.players[firstPlayer].deck).toHaveLength(54);
    expect(s.players[firstPlayer].deck.map(c => c.uid)).not.toEqual(oldDeck.slice(2));
    expect(s.players[firstPlayer].turnsTaken).toBe(0);
    applyAction(s, { type: 'mulligan', cardUids: s.players[s.currentPlayer].hand.map(c => c.uid) });
    expect(s.currentPlayer).toBe(firstPlayer);
    expect(s.players[1 - firstPlayer].hand).toHaveLength(6);
    expect(s.players[1 - firstPlayer].discard).toHaveLength(0);
    expect(s.players[firstPlayer].turnsTaken).toBe(1);
    expect(s.players[firstPlayer].energy).toBe(1);
    end(s);
    expect(s.players[1 - firstPlayer].hand).toHaveLength(7);
    expect(s.players[1 - firstPlayer].energy).toBe(1);
    expect(createGameBase({ seed: 41, firstPlayer }).players[firstPlayer].hand.map(c => c.uid)).toEqual(initial);
  });
  test('karta oddana do talii może zostać ponownie dobrana podczas wymiany', () => {
    const s = createGameBase({ seed: 6 });
    const returned = s.players[0].hand.slice(0, 2).map(card => card.uid);
    applyAction(s, { type: 'mulligan', cardUids: returned });
    expect(s.players[0].hand.some(card => returned.includes(card.uid))).toBe(true);
    expect(s.players[0].discard).toHaveLength(0);
  });
  test.each([0, 1] as const)('tylko rozpoczynający nie atakuje w pierwszej własnej turze; zaczyna %s', firstPlayer => {
    const s = createGame({ firstPlayer });
    const units: Permanent[] = [];
    for (let turn = 0; turn < 2; turn++) {
      const owner = s.currentPlayer;
      // Creating energy and playing a card remain legal during the opening.
      applyAction(s, { type: 'createEnergy', cardUid: s.players[owner].hand[0].uid });
      const g = play(s, 'gesi')!;
      units.push(g);
      if (turn === 0) {
        expect(getLegalActions(s).some(a => a.type === 'attack')).toBe(false);
        expect(() => hit(s, g, playerTarget(owner === 0 ? 1 : 0))).toThrow('Nielegalny');
      } else {
        expect(getLegalActions(s)).toContainEqual({ type: 'attack', attackerUid: g.uid, targetUid: units[0].uid });
        expect(() => hit(s, g, playerTarget(owner === 0 ? 1 : 0))).toThrow('Nielegalny');
      }
      end(s);
    }
    expect(s.players.map(p => p.hp)).toEqual([15, 15]);
    expect(getLegalActions(s)).toContainEqual({ type: 'attack', attackerUid: units[0].uid, targetUid: units[1].uid });
    end(s);
    expect(getLegalActions(s)).toContainEqual({ type: 'attack', attackerUid: units[1].uid, targetUid: units[0].uid });
  });
  test('drugi gracz może atakować gracza bez kart na polu już w swojej pierwszej turze', () => {
    const s = createGame({ firstPlayer: 1 });
    end(s);
    const g = unit(s, 0, 'gesi');
    expect(getLegalActions(s)).toContainEqual({ type: 'attack', attackerUid: g.uid, targetUid: playerTarget(1) });
    hit(s, g, playerTarget(1));
    expect(s.players[1].hp).toBe(14);
  });
  test('przełącznik allowFirstTurnAttacks pozwala też rozpoczynającemu atakować od razu', () => {
    const s = createGame({ firstPlayer: 1, rules: { allowFirstTurnAttacks: true } });
    const g = unit(s, 1, 'gesi');
    expect(getLegalActions(s)).toContainEqual({ type: 'attack', attackerUid: g.uid, targetUid: playerTarget(0) });
  });
  test('20 rodzajów kart, po 3 kopie w każdej osobnej talii, 6 kart i 15 HP na start', () => {
    const s = createGame({ seed: 7 });
    expect(DECKS.galowie).toHaveLength(20);
    for (const p of s.players) {
      expect(p.hp).toBe(15);
      expect(p.hand).toHaveLength(6);
      expect(p.deck).toHaveLength(54);
      for (const id of DECKS.galowie) expect([...p.hand, ...p.deck].filter(c => c.cardId === id)).toHaveLength(3);
    }
    expect(s.players[0].hand).not.toEqual(s.players[1].hand);
  });
  test.each([0, 1] as const)('drugi gracz dobiera 1 w pierwszej turze, później obaj po 1; zaczyna miejsce %s', firstPlayer => {
    const s = createGame({ firstPlayer });
    const secondPlayer = firstPlayer === 0 ? 1 : 0;
    expect(s.players.map(p => p.hand.length)).toEqual([6, 6]);
    end(s);
    expect(s.players[firstPlayer].hand).toHaveLength(6);
    expect(s.players[secondPlayer].hand).toHaveLength(7);
    expect(s.players[secondPlayer].deck).toHaveLength(53);
    end(s);
    expect(s.players[firstPlayer].hand).toHaveLength(7);
    expect(s.players[secondPlayer].hand).toHaveLength(7);
    end(s);
    expect(s.players[firstPlayer].hand).toHaveLength(7);
    expect(s.players[secondPlayer].hand).toHaveLength(8);
    end(s);
    expect(s.players[firstPlayer].hand).toHaveLength(8);
    expect(s.players[secondPlayer].hand).toHaveLength(8);
  });
  test('Gęsi mają 1/2 za 1 i poza pierwszą turą atakują od razu bez wzmocnień', () => {
    const s = scenario();
    const g = play(s, 'gesi')!;
    expect(getStats(s, 0, g)).toEqual({ attack: 1, health: 2, maxHealth: 2 });
    expect(s.players[0].energy).toBe(9);
    hit(s, g, playerTarget(1));
    expect(s.players[1].hp).toBe(11);
  });
  test('jedna karta energii na turę; nowa energia od razu dostępna, odnowienie na start tury', () => {
    const s = createGame();
    const card = s.players[0].hand[0];
    applyAction(s, { type: 'createEnergy', cardUid: card.uid });
    expect(s.players[0].energy).toBe(2);
    expect(s.players[0].hand).toHaveLength(5);
    expect(s.players[0].energyCards).toEqual([card]);
    expect(getLegalActions(s).some(a => a.type === 'createEnergy')).toBe(false);
    s.players[0].energy = 0;
    end(s); end(s);
    expect(s.players[0].energy).toBe(2);
    expect(getLegalActions(s).some(a => a.type === 'createEnergy')).toBe(true);
  });
  test('nie trzeba tworzyć energii, ale nie można przekroczyć 10', () => {
    const s = scenario();
    hand(s, 0, 'obelix');
    expect(getLegalActions(s).some(a => a.type === 'createEnergy')).toBe(false);
    end(s);
    expect(s.currentPlayer).toBe(1);
  });
  test('nielegalny ruch nie zmienia stanu', () => {
    const s = createGame();
    const before = structuredClone(s);
    expect(() => applyAction(s, { type: 'playCard', cardUid: 'nieistniejaca' })).toThrow('Nielegalny');
    expect(s).toEqual(before);
  });
  test('poza pierwszą turą nowa jednostka atakuje od razu, tylko raz w turze', () => {
    const s = scenario();
    const a = play(s, 'obelix')!;
    hit(s, a, playerTarget(1));
    expect(s.players[1].hp).toBe(7);
    expect(() => hit(s, a, playerTarget(1))).toThrow();
  });
  test('najpierw całe pole, w tym Palisada; nie wolno atakować własnej karty', () => {
    const s = scenario();
    const a = unit(s, 0, 'obelix');
    const wall = unit(s, 1, 'palisada');
    expect(() => hit(s, a, playerTarget(1))).toThrow();
    expect(() => hit(s, a, a)).toThrow();
    hit(s, a, wall);
    expect(s.players[1].hp).toBe(12);
    expect(s.players[1].board).toHaveLength(0);
  });
  test('obrażenia jednoczesne mogą zabić obie jednostki', () => {
    const s = scenario();
    hit(s, unit(s, 0, 'dzik'), unit(s, 1, 'dzik'));
    expect(s.players.map(p => p.board.length)).toEqual([0, 0]);
    expect(s.metrics.map(m => m.dzik.kills)).toEqual([1, 1]);
    expect(s.metrics.map(m => m.dzik.unitDamage)).toEqual([1, 1]);
  });
  test('obrażenia zostają między turami', () => {
    const s = scenario();
    const defender = unit(s, 1, 'automatix');
    hit(s, unit(s, 0, 'dzik'), defender);
    end(s); end(s);
    expect(getStats(s, 1, defender).health).toBe(3);
  });
  test('budowle i jednostki z zerowym atakiem nie atakują', () => {
    const s = scenario();
    unit(s, 0, 'kociolek');
    const geese = unit(s, 0, 'gesi');
    geese.modifiers.push({ origin: 'asparanoix', attack: -1, health: 0 });
    // The cauldron turns 0-attack geese into a legal attacker.
    expect(getLegalActions(s).filter(a => a.type === 'attack')).toEqual([{ type: 'attack', attackerUid: geese.uid, targetUid: 'player:1' }]);
  });
  test('pusta talia to przegrana przy wymaganym dobraniu, bez obrażeń HP', () => {
    const s = scenario();
    s.players[0].deck = [];
    end(s); end(s);
    expect(s.outcome).toEqual({ kind: 'win', winner: 1, reason: 'empty-deck' });
    expect(s.players[0].hp).toBe(12);
  });
  test('pustą talię można skonfigurować jako pomijanie dobierania', () => {
    const s = scenario();
    s.rules.emptyDeck = 'skip';
    s.players[0].deck = [];
    end(s); end(s);
    expect(s.outcome).toBeNull();
  });
  test('limity tur i akcji są przerwaniem, a nie remisem', () => {
    const s = createGame({ rules: { maxTurns: 1 } });
    end(s);
    expect(s.outcome).toEqual({ kind: 'truncated', reason: 'turn-limit' });
    const a = createGame({ rules: { maxActionsPerTurn: 1 } });
    applyAction(a, { type: 'createEnergy', cardUid: a.players[0].hand[0].uid });
    expect(a.outcome).toEqual({ kind: 'truncated', reason: 'action-limit' });
  });
});

describe('Zdolności jednostek', () => {
  test('Geriatrix ma 3/1 i ginie na końcu tury nawet bez wykonania ataku', () => {
    const s = scenario();
    const a = unit(s, 0, 'geriatrix');
    expect(getStats(s, 0, a)).toEqual({ attack: 3, health: 1, maxHealth: 1 });
    expect(s.players[0].board).toContain(a);
    end(s);
    expect(s.players[0].board).not.toContain(a);
    expect(s.players[0].discard.some(c => c.uid === a.uid)).toBe(true);
  });
  test('Geriatrix atakuje bezpośrednio, przeżywa atak i ginie dopiero po zakończeniu tury', () => {
    const s = scenario();
    const a = unit(s, 0, 'geriatrix');
    hit(s, a, playerTarget(1));
    expect(s.players[1].hp).toBe(9);
    expect(s.players[0].board).toContain(a);
    end(s);
    expect(s.players[0].board).not.toContain(a);
  });
  test('Geriatrix pozostaje na polu po ataku karty bez obrażeń zwrotnych', () => {
    const s = scenario();
    const a = unit(s, 0, 'geriatrix');
    hit(s, a, unit(s, 1, 'palisada'));
    expect(s.players.map(p => p.board.length)).toEqual([1, 0]);
    end(s);
    expect(s.players.map(p => p.board.length)).toEqual([0, 0]);
  });
  test('Geriatrix może zginąć wcześniej od obrażeń, a wyłączenie zdolności zapobiega śmierci na końcu tury', () => {
    const s = scenario();
    const a = unit(s, 0, 'geriatrix');
    hit(s, a, unit(s, 1, 'dzik'));
    expect(s.players[0].board).not.toContain(a);

    const withoutAbility = scenario();
    withoutAbility.catalogs[0].geriatrix.abilityEnabled = false;
    const survivor = unit(withoutAbility, 0, 'geriatrix');
    end(withoutAbility);
    expect(withoutAbility.players[0].board).toContain(survivor);
  });
  test('Asterix uderza tego samego przeciwnika dwa razy, ignoruje tylko pierwszą kontrę', () => {
    const s = scenario();
    const a = unit(s, 0, 'asterix');
    hit(s, a, unit(s, 1, 'automatix'));
    expect(s.players[1].board).toHaveLength(0);
    expect(getStats(s, 0, a).health).toBe(2);
    expect(s.metrics[0].asterix.damagePrevented).toBe(1);
    expect(s.metrics[0].asterix.unitDamage).toBe(5);
  });
  test('drugi cios Asterixa może zabić jednocześnie jego i Obelixa', () => {
    const s = scenario();
    hit(s, unit(s, 0, 'asterix'), unit(s, 1, 'obelix'));
    expect(s.players.map(p => p.board.length)).toEqual([0, 0]);
  });
  test('Asterix nie przenosi drugiego ciosu na gracza ani inną kartę', () => {
    const s = scenario();
    const a = unit(s, 0, 'asterix');
    hit(s, a, unit(s, 1, 'dzik'));
    expect(s.players[1].hp).toBe(12);
    expect(getStats(s, 0, a).health).toBe(3);
    end(s); end(s);
    hit(s, a, playerTarget(1));
    expect(s.players[1].hp).toBe(9);
  });
  test('Panoramix wzmacnia inną jednostkę i nie można go atakować przed nią', () => {
    const s = scenario();
    const target = unit(s, 0, 'automatix');
    const p = play(s, 'panoramix', target.uid)!;
    const enemy = unit(s, 1, 'obelix');
    expect(getStats(s, 0, target)).toEqual({ attack: 1, health: 7, maxHealth: 7 });
    end(s);
    expect(() => hit(s, enemy, p)).toThrow();
    target.damage = 7;
    sweepDeaths(s);
    expect(getLegalActions(s)).toContainEqual({ type: 'attack', attackerUid: enemy.uid, targetUid: p.uid });
  });
  test('Panoramix bez innej jednostki jest zwykłą, możliwą do zaatakowania kartą', () => {
    const s = scenario();
    const p = play(s, 'panoramix')!;
    const enemy = unit(s, 1, 'obelix');
    end(s);
    expect(getLegalActions(s)).toContainEqual({ type: 'attack', attackerUid: enemy.uid, targetUid: p.uid });
  });
  test('zdolność Asparanoixa może dosięgnąć chronionego Panoramixa', () => {
    const s = scenario();
    const target = unit(s, 0, 'automatix');
    const p = play(s, 'panoramix', target.uid)!;
    end(s);
    play(s, 'asparanoix', p.uid, 'health');
    expect(getStats(s, 0, p)).toEqual({ attack: 1, health: 1, maxHealth: 1 });
    expect(p.protectedBy).toBe(target.uid);
  });
  test('utrata źródła wzmocnienia może spowodować kolejną śmierć', () => {
    const s = scenario();
    const target = unit(s, 0, 'dzik');
    const p = play(s, 'panoramix', target.uid)!;
    target.damage = 2;
    p.damage = 3;
    sweepDeaths(s);
    expect(s.players[0].board).toHaveLength(0);
  });
  test.each(['both', 'attack', 'health'] as const)('Asparanoix: %s, osłabienie znika po jego śmierci', debuff => {
    const s = scenario();
    const target = unit(s, 1, 'obelix');
    const a = play(s, 'asparanoix', target.uid, debuff)!;
    const expected = debuff === 'both' ? [4, 4] : debuff === 'attack' ? [3, 5] : [5, 3];
    expect([getStats(s, 1, target).attack, getStats(s, 1, target).health]).toEqual(expected);
    a.damage = 4;
    sweepDeaths(s);
    expect([getStats(s, 1, target).attack, getStats(s, 1, target).health]).toEqual([5, 5]);
  });
  test('Asparanoix może zabić przez obniżenie maksymalnego życia', () => {
    const s = scenario();
    const target = unit(s, 1, 'dzik');
    play(s, 'asparanoix', target.uid, 'health');
    expect(s.players[1].board).toHaveLength(0);
  });
  test('Ahigienix rani na początku tury rywala tylko jednostki, nie budowle ani gracza', () => {
    const s = scenario();
    unit(s, 0, 'ahigienix');
    const boar = unit(s, 1, 'dzik');
    const wall = unit(s, 1, 'palisada');
    expect(boar.damage).toBe(0);
    end(s);
    expect(s.players[1].board).toEqual([wall]);
    expect(s.players[1].hp).toBe(12);
  });
  test.each([true, false])('trucizna — konfiguracja sumowania %s', poisonStacks => {
    const s = scenario();
    s.rules.poisonStacks = poisonStacks;
    for (let i = 0; i < 3; i++) unit(s, 0, 'ahigienix');
    const target = unit(s, 1, 'automatix');
    end(s);
    expect(getStats(s, 1, target).health).toBe(poisonStacks ? 2 : 4);
  });
  test('trucizna znika po śmierci Ahigienixa', () => {
    const s = scenario();
    const source = unit(s, 0, 'ahigienix');
    const target = unit(s, 1, 'automatix');
    source.damage = 4;
    sweepDeaths(s); end(s);
    expect(target.damage).toBe(0);
  });
  test('Kakofonix kosztuje 3, blokuje istniejące jednostki do kolejnej tury właściciela', () => {
    const s = scenario();
    const target = unit(s, 1, 'obelix');
    play(s, 'kakofonix');
    expect(s.players[0].energy).toBe(7);
    end(s);
    expect(getLegalActions(s).some(a => a.type === 'attack')).toBe(false);
    const fresh = play(s, 'dzik')!;
    expect(getLegalActions(s).some(a => a.type === 'attack' && a.attackerUid === fresh.uid)).toBe(true);
    end(s);
    expect(target.stuns).toHaveLength(0);
  });
  test('zablokowana jednostka nie oddaje obrażeń, ale jej trucizna nadal działa', () => {
    const s = scenario();
    const target = unit(s, 1, 'ahigienix');
    play(s, 'kakofonix');
    const a = unit(s, 0, 'automatix');
    hit(s, a, target);
    expect(a.damage).toBe(0);
    end(s); end(s);
    expect(a.damage).toBe(1);
  });
  test('stunRetaliation false pozwala badać wariant z obrażeniami zwrotnymi', () => {
    const s = scenario();
    s.rules.stunRetaliation = false;
    const target = unit(s, 1, 'ahigienix');
    play(s, 'kakofonix');
    const a = unit(s, 0, 'automatix');
    hit(s, a, target);
    expect(a.damage).toBe(1);
  });
  test('Falballa: dwóch mężczyzn zużywa wspólną pulę +2 HP, kobieta omija tę pulę', () => {
    const s = scenario();
    const f = unit(s, 0, 'falballa');
    const first = unit(s, 1, 'automatix');
    const second = unit(s, 1, 'automatix');
    const female = unit(s, 1, 'falballa');
    end(s);
    hit(s, first, f);
    expect(f.damage).toBe(0);
    expect(f.maleDefenseDamage).toBe(1);
    expect(getStats(s, 0, f).health).toBe(2);
    hit(s, second, f);
    expect(f.damage).toBe(0);
    expect(f.maleDefenseDamage).toBe(2);
    expect(getStats(s, 0, f).health).toBe(2);
    hit(s, female, f);
    expect(s.players[0].board).not.toContain(f);
  });
  test('Dobromina atakująca Asparanoixa ma automatycznie +4 ataku, nie +6', () => {
    const s = scenario();
    const d = unit(s, 0, 'dobromina');
    const husband = unit(s, 1, 'asparanoix');
    husband.modifiers.push({ origin: 'tarcza', attack: 0, health: 2 });
    hit(s, d, husband);
    expect(getStats(s, 1, husband).health).toBe(1);
    expect(getStats(s, 0, d).health).toBe(1);
  });
  test('Falballa atakująca mężczyznę nie dostaje premii obronnej na kontrę', () => {
    const s = scenario();
    const f = unit(s, 0, 'falballa');
    hit(s, f, unit(s, 1, 'automatix'));
    expect(f.damage).toBe(1);
    expect(f.maleDefenseDamage).toBe(0);
  });
  test('warunkowa premia pozwala zaatakować mężczyznę mimo wyzerowanego ataku bazowego', () => {
    const s = scenario();
    const f = unit(s, 0, 'falballa');
    f.modifiers.push({ origin: 'asparanoix', attack: -2, health: 0 });
    const d = unit(s, 1, 'automatix');
    hit(s, f, d);
    expect(d.damage).toBe(2);
  });
});

describe('Wzmocnienia i czary', () => {
  test('Kociołki sumują aury tylko dla własnych jednostek, nie dla budowli', () => {
    const s = scenario();
    const a = unit(s, 0, 'obelix');
    const enemy = unit(s, 1, 'obelix');
    const k1 = unit(s, 0, 'kociolek');
    unit(s, 0, 'kociolek');
    expect(getStats(s, 0, a)).toEqual({ attack: 7, health: 7, maxHealth: 7 });
    expect(getStats(s, 0, k1).health).toBe(3);
    expect(getStats(s, 1, enemy).attack).toBe(5);
    k1.damage = 3;
    sweepDeaths(s);
    expect(getStats(s, 0, a).health).toBe(6);
  });
  test.each([['miecz', 7, 5], ['sierp', 6, 5], ['tarcza', 5, 6]] as const)('%s jest stałym wzmocnieniem', (id, attack, health) => {
    const s = scenario();
    const u = unit(s, 0, 'obelix');
    play(s, id, u.uid);
    end(s); end(s);
    expect(getStats(s, 0, u)).toEqual({ attack, health, maxHealth: health });
  });
  test('napój +3/+3 trwa przez odpowiedź przeciwnika; kac wchodzi na początku następnej własnej tury', () => {
    const s = scenario();
    const a = unit(s, 0, 'obelix');
    play(s, 'magiczny_napoj', a.uid);
    expect(getStats(s, 0, a).attack).toBe(8);
    end(s);
    expect(getStats(s, 0, a)).toEqual({ attack: 8, health: 8, maxHealth: 8 });
    end(s);
    expect(getStats(s, 0, a)).toEqual({ attack: 4, health: 4, maxHealth: 4 });
    end(s); end(s);
    expect(getStats(s, 0, a).attack).toBe(4);
  });
  test('premia życia z napoju działa w walce podczas odpowiedzi przeciwnika', () => {
    const s = scenario();
    const protectedUnit = unit(s, 0, 'obelix');
    play(s, 'magiczny_napoj', protectedUnit.uid);
    end(s);
    const enemy = unit(s, 1, 'dzik');
    hit(s, enemy, protectedUnit);
    expect(getStats(s, 0, protectedUnit)).toMatchObject({ attack: 8, health: 6, maxHealth: 8 });
    end(s);
    expect(getStats(s, 0, protectedUnit)).toMatchObject({ attack: 4, health: 2, maxHealth: 4 });
  });
  test('dwa napoje oznaczają dwa kace na początku kolejnej własnej tury; spadek życia może zabić', () => {
    const s = scenario();
    const a = unit(s, 0, 'dzik');
    play(s, 'magiczny_napoj', a.uid);
    play(s, 'magiczny_napoj', a.uid);
    expect(getStats(s, 0, a).maxHealth).toBe(7);
    end(s);
    expect(getStats(s, 0, a).maxHealth).toBe(7);
    end(s);
    expect(s.players[0].board).toHaveLength(0);
  });
  test('Spadające niebo usuwa wzmocnienia obu stron i aury, zachowuje osłabienia i przyszły kac', () => {
    const s = scenario();
    const own = unit(s, 0, 'obelix');
    const enemy = unit(s, 1, 'obelix');
    enemy.modifiers.push({ origin: 'miecz', attack: 2, health: 0 }, { origin: 'asparanoix', attack: -1, health: -1 });
    const k = unit(s, 0, 'kociolek');
    play(s, 'magiczny_napoj', own.uid);
    play(s, 'spadajace_niebo');
    expect(k.auraActive).toBe(false);
    expect(getStats(s, 0, own).attack).toBe(5);
    expect(getStats(s, 1, enemy).attack).toBe(4);
    end(s);
    expect(getStats(s, 0, own).attack).toBe(5);
    end(s);
    expect(getStats(s, 0, own).attack).toBe(4);
  });
  test('Spadające niebo usuwa też ochronę powiązaną z premią Panoramixa', () => {
    const s = scenario();
    const target = unit(s, 0, 'automatix');
    const p = play(s, 'panoramix', target.uid)!;
    play(s, 'spadajace_niebo');
    expect(p.protectedBy).toBeUndefined();
    expect(getStats(s, 0, target).health).toBe(5);
  });
  test('Pieczony dzik leczy tylko brakujące życie gracza lub jednostki', () => {
    const s = scenario();
    s.players[0].hp = 11;
    play(s, 'pieczony_dzik', playerTarget(0));
    expect(s.players[0].hp).toBe(12);
    const u = unit(s, 0, 'obelix');
    u.damage = 3;
    play(s, 'pieczony_dzik', u.uid);
    expect(getStats(s, 0, u).health).toBe(4);
    expect(s.metrics[0].pieczony_dzik.healing).toBe(3);
  });
  test('brak legalnego celu uniemożliwia zagranie ekwipunku i leczenia', () => {
    const s = scenario();
    const sword = hand(s, 0, 'miecz');
    const roast = hand(s, 0, 'pieczony_dzik');
    const plays = getLegalActions(s).filter(a => a.type === 'playCard');
    expect(plays).not.toContainEqual({ type: 'playCard', cardUid: sword.uid });
    expect(plays).not.toContainEqual({ type: 'playCard', cardUid: roast.uid });
  });
  test('wyłączona zdolność pozostawia statystyki jednostki bez efektu', () => {
    const s = scenario();
    s.catalogs[0] = createCatalog({ ahigienix: { abilityEnabled: false } });
    unit(s, 0, 'ahigienix');
    const target = unit(s, 1, 'dzik');
    end(s);
    expect(target.damage).toBe(0);
  });
});

test('obserwacja nie ujawnia ręki rywala, kolejności talii, seeda ani prywatnych metryk; nie modyfikuje silnika', () => {
  const s = createGame({ trace: true });
  const o = observe(s);
  expect(o.opponent).not.toHaveProperty('hand');
  expect(o.opponent).not.toHaveProperty('deck');
  expect(o.self).not.toHaveProperty('deck');
  for (const key of ['seed', 'events', 'metrics']) expect(o).not.toHaveProperty(key);
  o.self.hand.length = 0;
  o.catalogs[0].obelix.attack = 900;
  expect(s.players[0].hand).toHaveLength(6);
  expect(s.catalogs[0].obelix.attack).toBe(5);
});
