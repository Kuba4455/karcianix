import { combatBonus, other, playerTarget, stats } from './engine.ts';
import type { Rng } from './rng.ts';
import type { Action, BotKind, CardDefinition, Outcome, Permanent, PlayerObservation } from './types.ts';

export interface ActionPreviewResult {
  observation: PlayerObservation;
  actions: readonly Action[];
  outcome: Outcome | null;
  sameTurn: boolean;
}
/** Simulates only the supplied public action sequence and returns another sanitized observation. */
export type ActionPreview = (sequence: readonly Action[]) => ActionPreviewResult;

const LOOKAHEAD_WIDTH = 6;
const FOLLOW_UP_WEIGHT = 0.6;

function value(def: CardDefinition, attack = def.attack, health = def.health, control = false): number {
  return attack * (control ? 1.15 : 1.5) + health * (control ? 1.05 : 0.7) + 0.8;
}
function boardValue(o: PlayerObservation, u: Permanent, own: boolean, control: boolean): number {
  const p = own ? o.self : o.opponent;
  const cat = o.catalogs[own ? o.player : other(o.player)];
  const st = stats(u, p.board, cat);
  let result = value(cat[u.cardId], st.attack, st.health, control);
  if (cat[u.cardId].abilityEnabled) {
    if (u.cardId === 'ahigienix') result += 1.4 * (own ? o.opponent.board.length : o.self.board.length);
    if (u.cardId === 'kociolek' && u.auraActive) result += p.board.filter(x => cat[x.cardId].kind === 'unit').length * 1.5;
  }
  return result;
}
function attackScore(o: PlayerObservation, action: Extract<Action, { type: 'attack' }>, control: boolean): number {
  const a = o.self.board.find(u => u.uid === action.attackerUid)!;
  const aDef = o.catalogs[o.player][a.cardId];
  const aStats = stats(a, o.self.board, o.catalogs[o.player]);
  if (action.targetUid === playerTarget(other(o.player))) {
    if (aStats.attack >= o.opponent.hp) return 10000;
    return 12 + aStats.attack * (control ? 2 : 3);
  }
  const d = o.opponent.board.find(u => u.uid === action.targetUid)!;
  const dDef = o.catalogs[other(o.player)][d.cardId];
  const dStats = stats(d, o.opponent.board, o.catalogs[other(o.player)]);
  const outgoing = Math.max(0, aStats.attack + combatBonus(aDef, dDef));
  const incoming = o.rules.stunRetaliation && d.stuns.length ? 0 : dStats.attack;
  let aHp = aStats.health;
  let dHp = dStats.health + Math.max(0, combatBonus(dDef, aDef) - d.maleDefenseDamage);
  const twice = a.cardId === 'asterix' && aDef.abilityEnabled;
  for (let i = 0; i < (twice ? 2 : 1); i++) {
    dHp -= outgoing;
    if (!(twice && i === 0)) aHp -= incoming;
    if (dHp <= 0 || aHp <= 0) break;
  }
  const killValue = dHp <= 0 ? boardValue(o, d, false, control) + 2 : 0;
  const lossValue = aHp <= 0 ? boardValue(o, a, true, control) * (control ? 1.15 : 0.8) : 0;
  const opensFace = dHp <= 0 && o.opponent.board.length === 1 ? 4 : 0;
  return killValue - lossValue + opensFace + Math.min(dStats.health, outgoing * (twice ? 2 : 1)) * 0.7
    - Math.min(aStats.health, incoming) * (control ? 0.7 : 0.35) + 0.2;
}
function handValue(o: PlayerObservation, def: CardDefinition, control: boolean): number {
  const costDelay = Math.max(0, def.cost - (o.self.maxEnergy + 1)) * 0.6;
  const duplicates = o.self.hand.filter(c => c.cardId === def.id).length - 1;
  let result = def.kind === 'unit' || def.kind === 'building' ? value(def, def.attack, def.health, control) : 3;
  if (def.abilityEnabled) {
    if (def.id === 'ahigienix') result += o.opponent.board.length * 1.4;
    if (def.id === 'kociolek') result += o.self.board.length * 1.2;
    if (def.id === 'pieczony_dzik' && o.self.hp === o.rules.startingHp && !o.self.board.some(u => u.damage > 0)) result -= 2;
    if (['miecz', 'tarcza', 'sierp', 'magiczny_napoj'].includes(def.id) && o.self.board.length === 0) result -= 1.5;
  }
  return result - costDelay - duplicates * 0.8;
}
function score(o: PlayerObservation, action: Action, control: boolean): number {
  const catalog = o.catalogs[o.player];
  const enemyCatalog = o.catalogs[other(o.player)];
  switch (action.type) {
    case 'mulligan': return 0;
    case 'endTurn': return 0;
    case 'sacrifice': {
      const target = o.self.board.find(u => u.uid === action.targetUid)!;
      const source = o.self.board.find(u => u.uid === action.sourceUid)!;
      const st = stats(source, o.self.board, catalog);
      const extraAttack = action.bonus === 'health' ? 0 : action.bonus === 'attack' ? 2 : 1;
      const extraHealth = action.bonus === 'attack' ? 0 : action.bonus === 'health' ? 2 : 1;
      const gain = value(catalog[source.cardId], st.attack + extraAttack, st.health + extraHealth, control) -
        value(catalog[source.cardId], st.attack, st.health, control);
      // A borrowed unit would leave at end of turn anyway and its death weakens the opponent.
      return gain * 1.3 + (target.borrowedFrom === undefined ? -boardValue(o, target, true, control) * 0.7 :
        boardValue(o, target, true, control) * 0.6 + 3);
    }
    case 'hide': {
      const target = o.self.board.find(u => u.uid === action.targetUid)!;
      const st = stats(target, o.self.board, catalog);
      const threatened = o.opponent.board.some(u => stats(u, o.opponent.board, enemyCatalog).attack >= st.health);
      return threatened && (target.attacksUsed > 0 || target.stuns.length > 0) ? 1.5 : -2;
    }
    case 'unhide': {
      const target = o.self.board.find(u => u.uid === action.targetUid)!;
      return target.attacksUsed === 0 && !target.stuns.length && stats(target, o.self.board, catalog).attack > 0 &&
        (o.rules.allowFirstTurnAttacks || o.turn > 1) &&
        !(catalog[target.cardId].abilityEnabled && ['lew', 'ceplus'].includes(target.cardId) && target.enteredTurn === o.turn) ? 2 : -2;
    }
    case 'attack': return attackScore(o, action, control);
    case 'createEnergy': {
      const card = o.self.hand.find(c => c.uid === action.cardUid)!;
      const nextEnergy = o.self.maxEnergy + 1;
      const canUnlock = o.self.hand.some(c => c.uid !== card.uid && catalog[c.cardId].cost === o.self.energy + 1);
      if (o.self.hand.length <= 1 && o.self.maxEnergy >= 4 && !canUnlock) return -5;
      const growth = nextEnergy <= 4 ? 14 : nextEnergy <= 6 ? 8 : o.self.hand.length >= 5 ? 5 : 0;
      return growth + (canUnlock ? 4 : 0) - handValue(o, catalog[card.cardId], control) * 0.65;
    }
    case 'playCard': {
      const card = o.self.hand.find(c => c.uid === action.cardUid)!;
      const def = catalog[card.cardId];
      const target = o.self.board.find(u => u.uid === action.targetUid);
      const enemy = o.opponent.board.find(u => u.uid === action.targetUid);
      let result = def.kind === 'unit' || def.kind === 'building' ? value(def, def.attack, def.health, control) : -0.5;
      result -= def.cost * 0.25;
      if (!def.abilityEnabled) return result;
      switch (card.cardId) {
        case 'antywirus': result += (action.summonCount ?? 0) * 3; break;
        case 'kalimatis': result += o.opponent.handCount ? (action.choice === 'steal' ? 4 : 0.7) : 0; break;
        case 'kodeks': {
          const discarded = o.self.hand.find(c => c.uid === action.discardUid)!;
          result = o.self.deckCount < 2 && o.rules.emptyDeck === 'loss' ? -100 : 5 - handValue(o, catalog[discarded.cardId], control) * 0.7;
          break;
        }
        case 'a38': if (enemy) result += stats(enemy, o.opponent.board, enemyCatalog).attack * 1.7 + 2; break;
        case 'oszczep': if (enemy) result += stats(enemy, o.opponent.board, enemyCatalog).health <= 2 ? boardValue(o, enemy, false, control) + 3 : 0.7; break;
        case 'wieniec': case 'hasta': case 'tarcza_rzymska':
          if (target) {
            const ready = !target.hiddenBy && !target.stuns.length && target.attacksUsed === 0 &&
              (o.rules.allowFirstTurnAttacks || o.turn > 1);
            result += card.cardId === 'tarcza_rzymska' ? 3 : (card.cardId === 'wieniec' ? 2.7 : 1.3) + (ready ? 3 : 0);
          }
          break;
        case 'panoramix': if (target) result += 2 + Math.min(2, stats(target, o.self.board, catalog).attack * 0.3); break;
        case 'ahigienix': result += o.opponent.board.filter(u => enemyCatalog[u.cardId].kind === 'unit').length * 1.8; break;
        case 'kociolek': result += o.self.board.filter(u => catalog[u.cardId].kind === 'unit').length * 2; break;
        case 'kakofonix': result += o.opponent.board.filter(u => !u.stuns.length).length * 0.9; break;
        case 'asparanoix':
          if (enemy) {
            const st = stats(enemy, o.opponent.board, enemyCatalog);
            const hpReduction = action.debuff === 'health' ? 2 : action.debuff === 'both' ? 1 : 0;
            const atkReduction = action.debuff === 'attack' ? 2 : action.debuff === 'both' ? 1 : 0;
            result += st.health <= hpReduction ? boardValue(o, enemy, false, control) + 3 : hpReduction + Math.min(atkReduction, st.attack);
          }
          break;
        case 'miecz': case 'sierp': case 'tarcza': case 'magiczny_napoj':
          if (target) {
            const ready = target.attacksUsed === 0 && !target.stuns.length && (o.rules.allowFirstTurnAttacks || o.turn > 1);
            result = card.cardId === 'tarcza' ? 1.6 : (card.cardId === 'miecz' ? 2.7 : card.cardId === 'sierp' ? 1.3 : ready ? 3.3 : -2);
            if (ready && card.cardId !== 'tarcza') {
              result += 3;
              const extra = card.cardId === 'miecz' ? 2 : card.cardId === 'sierp' ? 1 : 3;
              const st = stats(target, o.self.board, catalog);
              if (!o.opponent.board.length && st.attack + extra >= o.opponent.hp) result = 1000;
              if (o.opponent.board.some(u => stats(u, o.opponent.board, enemyCatalog).health <= st.attack + extra && stats(u, o.opponent.board, enemyCatalog).health > st.attack)) result += 4;
            }
            if (card.cardId === 'magiczny_napoj' && stats(target, o.self.board, catalog).health <= 1) result -= 1.5;
          }
          break;
        case 'pieczony_dzik': {
          const amount = Math.min(2, target ? target.damage : o.rules.startingHp - o.self.hp);
          result = amount * (target ? 1.4 : o.self.hp <= 6 ? 3 : 0.7);
          break;
        }
        case 'spadajace_niebo': {
          const bonuses = (board: Permanent[]) => board.reduce((n, u) => n + u.modifiers.reduce((m, x) => m + Math.max(0, x.attack) + Math.max(0, x.health), 0)
            + (u.cardId === 'kociolek' && u.auraActive ? board.length * 2 : 0), 0);
          result = o.opponent.board.filter(u => !u.stuns.length).length * 1.5 + (bonuses(o.opponent.board) - bonuses(o.self.board)) * 0.8 - 0.7;
          break;
        }
      }
      return result;
    }
  }
}
export function chooseAction(kind: BotKind, observation: PlayerObservation, actions: readonly Action[], rng: Rng,
  preview?: ActionPreview): Action {
  if (!actions.length) throw new Error('Bot nie ma legalnych akcji');
  if (!['random', 'aggressive', 'control'].includes(kind)) throw new Error(`Nieznany bot: ${kind}`);
  if (actions[0].type === 'mulligan') {
    const catalog = observation.catalogs[observation.player];
    const selected = observation.self.hand.filter(card => {
      const def = catalog[card.cardId];
      if (kind === 'random') return rng.next() < 0.35;
      const copies = observation.self.hand.filter(other => other.cardId === card.cardId);
      const duplicate = copies.findIndex(other => other.uid === card.uid) > 0;
      return def.cost >= 5 || (def.cost >= 4 && duplicate) ||
        (def.kind === 'equipment' && observation.self.hand.filter(c => catalog[c.cardId].kind === 'unit').length === 0);
    });
    return { type: 'mulligan', cardUids: selected.map(card => card.uid) };
  }
  if (kind === 'random') return actions[rng.int(actions.length)];
  const control = kind === 'control';
  const ranked = actions.map(action => ({ action, immediate: score(observation, action, control), planned: 0 }));
  for (const candidate of ranked) candidate.planned = candidate.immediate;
  if (preview) {
    const candidates = [...ranked]
      .filter(x => x.action.type !== 'endTurn')
      .sort((a, b) => b.immediate - a.immediate)
      .slice(0, LOOKAHEAD_WIDTH);
    for (const candidate of candidates) {
      const next = preview([candidate.action]);
      if (next.outcome?.kind === 'win' && next.outcome.winner === observation.player) {
        candidate.planned = 100000;
        continue;
      }
      if (!next.sameTurn) continue;
      const followUps = next.actions.filter(action => action.type !== 'endTurn');
      if (followUps.length) {
        const bestFollowUp = Math.max(...followUps.map(action => score(next.observation, action, control)));
        const baselineFollowUp = Math.max(0, ...ranked
          .filter(other => other !== candidate && other.action.type !== 'endTurn')
          .map(other => other.immediate));
        // Reward only the improvement created by the setup action. Merely preserving
        // an already-good move is not a combo and must not be counted twice.
        candidate.planned += FOLLOW_UP_WEIGHT * (bestFollowUp - baselineFollowUp);
      }
    }
  }
  let best = ranked[0];
  let bestScore = -Infinity;
  for (const candidate of ranked) {
    const tieBreak = candidate.action.type === 'endTurn' ? 0 : rng.next() * 0.01;
    if (candidate.planned + tieBreak > bestScore) { best = candidate; bestScore = candidate.planned + tieBreak; }
  }
  return best.action;
}
