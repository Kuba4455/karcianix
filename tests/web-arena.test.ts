import { expect, test } from 'vitest';
import { applyAction, createGame, getLegalActions, getStats, makePermanent, observe, protectedUnit } from '../src/engine.ts';
import type { CardId, GameState, PlayerId } from '../src/types.ts';
import { OnlineRooms } from '../src/online-rooms.ts';
import { flush, webHarness } from './web-harness.ts';

function fixture() {
  const game = createGame({ decks: ['rzymianie', 'rzymianie'], firstPlayer: 0 });
  applyAction(game, { type: 'mulligan', cardUids: [] }); applyAction(game, { type: 'mulligan', cardUids: [] });
  game.turn = 3; game.players[0].turnsTaken = 2; game.players[0].energy = game.players[0].maxEnergy = 7;
  const put = (owner: PlayerId, cardId: CardId, zone: 'hand' | 'board') => {
    const p = game.players[owner]; const card = [...p.hand, ...p.deck].find(c => c.cardId === cardId)!;
    p.hand = p.hand.filter(c => c.uid !== card.uid); p.deck = p.deck.filter(c => c.uid !== card.uid);
    if (zone === 'board') p.board.push(makePermanent(card)); else p.hand.push(card); return card.uid;
  };
  const ally = put(0, 'legionista', 'board'), extra = put(0, 'brutus', 'board');
  game.players[0].board[0].modifiers.push({ origin: 'tarcza_rzymska', attack: 0, health: 20 });
  const enemy = put(1, 'legionista', 'board'), protectedEnemy = put(1, 'cezar', 'board');
  const spell = put(0, 'oszczep', 'hand');
  const waitingCard = put(0, 'cezar', 'hand'); game.catalogs[0].cezar.cost = 10;
  return { game, ally, extra, enemy, protectedEnemy, spell, waitingCard };
}
function snapshot(game: GameState, revision: number, player: PlayerId = 0) {
  const current = game.currentPlayer === player;
  return { phase: current ? 'playing' : 'waiting-for-turn', currentPlayer: game.currentPlayer, roomCode: 'AABBCCDDEEFF', seat: player, revision, decks: game.decks,
    mulligan: game.pendingMulligan.some(Boolean), observation: observe(game, player), log: [],
    boardStats: Object.fromEntries(([0, 1] as const).flatMap(owner => game.players[owner].board.map(c => [c.uid, { ...getStats(game, owner, c), protected: protectedUnit(game, owner, c) }]))),
    ...(current ? { actions: getLegalActions(game).map((action, id) => ({ id, action, label: `${action.type} ${'targetUid' in action ? action.targetUid : ''}` })) } : {}) };
}
function setup() {
  const f = fixture(); let revision = 10; const posted: { id: number; revision: number }[] = [];
  const ui = webHarness(async (path, options) => {
    if (path === '/api/action') {
      const payload = JSON.parse(options!.body!); posted.push(payload);
      if (payload.revision !== revision) return { ok: false, status: 409, json: async () => ({ error: 'Nieaktualny widok.' }) };
      applyAction(f.game, getLegalActions(f.game)[payload.id]); revision++;
    }
    return { ok: true, status: 200, json: async () => snapshot(f.game, revision) };
  });
  return { ...f, ui, posted, change: () => { revision++; } };
}

