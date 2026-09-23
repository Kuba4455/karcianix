import { randomInt } from 'node:crypto';
import { DECKS } from './cards.ts';
import { applyAction, createGame, getLegalActions, getStats, observe, other, playerTarget, protectedUnit } from './engine.ts';
import type { Action, DeckId, GameState, PlayerId } from './types.ts';

export class PlayError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

/** One local hotseat match. Hidden state never leaves the engine. */
export class PlaySession {
  private game: GameState | null = null;
  private revision = 0;
  private covered = true;
  private log: string[] = [];

  view() {
    const s = this.game;
    const common = { revision: this.revision, decks: s?.decks ?? null };
    if (!s) return { ...common, phase: 'setup' as const };
    if (s.outcome) return { ...common, phase: 'finished' as const, outcome: s.outcome,
      hp: s.players.map(p => p.hp), log: [...this.log] };
    if (this.covered) return { ...common, phase: 'handoff' as const, player: s.currentPlayer, turn: s.turn };
    return { ...common, phase: 'playing' as const, observation: observe(s), log: [...this.log],
      boardStats: Object.fromEntries(([0, 1] as const).flatMap(owner => s.players[owner].board.map(u =>
        [u.uid, { ...getStats(s, owner, u), protected: protectedUnit(s, owner, u) }]))),
      actions: getLegalActions(s).map((action, id) => ({ id, action, label: actionLabel(s, action) })) };
  }

  private checkRevision(revision: unknown) {
    if (revision !== this.revision) throw new PlayError('Widok jest nieaktualny. Odświeżono stan gry — wybierz ruch ponownie.', 409);
  }

  start(input: { decks?: unknown; firstPlayer?: unknown; revision?: unknown }) {
    this.checkRevision(input.revision);
    if (!Array.isArray(input.decks) || input.decks.length !== 2 ||
      input.decks.some(id => typeof id !== 'string' || !Object.hasOwn(DECKS, id))) throw new PlayError('Wybierz talie obu graczy.');
    if (![0, 1, 'random'].includes(input.firstPlayer as number | string)) throw new PlayError('Wybierz rozpoczynającego.');
    const first = input.firstPlayer === 'random' ? randomInt(2) as PlayerId : input.firstPlayer as PlayerId;
    this.game = createGame({ decks: input.decks as [DeckId, DeckId], firstPlayer: first, seed: randomInt(0x100000000) });
    this.covered = true;
    this.log = [`Rozpoczęto nową partię. Obaj gracze mają ${this.game.rules.startingHp} HP.`];
    this.revision++;
    return this.view();
  }

  reveal(revision: unknown) {
    this.checkRevision(revision);
    if (!this.game || this.game.outcome || !this.covered) throw new PlayError('Nie ma tury do odsłonięcia.');
    this.covered = false;
    this.revision++;
    return this.view();
  }

  act(id: unknown, revision: unknown) {
    this.checkRevision(revision);
    const s = this.game;
    if (!s || s.outcome || this.covered) throw new PlayError('Najpierw odsłoń swoją turę.');
    const actions = getLegalActions(s);
    if (!Number.isSafeInteger(id) || (id as number) < 0 || (id as number) >= actions.length) throw new PlayError('Nielegalny ruch.');
    const action = actions[id as number];
    const owner = s.currentPlayer;
    const text = `Gracz ${owner + 1}: ${actionLabel(s, action)}`;
    applyAction(s, action);
    this.log.push(text);
    this.log = this.log.slice(-30);
    if (s.currentPlayer !== owner) this.covered = true;
    this.revision++;
    return this.view();
  }
}

function actionLabel(s: GameState, action: Action): string {
  const owner = s.currentPlayer;
  const cardName = (uid: string) => {
    for (const seat of [owner, other(owner)]) {
      const p = s.players[seat];
      for (const zone of [p.board, p.hand]) {
        const index = zone.findIndex(c => c.uid === uid);
        if (index >= 0) return `${s.catalogs[seat][zone[index].cardId].name} (${index + 1})`;
      }
    }
    return 'karta';
  };
  const target = (uid: string) => uid === playerTarget(other(owner)) ? 'przeciwnik' :
    `${s.players[owner].board.some(u => u.uid === uid) ? 'własna' : 'wroga'} ${cardName(uid)}`;
  switch (action.type) {
    case 'endTurn': return 'Zakończ turę';
    case 'createEnergy': return `Zamień ${cardName(action.cardUid)} na energię (+1 maksimum i dostępnej energii)`;
    case 'attack': return `Atak: ${cardName(action.attackerUid)} → ${target(action.targetUid)}`;
    case 'sacrifice': return `${cardName(action.sourceUid)}: poświęć ${cardName(action.targetUid)} (${action.bonus === 'attack' ? '+2 ataku' : action.bonus === 'health' ? '+2 życia' : '+1/+1'})`;
    case 'hide': return `${cardName(action.sourceUid)}: schowaj ${cardName(action.targetUid)} (2 energii)`;
    case 'unhide': return `Odsłoń ${cardName(action.targetUid)} (bez kosztu)`;
    case 'playCard': {
      let label = `Zagraj ${cardName(action.cardUid)}`;
      if (action.targetUid) label += ` → ${action.targetUid === playerTarget(owner) ? 'własny gracz' : target(action.targetUid)}`;
      if (action.debuff) label += `: ${ { both: '−1/−1', attack: '−2 ataku', health: '−2 życia' }[action.debuff] }`;
      if (action.choice) label += action.choice === 'peek' ? ' — podejrzyj dwie karty' : ' — ukradnij losową kartę';
      if (action.summonCount !== undefined) label += ` — przyzwij Legionistów: ${action.summonCount}`;
      if (action.discardUid) label += ` — odrzuć ${cardName(action.discardUid)}, dobierz 2`;
      return label;
    }
  }
}
