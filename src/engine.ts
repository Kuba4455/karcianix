import { CARD_IDS, createCatalog } from './cards.ts';
import { deriveSeed, Rng } from './rng.ts';
import type {
  Action, CardDefinition, CardId, CardInstance, CardMetrics, Catalog, GameEvent,
  GameOptions, GameState, Metrics, Permanent, PlayerId, PlayerObservation, PlayerState,
  PublicPlayer, Rules,
} from './types.ts';

export const DEFAULT_RULES: Readonly<Rules> = {
  startingHp: 12, openingHand: 6, drawPerTurn: 1, secondPlayerFirstDraw: 1, allowFirstTurnAttacks: false, maxEnergy: 10,
  maxTurns: 200, maxActionsPerTurn: 200,
  poisonStacks: true, emptyDeck: 'loss', stunRetaliation: false,
};
export const other = (p: PlayerId): PlayerId => p === 0 ? 1 : 0;
export const playerTarget = (p: PlayerId): string => `player:${p}`;
export function emptyCardMetrics(): CardMetrics {
  return { drawn: 0, played: 0, burned: 0, playableCopyTurns: 0, handCopyTurns: 0,
    unitDamage: 0, directDamage: 0, kills: 0, healing: 0, damagePrevented: 0, stunsApplied: 0 };
}
export function emptyMetrics(): Metrics {
  return Object.fromEntries(CARD_IDS.map(id => [id, emptyCardMetrics()])) as Metrics;
}
export function makePermanent(card: CardInstance): Permanent {
  return { ...card, damage: 0, attacksUsed: 0, stance: 'defense', stanceChanged: false,
    modifiers: [], auraActive: true, potions: [], stuns: [] };
}
export function validateRules(rules: Rules): void {
  for (const key of ['startingHp', 'openingHand', 'drawPerTurn', 'maxEnergy', 'maxTurns', 'maxActionsPerTurn'] as const) {
    if (!Number.isSafeInteger(rules[key]) || rules[key] < 1) throw new Error(`Nieprawidłowa zasada: ${key}`);
  }
  if (rules.openingHand > 60) throw new Error('Ręka startowa przekracza rozmiar talii');
  if (!Number.isSafeInteger(rules.secondPlayerFirstDraw) || rules.secondPlayerFirstDraw < 0) throw new Error('Nieprawidłowa zasada: secondPlayerFirstDraw');
  if (!['loss', 'skip'].includes(rules.emptyDeck)) throw new Error('Nieznana zasada pustej talii');
  if (typeof rules.poisonStacks !== 'boolean' || typeof rules.stunRetaliation !== 'boolean' || typeof rules.allowFirstTurnAttacks !== 'boolean') throw new Error('Nieprawidłowa zasada logiczna');
  const allowed = Object.keys(DEFAULT_RULES);
  for (const key of Object.keys(rules)) if (!allowed.includes(key)) throw new Error(`Nieznana zasada: ${key}`);
}
function event(s: GameState, item: Omit<GameEvent, 'turn'>): void {
  s.events?.push({ turn: s.turn, ...item });
}
function makePlayer(owner: PlayerId, rules: Rules, deckSeed: number): PlayerState {
  const cards = CARD_IDS.flatMap(cardId => [0, 1, 2].map(copy => ({ cardId, uid: `p${owner}:${cardId}:${copy}` })));
  return { hp: rules.startingHp, maxEnergy: 0, energy: 0, energyCreated: false, turnsTaken: 0,
    deck: new Rng(deckSeed).shuffle(cards), hand: [], board: [], discard: [], energyCards: [] };
}
export function createGame(options: GameOptions = {}): GameState {
  const seed = options.seed ?? 1;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) throw new Error('Seed musi być liczbą uint32');
  const first = options.firstPlayer ?? 0;
  if (first !== 0 && first !== 1) throw new Error('Nieprawidłowy gracz rozpoczynający');
  const rules = { ...DEFAULT_RULES, ...options.rules };
  validateRules(rules);
  const decks = options.deckSeeds ?? [deriveSeed(seed, 'deck:0'), deriveSeed(seed, 'deck:1')];
  const s: GameState = {
    seed, firstPlayer: first, currentPlayer: first, turn: 1, actionsThisTurn: 0, rules,
    catalogs: options.catalogs ?? [createCatalog(), createCatalog()],
    players: [makePlayer(0, rules, decks[0]), makePlayer(1, rules, decks[1])],
    metrics: [emptyMetrics(), emptyMetrics()], outcome: null, events: options.trace ? [] : null,
  };
  draw(s, 0, rules.openingHand);
  draw(s, 1, rules.openingHand);
  startTurn(s);
  return s;
}
export function stats(unit: Permanent, board: readonly Permanent[], catalog: Catalog) {
  const def = catalog[unit.cardId];
  const aura = def.kind === 'unit' ? board.filter(x => x.cardId === 'kociolek' && x.auraActive && catalog[x.cardId].abilityEnabled).length : 0;
  const attack = Math.max(0, def.attack + aura + unit.modifiers.reduce((n, m) => n + m.attack, 0));
  const maxHealth = def.health + aura + unit.modifiers.reduce((n, m) => n + m.health, 0);
  return { attack, maxHealth, health: maxHealth - unit.damage };
}
export function getStats(s: GameState, owner: PlayerId, unit: Permanent) {
  return stats(unit, s.players[owner].board, s.catalogs[owner]);
}
export function combatBonus(def: CardDefinition, unit: Permanent, against: CardDefinition): number {
  if (!def.abilityEnabled || against.gender !== 'male') return 0;
  if (unit.cardId === 'falballa') return 2;
  if (unit.cardId === 'dobromina') return against.id === 'asparanoix' ? 4 : 2;
  return 0;
}
export function protectedUnit(s: GameState, owner: PlayerId, unit: Permanent): boolean {
  if (!unit.protectedBy || !s.catalogs[owner][unit.cardId].abilityEnabled) return false;
  return s.players[owner].board.some(x => x.uid === unit.protectedBy &&
    x.modifiers.some(m => m.sourceUid === unit.uid && m.origin === 'panoramix'));
}
export function sweepDeaths(s: GameState): void {
  for (;;) {
    const dead = s.players.flatMap((p, owner) => p.board
      .filter(u => getStats(s, owner as PlayerId, u).health <= 0)
      .map(u => ({ u, owner: owner as PlayerId })));
    if (dead.length === 0) break;
    const ids = new Set(dead.map(x => x.u.uid));
    for (const { u, owner } of dead) {
      s.players[owner].discard.push({ uid: u.uid, cardId: u.cardId });
      event(s, { type: 'death', player: owner, cardId: u.cardId, uid: u.uid });
    }
    for (const p of s.players) p.board = p.board.filter(u => !ids.has(u.uid));
    for (const p of s.players) for (const u of p.board) {
      u.modifiers = u.modifiers.filter(m => !m.sourceUid || !ids.has(m.sourceUid));
      if (u.protectedBy && ids.has(u.protectedBy)) delete u.protectedBy;
    }
  }
  const deadPlayers = s.players.map(p => p.hp <= 0);
  if (deadPlayers[0] && deadPlayers[1]) s.outcome = { kind: 'draw', reason: 'simultaneous-hp' };
  else if (deadPlayers[0] || deadPlayers[1]) s.outcome = { kind: 'win', winner: deadPlayers[0] ? 1 : 0, reason: 'hp' };
}
function draw(s: GameState, owner: PlayerId, count: number): void {
  for (let i = 0; i < count; i++) {
    const card = s.players[owner].deck.shift();
    if (!card) {
      if (s.rules.emptyDeck === 'loss') s.outcome = { kind: 'win', winner: other(owner), reason: 'empty-deck' };
      return;
    }
    s.players[owner].hand.push(card);
    s.metrics[owner][card.cardId].drawn++;
    event(s, { type: 'draw', player: owner, cardId: card.cardId, uid: card.uid });
  }
}
function unitDamage(s: GameState, sourceOwner: PlayerId, source: CardId, owner: PlayerId, target: Permanent, amount: number): void {
  const before = getStats(s, owner, target).health;
  if (before <= 0 || amount <= 0) return;
  target.damage += amount;
  const effective = Math.min(before, amount);
  s.metrics[sourceOwner][source].unitDamage += effective;
  if (getStats(s, owner, target).health <= 0) s.metrics[sourceOwner][source].kills++;
  event(s, { type: 'unit-damage', player: sourceOwner, cardId: source, targetUid: target.uid, amount: effective });
}
function startTurn(s: GameState): void {
  const owner = s.currentPlayer;
  const p = s.players[owner];
  p.turnsTaken++;
  p.energy = p.maxEnergy;
  p.energyCreated = false;
  s.actionsThisTurn = 0;
  for (const side of s.players) for (const u of side.board) {
    u.stuns = u.stuns.filter(e => e.sourceOwner !== owner || e.expiresAtOwnerTurn > p.turnsTaken);
  }
  for (const u of p.board) { u.attacksUsed = 0; u.stanceChanged = false; }
  event(s, { type: 'turn-start', player: owner });
  const enemy = other(owner);
  let poisons = s.players[enemy].board.filter(u => u.cardId === 'ahigienix' && s.catalogs[enemy][u.cardId].abilityEnabled);
  if (!s.rules.poisonStacks) poisons = poisons.slice(0, 1);
  for (const source of poisons) for (const target of p.board) {
    if (s.catalogs[owner][target.cardId].kind === 'unit') unitDamage(s, enemy, source.cardId, owner, target, 1);
  }
  sweepDeaths(s);
  if (!s.outcome) {
    if (p.turnsTaken >= 2) draw(s, owner, s.rules.drawPerTurn);
    else if (owner !== s.firstPlayer) draw(s, owner, s.rules.secondPlayerFirstDraw);
  }
}
function endTurn(s: GameState): void {
  for (const p of s.players) for (const u of p.board) {
    u.modifiers = u.modifiers.filter(m => m.expiresAtTurn !== s.turn);
    const count = u.potions.filter(m => m.expiresAtTurn === s.turn).length;
    u.potions = u.potions.filter(m => m.expiresAtTurn !== s.turn);
    for (let i = 0; i < count; i++) u.modifiers.push({ origin: 'magiczny_napoj', attack: -1, health: -1 });
  }
  sweepDeaths(s);
  if (s.outcome) return;
  if (s.turn >= s.rules.maxTurns) {
    s.outcome = { kind: 'truncated', reason: 'turn-limit' };
    return;
  }
  s.currentPlayer = other(s.currentPlayer);
  s.turn++;
  startTurn(s);
}
function playActions(s: GameState, card: CardInstance): Action[] {
  const owner = s.currentPlayer;
  const self = s.players[owner];
  const enemy = s.players[other(owner)];
  const def = s.catalogs[owner][card.cardId];
  if (def.cost > self.energy) return [];
  const base = { type: 'playCard' as const, cardUid: card.uid };
  if (!def.abilityEnabled) return [base];
  const units = self.board.filter(u => s.catalogs[owner][u.cardId].kind === 'unit');
  if (['miecz', 'tarcza', 'sierp', 'magiczny_napoj'].includes(card.cardId)) return units.map(u => ({ ...base, targetUid: u.uid }));
  if (card.cardId === 'panoramix' && units.length) return units.map(u => ({ ...base, targetUid: u.uid }));
  if (card.cardId === 'asparanoix' && enemy.board.length) return enemy.board.flatMap(u =>
    (['both', 'attack', 'health'] as const).map(debuff => ({ ...base, targetUid: u.uid, debuff })));
  if (card.cardId === 'pieczony_dzik') {
    const out: Action[] = units.filter(u => u.damage > 0).map(u => ({ ...base, targetUid: u.uid }));
    if (self.hp < s.rules.startingHp) out.push({ ...base, targetUid: playerTarget(owner) });
    return out;
  }
  return [base];
}
export function getLegalActions(s: GameState): Action[] {
  if (s.outcome) return [];
  const owner = s.currentPlayer;
  const self = s.players[owner];
  const enemyOwner = other(owner);
  const enemy = s.players[enemyOwner];
  const actions: Action[] = [];
  for (const card of self.hand) {
    if (!self.energyCreated && self.maxEnergy < s.rules.maxEnergy) actions.push({ type: 'createEnergy', cardUid: card.uid });
    actions.push(...playActions(s, card));
  }
  for (const u of self.board) {
    const def = s.catalogs[owner][u.cardId];
    if (u.stuns.length) continue;
    if (def.abilityEnabled && ['falballa', 'dobromina'].includes(u.cardId) && !u.stanceChanged) {
      actions.push({ type: 'setStance', unitUid: u.uid, stance: u.stance === 'attack' ? 'defense' : 'attack' });
    }
    if (def.kind !== 'unit' || u.attacksUsed > 0) continue;
    if (!s.rules.allowFirstTurnAttacks && self.turnsTaken === 1) continue;
    const baseAttack = getStats(s, owner, u).attack;
    if (enemy.board.length === 0 && baseAttack > 0) actions.push({ type: 'attack', attackerUid: u.uid, targetUid: playerTarget(enemyOwner) });
    else for (const target of enemy.board) if (!protectedUnit(s, enemyOwner, target)) {
      const bonus = u.stance === 'attack' ? combatBonus(def, u, s.catalogs[enemyOwner][target.cardId]) : 0;
      if (baseAttack + bonus > 0) actions.push({ type: 'attack', attackerUid: u.uid, targetUid: target.uid });
    }
  }
  actions.push({ type: 'endTurn' });
  return actions;
}
function stunEnemies(s: GameState, source: CardId): void {
  const owner = s.currentPlayer;
  for (const u of s.players[other(owner)].board) if (s.catalogs[other(owner)][u.cardId].kind === 'unit') {
    if (!u.stuns.length) s.metrics[owner][source].stunsApplied++;
    u.stuns.push({ sourceOwner: owner, expiresAtOwnerTurn: s.players[owner].turnsTaken + 1 });
  }
}
function play(s: GameState, action: Extract<Action, { type: 'playCard' }>): void {
  const owner = s.currentPlayer;
  const self = s.players[owner];
  const idx = self.hand.findIndex(c => c.uid === action.cardUid);
  const card = self.hand.splice(idx, 1)[0];
  const def = s.catalogs[owner][card.cardId];
  self.energy -= def.cost;
  s.metrics[owner][card.cardId].played++;
  let summoned: Permanent | undefined;
  if (def.kind === 'unit' || def.kind === 'building') {
    summoned = makePermanent(card);
    self.board.push(summoned);
  } else self.discard.push(card);
  event(s, { type: 'play', player: owner, cardId: card.cardId, uid: card.uid, targetUid: action.targetUid });
  if (!def.abilityEnabled) return;
  const ownTarget = self.board.find(u => u.uid === action.targetUid);
  const enemyTarget = s.players[other(owner)].board.find(u => u.uid === action.targetUid);
  switch (card.cardId) {
    case 'panoramix':
      if (ownTarget && summoned) {
        ownTarget.modifiers.push({ origin: card.cardId, attack: 0, health: 2, sourceUid: card.uid });
        summoned.protectedBy = ownTarget.uid;
      }
      break;
    case 'asparanoix':
      if (enemyTarget) {
        const [attack, health] = action.debuff === 'attack' ? [-2, 0] : action.debuff === 'health' ? [0, -2] : [-1, -1];
        enemyTarget.modifiers.push({ origin: card.cardId, attack, health, sourceUid: card.uid });
      }
      break;
    case 'miecz': case 'tarcza': case 'sierp': case 'magiczny_napoj':
      if (ownTarget) {
        const values = { miecz: [2, 0], tarcza: [0, 1], sierp: [1, 0], magiczny_napoj: [3, 3] };
        const [attack, health] = values[card.cardId];
        ownTarget.modifiers.push({ origin: card.cardId, attack, health,
          ...(card.cardId === 'magiczny_napoj' ? { expiresAtTurn: s.turn } : {}) });
        if (card.cardId === 'magiczny_napoj') ownTarget.potions.push({ expiresAtTurn: s.turn });
      }
      break;
    case 'pieczony_dzik': {
      const amount = ownTarget ? Math.min(2, ownTarget.damage) : Math.min(2, s.rules.startingHp - self.hp);
      if (ownTarget) ownTarget.damage -= amount;
      else self.hp += amount;
      s.metrics[owner][card.cardId].healing += amount;
      break;
    }
    case 'kakofonix': stunEnemies(s, card.cardId); break;
    case 'spadajace_niebo':
      stunEnemies(s, card.cardId);
      for (const p of s.players) for (const u of p.board) {
        u.modifiers = u.modifiers.filter(m => m.attack <= 0 && m.health <= 0);
        if (u.cardId === 'kociolek') u.auraActive = false;
        delete u.protectedBy;
      }
      break;
  }
  sweepDeaths(s);
}
function attack(s: GameState, action: Extract<Action, { type: 'attack' }>): void {
  const owner = s.currentPlayer;
  const enemy = other(owner);
  const attacker = s.players[owner].board.find(u => u.uid === action.attackerUid)!;
  const aDef = s.catalogs[owner][attacker.cardId];
  attacker.attacksUsed++;
  if (action.targetUid === playerTarget(enemy)) {
    const amount = Math.min(s.players[enemy].hp, getStats(s, owner, attacker).attack);
    s.players[enemy].hp -= amount;
    s.metrics[owner][attacker.cardId].directDamage += amount;
    event(s, { type: 'direct-damage', player: owner, cardId: attacker.cardId, targetUid: action.targetUid, amount });
  } else {
    const hits = attacker.cardId === 'asterix' && aDef.abilityEnabled ? 2 : 1;
    for (let hit = 0; hit < hits; hit++) {
      const defender = s.players[enemy].board.find(u => u.uid === action.targetUid);
      if (!defender || !s.players[owner].board.some(u => u.uid === attacker.uid)) break;
      const dDef = s.catalogs[enemy][defender.cardId];
      const aBonus = combatBonus(aDef, attacker, dDef);
      const dBonus = combatBonus(dDef, defender, aDef);
      const aAttack = getStats(s, owner, attacker).attack + (attacker.stance === 'attack' ? aBonus : 0);
      const dAttack = s.rules.stunRetaliation && defender.stuns.length ? 0 :
        getStats(s, enemy, defender).attack + (defender.stance === 'attack' ? dBonus : 0);
      const aShield = hits === 2 && hit === 0 ? dAttack : attacker.stance === 'defense' ? Math.min(dAttack, aBonus) : 0;
      const dShield = defender.stance === 'defense' ? Math.min(aAttack, dBonus) : 0;
      s.metrics[owner][attacker.cardId].damagePrevented += aShield;
      s.metrics[enemy][defender.cardId].damagePrevented += dShield;
      // Both damage amounts are computed before either death is resolved.
      unitDamage(s, owner, attacker.cardId, enemy, defender, aAttack - dShield);
      unitDamage(s, enemy, defender.cardId, owner, attacker, dAttack - aShield);
      sweepDeaths(s);
    }
  }
  if (attacker.cardId === 'geriatrix' && aDef.abilityEnabled && s.players[owner].board.some(u => u.uid === attacker.uid)) {
    attacker.damage = Math.max(attacker.damage, getStats(s, owner, attacker).maxHealth);
  }
  sweepDeaths(s);
}
function sameAction(a: Action, b: Action): boolean {
  const keys = Object.keys(a) as (keyof Action)[];
  return keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k]);
}
/** Mutates state in place for batch performance. Illegal moves are rejected before any mutation. */
export function applyAction(s: GameState, action: Action): GameState {
  if (!getLegalActions(s).some(legal => sameAction(legal, action))) throw new Error(`Nielegalny ruch: ${JSON.stringify(action)}`);
  s.actionsThisTurn++;
  const owner = s.currentPlayer;
  const self = s.players[owner];
  switch (action.type) {
    case 'createEnergy': {
      const idx = self.hand.findIndex(c => c.uid === action.cardUid);
      const card = self.hand.splice(idx, 1)[0];
      self.energyCards.push(card);
      self.maxEnergy++;
      self.energy++;
      self.energyCreated = true;
      s.metrics[owner][card.cardId].burned++;
      event(s, { type: 'energy', player: owner, cardId: card.cardId, uid: card.uid });
      break;
    }
    case 'playCard': play(s, action); break;
    case 'attack': attack(s, action); break;
    case 'setStance': {
      const unit = self.board.find(u => u.uid === action.unitUid)!;
      unit.stance = action.stance;
      unit.stanceChanged = true;
      break;
    }
    case 'endTurn': endTurn(s); break;
  }
  if (!s.outcome && s.actionsThisTurn >= s.rules.maxActionsPerTurn) s.outcome = { kind: 'truncated', reason: 'action-limit' };
  return s;
}
export function observe(s: GameState, player: PlayerId = s.currentPlayer): PlayerObservation {
  const publicPlayer = (p: PlayerState): PublicPlayer => ({ hp: p.hp, energy: p.energy, maxEnergy: p.maxEnergy,
    handCount: p.hand.length, deckCount: p.deck.length, turnsTaken: p.turnsTaken,
    board: p.board, discard: p.discard, energyCards: p.energyCards });
  // Copy only allowed fields: no hidden cards, deck order, seed, metrics, or events.
  return structuredClone({ player, turn: s.turn, rules: s.rules, catalogs: s.catalogs,
    self: { ...publicPlayer(s.players[player]), hand: s.players[player].hand, energyCreated: s.players[player].energyCreated },
    opponent: publicPlayer(s.players[other(player)]),
  });
}
/** Used by fuzz tests and optional simulation checks, not by the bot. */
export function assertInvariants(s: GameState): void {
  for (const owner of [0, 1] as const) {
    const p = s.players[owner];
    if (p.energy < 0 || p.energy > p.maxEnergy || p.maxEnergy > s.rules.maxEnergy || p.energyCards.length !== p.maxEnergy) throw new Error('Naruszenie energii');
    if (p.hp > s.rules.startingHp) throw new Error('Naruszenie limitu HP');
    const cards = [...p.deck, ...p.hand, ...p.board, ...p.discard, ...p.energyCards];
    if (cards.length !== 60 || new Set(cards.map(c => c.uid)).size !== 60) throw new Error('Zgubiona lub zduplikowana karta');
    for (const id of CARD_IDS) if (cards.filter(c => c.cardId === id).length !== 3) throw new Error(`Nieprawidłowa liczba kart ${id}`);
    for (const u of p.board) if (getStats(s, owner, u).health <= 0 || u.damage < 0 || u.attacksUsed > 1) throw new Error('Nieprawidłowy stan jednostki');
  }
}
