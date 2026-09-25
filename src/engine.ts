import { CARD_IDS, DECKS, createCatalog } from './cards.ts';
import { deriveSeed, Rng } from './rng.ts';
import type {
  Action, CardDefinition, CardId, CardInstance, CardMetrics, Catalog, GameEvent,
  GameOptions, GameState, Metrics, Permanent, PlayerId, PlayerObservation, PlayerState,
  PublicPlayer, Rules, DeckId,
} from './types.ts';

export const DEFAULT_RULES: Readonly<Rules> = {
  startingHp: 15, startingEnergy: 1, openingHand: 6, drawPerTurn: 1, secondPlayerFirstDraw: 1, allowFirstTurnAttacks: false, maxEnergy: 7,
  maxTurns: 200, maxActionsPerTurn: 200,
  poisonStacks: true, emptyDeck: 'loss', stunRetaliation: true,
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
  return { ...card, damage: 0, maleDefenseDamage: 0, attacksUsed: 0,
    modifiers: [], auraActive: true, potions: [], stuns: [] };
}
export function validateRules(rules: Rules): void {
  for (const key of ['startingHp', 'openingHand', 'drawPerTurn', 'maxEnergy', 'maxTurns', 'maxActionsPerTurn'] as const) {
    if (!Number.isSafeInteger(rules[key]) || rules[key] < 1) throw new Error(`Nieprawidłowa zasada: ${key}`);
  }
  if (rules.openingHand > 60) throw new Error('Ręka startowa przekracza rozmiar talii');
  if (!Number.isSafeInteger(rules.startingEnergy) || rules.startingEnergy < 0 || rules.startingEnergy > rules.maxEnergy) throw new Error('Nieprawidłowa zasada: startingEnergy');
  if (!Number.isSafeInteger(rules.secondPlayerFirstDraw) || rules.secondPlayerFirstDraw < 0) throw new Error('Nieprawidłowa zasada: secondPlayerFirstDraw');
  if (!['loss', 'skip'].includes(rules.emptyDeck)) throw new Error('Nieznana zasada pustej talii');
  if (typeof rules.poisonStacks !== 'boolean' || typeof rules.stunRetaliation !== 'boolean' || typeof rules.allowFirstTurnAttacks !== 'boolean') throw new Error('Nieprawidłowa zasada logiczna');
  const allowed = Object.keys(DEFAULT_RULES);
  for (const key of Object.keys(rules)) if (!allowed.includes(key)) throw new Error(`Nieznana zasada: ${key}`);
}
function event(s: GameState, item: Omit<GameEvent, 'turn'>): void {
  s.events?.push({ turn: s.turn, ...item });
}
function makePlayer(owner: PlayerId, rules: Rules, deckSeed: number, deck: DeckId): PlayerState {
  const cards = DECKS[deck].flatMap(cardId => [0, 1, 2].map(copy => ({ cardId, owner, uid: `p${owner}:${cardId}:${copy}` })));
  return { hp: rules.startingHp, maxEnergy: rules.startingEnergy, energy: rules.startingEnergy, turnsTaken: 0,
    deck: new Rng(deckSeed).shuffle(cards), hand: [], board: [], discard: [], knownOpponentHand: [] };
}
export function createGame(options: GameOptions = {}): GameState {
  const seed = options.seed ?? 1;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) throw new Error('Seed musi być liczbą uint32');
  const first = options.firstPlayer ?? 0;
  if (first !== 0 && first !== 1) throw new Error('Nieprawidłowy gracz rozpoczynający');
  const rules = { ...DEFAULT_RULES, ...options.rules };
  validateRules(rules);
  const decks = options.deckSeeds ?? [deriveSeed(seed, 'deck:0'), deriveSeed(seed, 'deck:1')];
  const deckIds = options.decks ?? ['galowie', 'galowie'];
  if (deckIds.length !== 2 || deckIds.some(id => !Object.hasOwn(DECKS, id))) throw new Error('Nieznana talia');
  const s: GameState = {
    decks: [...deckIds], randomEffects: 0,
    seed, firstPlayer: first, currentPlayer: first, pendingMulligan: [true, true], turn: 1, actionsThisTurn: 0, rules,
    catalogs: options.catalogs ?? [createCatalog(), createCatalog()],
    players: [makePlayer(0, rules, decks[0], deckIds[0]), makePlayer(1, rules, decks[1], deckIds[1])],
    metrics: [emptyMetrics(), emptyMetrics()], outcome: null, events: options.trace ? [] : null,
  };
  draw(s, 0, rules.openingHand);
  draw(s, 1, rules.openingHand);
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
export function combatBonus(def: CardDefinition, against: CardDefinition): number {
  if (!def.abilityEnabled || against.gender !== 'male') return 0;
  if (def.id === 'falballa') return 2;
  if (def.id === 'dobromina') return against.id === 'asparanoix' ? 4 : 2;
  return 0;
}
export function protectedUnit(s: GameState, owner: PlayerId, unit: Permanent): boolean {
  if (unit.hiddenBy) return true;
  if (unit.cardId === 'cezar' && s.catalogs[owner][unit.cardId].abilityEnabled &&
    s.players[owner].board.some(u => u.uid !== unit.uid && u.cardId !== 'cezar' && s.catalogs[owner][u.cardId].kind === 'unit')) return true;
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
      discard(s, owner, u);
      event(s, { type: 'death', player: owner, cardId: u.cardId, uid: u.uid });
    }
    for (const p of s.players) p.board = p.board.filter(u => !ids.has(u.uid));
    for (const p of s.players) for (const u of p.board) {
      u.modifiers = u.modifiers.filter(m => !m.sourceUid || !ids.has(m.sourceUid));
      if (u.protectedBy && ids.has(u.protectedBy)) delete u.protectedBy;
    }
  }
  // Shelter is tied to a live Colosseum controlled by the same player.
  for (const p of s.players) for (const u of p.board) {
    if (u.hiddenBy && !p.board.some(x => x.uid === u.hiddenBy)) delete u.hiddenBy;
  }
  const deadPlayers = s.players.map(p => p.hp <= 0);
  if (deadPlayers[0] && deadPlayers[1]) s.outcome = { kind: 'draw', reason: 'simultaneous-hp' };
  else if (deadPlayers[0] || deadPlayers[1]) s.outcome = { kind: 'win', winner: deadPlayers[0] ? 1 : 0, reason: 'hp' };
}
function discard(s: GameState, controller: PlayerId, card: CardInstance): void {
  s.players[card.owner ?? controller].discard.push({ uid: card.uid, cardId: card.cardId, owner: card.owner ?? controller });
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
function combatDamage(s: GameState, sourceOwner: PlayerId, source: Permanent,
  owner: PlayerId, target: Permanent, amount: number): void {
  const before = getStats(s, owner, target).health;
  if (before <= 0 || amount <= 0) return;
  const bonus = combatBonus(s.catalogs[owner][target.cardId], s.catalogs[sourceOwner][source.cardId]);
  const bonusRemaining = Math.max(0, bonus - target.maleDefenseDamage);
  const bonusDamage = Math.min(amount, bonusRemaining);
  const baseDamage = amount - bonusDamage;
  target.maleDefenseDamage += bonusDamage;
  target.damage += baseDamage;
  const effective = bonusDamage + Math.min(before, baseDamage);
  s.metrics[sourceOwner][source.cardId].unitDamage += effective;
  if (getStats(s, owner, target).health <= 0) s.metrics[sourceOwner][source.cardId].kills++;
  event(s, { type: 'unit-damage', player: sourceOwner, cardId: source.cardId, targetUid: target.uid, amount: effective });
}
function startTurn(s: GameState): void {
  const owner = s.currentPlayer;
  const p = s.players[owner];
  p.turnsTaken++;
  p.energy = p.maxEnergy;
  s.actionsThisTurn = 0;
  for (const side of s.players) for (const u of side.board) {
    u.stuns = u.stuns.filter(e => e.sourceOwner !== owner || e.expiresAtOwnerTurn > p.turnsTaken);
  }
  for (const side of s.players) for (const u of side.board) {
    const expiring = u.potions.filter(e => e.sourceOwner === owner && e.expiresAtOwnerTurn <= p.turnsTaken);
    u.potions = u.potions.filter(e => !expiring.includes(e));
    u.modifiers = u.modifiers.filter(m => m.expiresAtOwnerTurn === undefined || m.sourceOwner !== owner || m.expiresAtOwnerTurn > p.turnsTaken);
    for (const _ of expiring) u.modifiers.push({ origin: 'magiczny_napoj', attack: -1, health: -1 });
  }
  for (const side of s.players) for (const u of side.board) {
    const expiring = u.temporaryDamage?.filter(d => d.owner === owner && d.expiresAtOwnerTurn <= p.turnsTaken) ?? [];
    u.damage = Math.max(0, u.damage - expiring.reduce((sum, d) => sum + d.amount, 0));
    if (u.temporaryDamage) u.temporaryDamage = u.temporaryDamage.filter(d => !expiring.includes(d));
  }
  sweepDeaths(s);
  if (s.outcome) return;
  for (const u of p.board) u.attacksUsed = 0;
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
  // Geriatrix stays on the field through his attack and dies only when his
  // controller finishes the turn, whether he attacked or not.
  const owner = s.currentPlayer;
  for (const u of s.players[owner].board) if (u.cardId === 'geriatrix' && s.catalogs[owner][u.cardId].abilityEnabled) {
    u.damage = Math.max(u.damage, getStats(s, owner, u).maxHealth);
  }
  sweepDeaths(s);
  // Return surviving borrowed units before the opponent's start-of-turn effects.
  for (const owner of [0, 1] as const) {
    for (const u of [...s.players[owner].board]) if (u.borrowedFrom !== undefined) {
      s.players[owner].board = s.players[owner].board.filter(x => x.uid !== u.uid);
      s.players[u.borrowedFrom].board.push(u);
      delete u.borrowedFrom;
      delete u.hiddenBy;
    }
  }
  sweepDeaths(s);
  if (s.outcome) return;
  if (s.turn >= s.rules.maxTurns) {
    s.outcome = { kind: 'truncated', reason: 'turn-limit' };
    return;
  }
  // A round ends only after both players have completed their turns.
  // Increase both caps now; refill only the player whose turn starts next.
  if (s.currentPlayer !== s.firstPlayer) {
    for (const player of s.players) player.maxEnergy = Math.min(s.rules.maxEnergy, player.maxEnergy + 1);
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
  if (['miecz', 'tarcza', 'sierp', 'magiczny_napoj', 'wieniec', 'hasta', 'tarcza_rzymska'].includes(card.cardId)) return units.map(u => ({ ...base, targetUid: u.uid }));
  if (card.cardId === 'a38') return enemy.board.filter(u => s.catalogs[other(owner)][u.cardId].kind === 'unit').map(u => ({ ...base, targetUid: u.uid }));
  if (card.cardId === 'oszczep') return enemy.board.map(u => ({ ...base, targetUid: u.uid }));
  if (card.cardId === 'kodeks') return self.hand.filter(c => c.uid !== card.uid).map(c => ({ ...base, discardUid: c.uid }));
  if (card.cardId === 'kalimatis') return [{ ...base, choice: 'peek' }, { ...base, choice: 'steal' }];
  if (card.cardId === 'antywirus') return Array.from({ length: self.hand.filter(c => c.cardId === 'legionista').length + 1 }, (_, summonCount) => ({ ...base, summonCount }));
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
  if (s.pendingMulligan[owner]) return [{ type: 'mulligan', cardUids: [] }];
  const self = s.players[owner];
  const enemyOwner = other(owner);
  const enemy = s.players[enemyOwner];
  const actions: Action[] = [];
  for (const card of self.hand) {
    actions.push(...playActions(s, card));
  }
  for (const u of self.board) {
    const def = s.catalogs[owner][u.cardId];
    if (u.hiddenBy) actions.push({ type: 'unhide', targetUid: u.uid });
    if (def.abilityEnabled && u.cardId === 'brutus') for (const target of self.board) {
      if (target.uid !== u.uid && target.attacksUsed === 0 && s.catalogs[owner][target.cardId].kind === 'unit')
        for (const bonus of ['attack', 'health', 'both'] as const) actions.push({ type: 'sacrifice', sourceUid: u.uid, targetUid: target.uid, bonus });
    }
    if (def.abilityEnabled && u.cardId === 'koloseum' && self.energy >= 2) for (const target of self.board) {
      if (target.uid !== u.uid && target.cardId !== 'koloseum' && !target.hiddenBy && s.catalogs[owner][target.cardId].kind === 'unit')
        actions.push({ type: 'hide', sourceUid: u.uid, targetUid: target.uid });
    }
    if (u.hiddenBy || (def.abilityEnabled && ['ceplus', 'lew'].includes(u.cardId) && u.enteredTurn === s.turn)) continue;
    if (u.stuns.length) continue;
    if (def.kind !== 'unit' || u.attacksUsed > 0) continue;
    if (!s.rules.allowFirstTurnAttacks && owner === s.firstPlayer && self.turnsTaken === 1) continue;
    const baseAttack = getStats(s, owner, u).attack;
    if (enemy.board.length === 0 && baseAttack > 0) actions.push({ type: 'attack', attackerUid: u.uid, targetUid: playerTarget(enemyOwner) });
    else for (const target of enemy.board) if (!protectedUnit(s, enemyOwner, target)) {
      const bonus = combatBonus(def, s.catalogs[enemyOwner][target.cardId]);
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
    summoned.enteredTurn = s.turn;
    self.board.push(summoned);
  } else discard(s, owner, card);
  event(s, { type: 'play', player: owner, cardId: card.cardId, uid: card.uid, targetUid: action.targetUid });
  if (!def.abilityEnabled) return;
  const ownTarget = self.board.find(u => u.uid === action.targetUid);
  const enemyTarget = s.players[other(owner)].board.find(u => u.uid === action.targetUid);
  switch (card.cardId) {
    case 'antywirus':
      for (let i = 0; i < (action.summonCount ?? 0); i++) {
        const index = self.hand.findIndex(c => c.cardId === 'legionista');
        const legion = self.hand.splice(index, 1)[0];
        self.board.push({ ...makePermanent(legion), enteredTurn: s.turn });
        s.metrics[owner].legionista.played++;
        event(s, { type: 'summon', player: owner, cardId: legion.cardId, uid: legion.uid });
      }
      break;
    case 'a38':
      if (enemyTarget) {
        s.players[other(owner)].board = s.players[other(owner)].board.filter(u => u.uid !== enemyTarget.uid);
        enemyTarget.borrowedFrom = other(owner);
        enemyTarget.attacksUsed = 0;
        delete enemyTarget.hiddenBy;
        delete enemyTarget.enteredTurn;
        self.board.push(enemyTarget);
      }
      break;
    case 'kalimatis': {
      const enemy = s.players[other(owner)];
      const rng = new Rng(deriveSeed(s.seed, `effect:${s.randomEffects++}`));
      if (action.choice === 'steal' && enemy.hand.length) self.hand.push(enemy.hand.splice(rng.int(enemy.hand.length), 1)[0]);
      else if (action.choice === 'peek') {
        const revealed = rng.shuffle([...enemy.hand]).slice(0, 2);
        self.knownOpponentHand = [...new Map([...self.knownOpponentHand, ...revealed].map(c => [c.uid, c])).values()];
      }
      break;
    }
    case 'kodeks': {
      const index = self.hand.findIndex(c => c.uid === action.discardUid);
      discard(s, owner, self.hand.splice(index, 1)[0]);
      draw(s, owner, 2);
      break;
    }
    case 'oszczep':
      if (enemyTarget) {
        unitDamage(s, owner, card.cardId, other(owner), enemyTarget, 2);
        (enemyTarget.temporaryDamage ??= []).push({ amount: 2, owner: other(owner), expiresAtOwnerTurn: s.players[other(owner)].turnsTaken + 1 });
      }
      break;
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
    case 'miecz': case 'tarcza': case 'sierp': case 'magiczny_napoj': case 'wieniec': case 'hasta': case 'tarcza_rzymska':
      if (ownTarget) {
        const values = { miecz: [2, 0], tarcza: [0, 1], sierp: [1, 0], magiczny_napoj: [3, 3], wieniec: [2, 0], hasta: [1, 0], tarcza_rzymska: [0, 2] };
        const [attack, health] = values[card.cardId];
        const expiry = { sourceOwner: owner, expiresAtOwnerTurn: self.turnsTaken + 1 };
        ownTarget.modifiers.push({ origin: card.cardId, attack, health,
          ...(card.cardId === 'magiczny_napoj' ? expiry : {}) });
        if (card.cardId === 'magiczny_napoj') ownTarget.potions.push(expiry);
      }
      break;
    case 'pieczony_dzik': {
      const amount = ownTarget ? Math.min(2, ownTarget.damage) : Math.min(2, s.rules.startingHp - self.hp);
      if (ownTarget) {
        ownTarget.damage -= amount;
        // Healing consumes temporary wounds first, so expiry never heals older wounds twice.
        let remaining = amount;
        for (const wound of ownTarget.temporaryDamage ?? []) {
          const healed = Math.min(wound.amount, remaining);
          wound.amount -= healed;
          remaining -= healed;
        }
      }
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
      const aAttack = getStats(s, owner, attacker).attack + combatBonus(aDef, dDef);
      const dAttack = s.rules.stunRetaliation && defender.stuns.length ? 0 : getStats(s, enemy, defender).attack;
      const aShield = hits === 2 && hit === 0 ? dAttack : 0;
      s.metrics[owner][attacker.cardId].damagePrevented += aShield;
      // Both damage amounts are computed before either death is resolved.
      combatDamage(s, owner, attacker, enemy, defender, aAttack);
      unitDamage(s, enemy, defender.cardId, owner, attacker, dAttack - aShield);
      sweepDeaths(s);
    }
  }
  sweepDeaths(s);
}
function sameAction(a: Action, b: Action): boolean {
  const keys = Object.keys(a) as (keyof Action)[];
  return keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k]);
}
/** Mutates state in place for batch performance. Illegal moves are rejected before any mutation. */
export function applyAction(s: GameState, action: Action): GameState {
  const mulligan = !s.outcome && action.type === 'mulligan' && Object.keys(action).length === 2 && s.pendingMulligan[s.currentPlayer] &&
    Array.isArray(action.cardUids) && action.cardUids.every(uid => typeof uid === 'string') &&
    new Set(action.cardUids).size === action.cardUids.length &&
    action.cardUids.every(uid => s.players[s.currentPlayer].hand.some(card => card.uid === uid));
  if (!mulligan && !getLegalActions(s).some(legal => sameAction(legal, action))) throw new Error(`Nielegalny ruch: ${JSON.stringify(action)}`);
  if (action.type !== 'mulligan') s.actionsThisTurn++;
  const owner = s.currentPlayer;
  const self = s.players[owner];
  switch (action.type) {
    case 'mulligan': {
      const rejected = new Set(action.cardUids);
      self.deck.push(...self.hand.filter(card => rejected.has(card.uid)));
      self.hand = self.hand.filter(card => !rejected.has(card.uid));
      self.deck = new Rng(deriveSeed(s.seed, `mulligan:${owner}`)).shuffle(self.deck);
      draw(s, owner, s.rules.openingHand - self.hand.length);
      s.pendingMulligan[owner] = false;
      if (!s.outcome) {
        if (s.pendingMulligan[other(owner)]) s.currentPlayer = other(owner);
        else { s.currentPlayer = s.firstPlayer; startTurn(s); }
      }
      break;
    }
    case 'playCard': play(s, action); break;
    case 'sacrifice': {
      const source = self.board.find(u => u.uid === action.sourceUid)!;
      const target = self.board.find(u => u.uid === action.targetUid)!;
      const [attack, health] = action.bonus === 'attack' ? [2, 0] : action.bonus === 'health' ? [0, 2] : [1, 1];
      source.modifiers.push({ origin: 'brutus', attack, health });
      target.damage = getStats(s, owner, target).maxHealth;
      event(s, { type: 'sacrifice', player: owner, uid: source.uid, targetUid: target.uid });
      sweepDeaths(s);
      break;
    }
    case 'hide':
      self.energy -= 2;
      self.board.find(u => u.uid === action.targetUid)!.hiddenBy = action.sourceUid;
      event(s, { type: 'hide', player: owner, uid: action.sourceUid, targetUid: action.targetUid });
      break;
    case 'unhide':
      delete self.board.find(u => u.uid === action.targetUid)!.hiddenBy;
      event(s, { type: 'unhide', player: owner, targetUid: action.targetUid });
      break;
    case 'attack': attack(s, action); break;
    case 'endTurn': endTurn(s); break;
  }
  for (const id of [0, 1] as const) s.players[id].knownOpponentHand = s.players[id].knownOpponentHand.filter(c => s.players[other(id)].hand.some(h => h.uid === c.uid));
  if (!s.outcome && action.type !== 'mulligan' && s.actionsThisTurn >= s.rules.maxActionsPerTurn) s.outcome = { kind: 'truncated', reason: 'action-limit' };
  return s;
}
export function observe(s: GameState, player: PlayerId = s.currentPlayer): PlayerObservation {
  const publicPlayer = (p: PlayerState): PublicPlayer => ({ hp: p.hp, energy: p.energy, maxEnergy: p.maxEnergy,
    handCount: p.hand.length, deckCount: p.deck.length, turnsTaken: p.turnsTaken,
    board: p.board, discard: p.discard });
  // Copy only allowed fields: no hidden cards, deck order, seed, metrics, or events.
  return structuredClone({ player, turn: s.turn, rules: s.rules, catalogs: s.catalogs,
    self: { ...publicPlayer(s.players[player]), hand: s.players[player].hand, knownOpponentHand: s.players[player].knownOpponentHand },
    opponent: publicPlayer(s.players[other(player)]),
  });
}
/** Used by fuzz tests and optional simulation checks, not by the bot. */
export function assertInvariants(s: GameState): void {
  const all = s.players.flatMap(p => [...p.deck, ...p.hand, ...p.board, ...p.discard]);
  const expected = s.decks.flatMap((deck, owner) => DECKS[deck].flatMap(id => [0, 1, 2].map(copy => `p${owner}:${id}:${copy}`)));
  if (all.length !== 120 || new Set(all.map(c => c.uid)).size !== 120 || expected.some(uid => !all.some(c => c.uid === uid))) throw new Error('Zgubiona lub zduplikowana karta');
  for (const owner of [0, 1] as const) {
    const p = s.players[owner];
    if (p.energy < 0 || p.energy > p.maxEnergy || p.maxEnergy > s.rules.maxEnergy) throw new Error('Naruszenie energii');
    if (p.hp > s.rules.startingHp) throw new Error('Naruszenie limitu HP');
    for (const u of p.board) if (getStats(s, owner, u).health <= 0 || u.damage < 0 || u.attacksUsed > 1) throw new Error('Nieprawidłowy stan jednostki');
  }
}