test('atak na karcie pokazuje tylko legalne cele; anulowanie niczego nie wysyła', async () => {
  const { ui, ally, enemy, protectedEnemy, posted } = setup(); await flush();
  expect(ui.query('.enemy .player-bar').textContent).toContain('Energia');
  expect(ui.query('.enemy .player-bar').textContent).toContain('Rzymianie');
  ui.click(`[data-attack="${ally}"]`);
  expect(ui.query(`[data-target="${enemy}"]`)).toBeTruthy();
  expect(ui.dom.window.document.querySelector(`[data-target="${protectedEnemy}"]`)).toBeNull();
  expect(ui.dom.window.document.querySelector('[data-target="player:1"]')).toBeNull();
  ui.dom.window.document.dispatchEvent(new ui.dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  expect(ui.dom.window.document.querySelector('.attack-banner')).toBeNull(); expect(posted).toHaveLength(0);
  ui.click(`[data-attack="${ally}"]`); ui.click(`[data-target="${enemy}"]`); await flush();
  expect(posted).toHaveLength(1); expect(posted[0].revision).toBe(10);
  expect(ui.query<HTMLButtonElement>(`[data-attack="${ally}"]`).disabled).toBe(true);
});

test('atak na gracza jest dostępny po opróżnieniu pola; zmiana rewizji anuluje celowanie', async () => {
  const { ui, game, ally, change } = setup(); await flush();
  game.players[1].board = []; change(); await ui.poll();
  ui.click(`[data-attack="${ally}"]`); expect(ui.query('[data-target="player:1"]')).toBeTruthy();
  change(); await ui.poll(); expect(ui.dom.window.document.querySelector('.attack-banner')).toBeNull();
  ui.click(`[data-attack="${ally}"]`); ui.click('[data-target="player:1"]'); await flush(); expect(game.players[1].hp).toBeLessThan(15);
});

test('ręka pozwala tylko zagrywać karty, bez wymiany na energię', async () => {
  const { ui, game, waitingCard, posted } = setup(); await flush();
  expect(ui.query<HTMLButtonElement>(`[data-play="${waitingCard}"]`).disabled).toBe(true);
  expect(ui.buttons('[data-energy]')).toHaveLength(0);
  expect(ui.dom.window.document.body.textContent).not.toContain('Zamień na energię');
  expect(game.players[0].hand.some(c => c.uid === waitingCard)).toBe(true);
  expect(posted).toHaveLength(0);
});

test('zagrywanie i zdolności dodatkowe zachowują wybór celu i wariantu', async () => {
  const { ui, spell, extra, posted } = setup(); await flush();
  ui.click(`[data-play="${spell}"]`); expect(ui.query<HTMLDialogElement>('#modal').open).toBe(true);
  ui.click('#modal-content .choice-list button'); await flush(); expect(posted).toHaveLength(1);
  const ability = ui.buttons(`[data-card="${extra}"] .card-actions button`).find(b => b.textContent!.includes('Poświęć'))!;
  expect(ability).toBeTruthy(); ability.click();
  expect(ui.buttons('#modal-content .choice-list button').length).toBeGreaterThan(2);
  ui.click('#modal-content .choice-list button'); await flush(); expect(posted).toHaveLength(2);
});

test('polling tej samej rewizji zachowuje wybór; nowsza rewizja zamyka wybór efektu', async () => {
  const { ui, ally, spell, change, posted } = setup(); await flush();
  ui.click(`[data-attack="${ally}"]`); await ui.poll(); expect(ui.query('.attack-banner')).toBeTruthy();
  ui.click(`[data-attack="${ally}"]`); ui.click(`[data-play="${spell}"]`);
  const staleChoice = ui.buttons('#modal-content .choice-list button')[0];
  change(); await ui.poll(); expect(ui.query<HTMLDialogElement>('#modal').open).toBe(false);
  staleChoice.click(); expect(posted).toHaveLength(0);
});

test('oczekujący gracz widzi swoją rękę i pole, ale nie ma aktywnych ruchów', async () => {
  const { ui, game, ally, change } = setup(); await flush(); game.currentPlayer = 1; change(); await ui.poll();
  expect(ui.query(`[data-card="${ally}"]`)).toBeTruthy();
  expect(ui.dom.window.document.querySelectorAll('.hand .card').length).toBe(game.players[0].hand.length);
  expect(ui.buttons('.card-actions button').every(b => b.disabled)).toBe(true);
  expect(ui.query('.turn-bar').textContent).toContain('Ruch przeciwnika');
});

test('utrata odpowiedzi nie powtarza ataku, a odświeżenie zachowuje blokady', async () => {
  const { game, ally, enemy } = fixture(); let revision = 1, posts = 0;
  const ui = webHarness(async (path, options) => {
    if (path === '/api/action') { posts++; const payload = JSON.parse(options!.body!); applyAction(game, getLegalActions(game)[payload.id]); revision++; throw new Error('Utracono połączenie'); }
    return { ok: true, status: 200, json: async () => snapshot(game, revision) };
  }); await flush(); ui.click(`[data-attack="${ally}"]`); ui.click(`[data-target="${enemy}"]`); await flush();
  expect(posts).toBe(1); expect(game.players[0].board.find(c => c.uid === ally)!.attacksUsed).toBe(1); expect(ui.query<HTMLButtonElement>(`[data-attack="${ally}"]`).disabled).toBe(true);
});

test('dwa klienty prawdziwego pokoju: mulligan, energia po rundzie, zakończenie i przejęcie tury', async () => {
  const rooms = new OnlineRooms(); const host = rooms.create('galowie'); const guest = rooms.join(host.view.roomCode, 'rzymianie');
  const tokens = [host.token, guest.token];
  const clients = tokens.map(token => webHarness(async (path, options) => {
    const data = options?.body ? JSON.parse(options.body) : null;
    const view = path === '/api/action' ? rooms.act(token, data.id, data.revision, data.cardUids) : rooms.view(token);
    return { ok: true, status: 200, json: async () => view };
  }, token));
  await flush();
  for (let i = 0; i < 2; i++) {
    const seat = tokens.findIndex(token => rooms.view(token).phase === 'playing');
    clients[seat].buttons().find(b => b.textContent!.startsWith('Zatwierdź'))!.click(); await flush();
    await Promise.all(clients.map(c => c.poll()));
  }
  const seat = tokens.findIndex(token => rooms.view(token).phase === 'playing'); const active = clients[seat], other = clients[1 - seat];
  const before = rooms.view(tokens[seat]); if (!('observation' in before)) throw new Error('No game');
  expect(active.buttons('[data-energy]')).toHaveLength(0);
  expect(before.observation.self.energy).toBe(1);
  active.click('.turn-bar button'); await flush(); await other.poll();
  expect(rooms.view(tokens[seat]).phase).toBe('waiting-for-turn');
  expect(active.buttons('.card-actions button').every(b => b.disabled)).toBe(true);
  expect(other.query('.turn-bar').textContent).toContain('Twój ruch');
  const view = rooms.view(tokens[1 - seat]); if (!('observation' in view)) throw new Error('No game');
  expect(view.observation.opponent).not.toHaveProperty('hand');
  expect(view.observation.self.energy).toBe(1);
  other.click('.turn-bar button'); await flush(); await active.poll();
  const roundTwo = rooms.view(tokens[seat]); if (!('observation' in roundTwo)) throw new Error('No game');
  expect(roundTwo.observation.self.energy).toBe(2);
  expect(roundTwo.observation.self.maxEnergy).toBe(2);
  expect(roundTwo.observation.opponent.maxEnergy).toBe(2);
});
