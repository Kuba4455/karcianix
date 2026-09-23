import { afterEach, describe, expect, test } from 'vitest';
import { createPlayServer } from '../src/play-server.ts';
import { PlaySession } from '../src/play-session.ts';
import { chooseAction } from '../src/bots.ts';
import { Rng } from '../src/rng.ts';

function beginTurns(session: PlaySession) {
  for (let i = 0; i < 2; i++) {
    const covered = session.view();
    if (covered.phase !== 'handoff') throw new Error('Oczekiwano zasłony');
    const reveal = session.reveal(covered.revision);
    if (reveal.phase !== 'playing') throw new Error('Oczekiwano wymiany');
    session.act(reveal.actions[0].id, reveal.revision, []);
  }
  const covered = session.view();
  if (covered.phase !== 'handoff') throw new Error('Oczekiwano pierwszej tury');
  return session.reveal(covered.revision);
}

describe('Gra lokalna 1 na 1', () => {
  test('zasłona nie udostępnia ręki, akcji ani historii; odsłonięcie pokazuje tylko własną rękę', () => {
    const session = new PlaySession();
    const covered = session.start({ decks: ['galowie', 'rzymianie'], firstPlayer: 0, revision: 0 });
    expect(covered).toEqual({ phase: 'handoff', player: 0, turn: 1, decks: ['galowie', 'rzymianie'], revision: 1 });
    expect(() => session.act(0, 1)).toThrow('odsłoń');
    const view = beginTurns(session);
    if (view.phase !== 'playing') throw new Error('Expected playing');
    expect(view.observation.self.hand).toHaveLength(6);
    expect(view.observation.opponent).not.toHaveProperty('hand');
    expect(view.observation.self).not.toHaveProperty('deck');
    expect(view.observation).not.toHaveProperty('seed');
    const end = view.actions.find(e => e.action.type === 'endTurn')!;
    const next = session.act(end.id, view.revision);
    expect(next.phase).toBe('handoff');
    expect(next).not.toHaveProperty('observation');
    expect(next).not.toHaveProperty('log');
    const second = session.reveal(next.revision);
    if (second.phase !== 'playing') throw new Error('Expected playing');
    expect(second.observation.player).toBe(1);
    expect(second.observation.self.hand).toHaveLength(7);
  });

  test('odrzuca podwójne kliknięcie, nielegalny indeks i błędny wybór talii', () => {
    const session = new PlaySession();
    expect(() => session.start({ decks: ['galowie', 'unknown'], firstPlayer: 0, revision: 0 })).toThrow();
    expect(() => session.start({ decks: ['galowie', 'rzymianie'], firstPlayer: 2, revision: 0 })).toThrow();
    session.start({ decks: ['rzymianie', 'rzymianie'], firstPlayer: 1, revision: 0 });
    const view = beginTurns(session);
    if (view.phase !== 'playing') throw new Error('Expected playing');
    expect(() => session.act(-1, view.revision)).toThrow('Nielegalny');
    expect(() => session.act('0', view.revision)).toThrow('Nielegalny');
    const energy = view.actions.find(e => e.action.type === 'createEnergy')!;
    session.act(energy.id, view.revision);
    expect(() => session.act(energy.id, view.revision)).toThrow('nieaktualny');
    expect(() => session.start({ decks: ['galowie', 'galowie'], firstPlayer: 0, revision: 0 })).toThrow('nieaktualny');
  });

  test.each([['galowie', 'rzymianie'], ['rzymianie', 'rzymianie']])('pełna gra przez interfejs sesji %s / %s', (a, b) => {
    const session = new PlaySession();
    let view = session.start({ decks: [a, b], firstPlayer: 0, revision: 0 });
    view = beginTurns(session);
    const rng = new Rng(51);
    let steps = 0;
    while (view.phase !== 'finished' && steps++ < 2000) {
      if (view.phase === 'handoff') { view = session.reveal(view.revision); continue; }
      if (view.phase !== 'playing') throw new Error('Unexpected phase');
      expect(view.actions.every(e => e.label.length > 0)).toBe(true);
      for (const u of [...view.observation.self.board, ...view.observation.opponent.board]) {
        expect(view.boardStats[u.uid].health).toBeGreaterThan(0);
      }
      const selected = chooseAction('control', view.observation, view.actions.map(e => e.action), rng);
      view = session.act(view.actions.find(e => e.action === selected)!.id, view.revision);
    }
    expect(view.phase).toBe('finished');
    expect(view).not.toHaveProperty('observation');
    const next = session.start({ decks: ['galowie', 'galowie'], firstPlayer: 'random', revision: view.revision });
    expect(next.phase).toBe('handoff');
  });
});

const servers: ReturnType<typeof createPlayServer>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('HTTP: dwa urządzenia, prywatne ręce, tury, osobne pokoje i ochrona przed obcą stroną', async () => {
  const server = createPlayServer(); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  const origin = `http://127.0.0.1:${address.port}`;
  const post = (path: string, data: unknown, token?: string, source = origin) => fetch(`${origin}${path}`, {
    method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data),
  });
  const get = (token?: string) => fetch(`${origin}/api/view`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  for (const path of ['/', '/app.js', '/style.css']) {
    const res = await fetch(origin + path);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect((await res.text()).length).toBeGreaterThan(100);
  }
  expect((await fetch(origin + '/src/engine.ts')).status).toBe(404);
  expect((await get()).status).toBe(401);
  expect((await post('/api/create', { deck: 'galowie' }, undefined, 'https://example.com')).status).toBe(403);
  const created = await (await post('/api/create', { deck: 'galowie' })).json();
  expect(created.view.phase).toBe('waiting-for-guest');
  expect(created.view).not.toHaveProperty('observation');
  expect(created.token).toHaveLength(64);
  expect((await post('/api/join', { code: created.view.roomCode, deck: 'rzymianie' }, undefined, 'https://example.com')).status).toBe(403);
  const guest = await (await post('/api/join', { code: created.view.roomCode, deck: 'rzymianie' })).json();
  expect(guest.token).not.toBe(created.token);
  expect((await post('/api/join', { code: created.view.roomCode, deck: 'galowie' })).status).toBe(409);
  for (let i = 0; i < 2; i++) {
    const h = await (await get(created.token)).json();
    const g = await (await get(guest.token)).json();
    const turn = h.phase === 'playing' ? { token: created.token, view: h } : { token: guest.token, view: g };
    expect(turn.view.mulligan).toBe(true);
    const chosen = turn.view.actions[0];
    expect(chosen.action.type).toBe('mulligan');
    expect((await post('/api/action', { id: chosen.id, revision: turn.view.revision, cardUids: ['wrong'] }, turn.token)).status).toBe(400);
    const selected = i === 0 ? turn.view.observation.self.hand.slice(0, 2).map((c: { uid: string }) => c.uid) : [];
    const decision = await post('/api/action', { id: chosen.id, revision: turn.view.revision, cardUids: selected }, turn.token);
    expect(decision.status).toBe(200);
    const after = await decision.json();
    expect(after.observation.self.hand).toHaveLength(6);
    if (i === 0) {
      expect(after.observation.self.discard).toHaveLength(0);
      expect(after.observation.self.handCount).toBe(6);
    }
  }
  const hostView = await (await get(created.token)).json();
  const guestView = await (await get(guest.token)).json();
  const active = hostView.phase === 'playing' ? { token: created.token, view: hostView } : { token: guest.token, view: guestView };
  const waiting = hostView.phase === 'playing' ? { token: guest.token, view: guestView } : { token: created.token, view: hostView };
  expect(active.view.observation.self.hand).toHaveLength(6);
  expect(active.view.observation.opponent).not.toHaveProperty('hand');
  expect(waiting.view.phase).toBe('waiting-for-turn');
  expect(waiting.view.observation.player).toBe(waiting.view.seat);
  expect(waiting.view.observation.self.hand).toHaveLength(6);
  expect(waiting.view.observation.opponent).not.toHaveProperty('hand');
  expect(waiting.view.boardStats).toBeDefined();
  expect(waiting.view).not.toHaveProperty('actions');
  expect(waiting.view).not.toHaveProperty('log');
  const energy = active.view.actions.find((e: { action: { type: string } }) => e.action.type === 'createEnergy');
  const waitingHand = waiting.view.observation.self.hand;
  const energyMove = await (await post('/api/action', { id: energy.id, revision: active.view.revision }, active.token)).json();
  expect(energyMove.phase).toBe('playing');
  const updatedWaiting = await (await get(waiting.token)).json();
  expect(updatedWaiting.revision).toBeGreaterThan(waiting.view.revision);
  expect(updatedWaiting.observation.self.hand).toEqual(waitingHand);
  expect(updatedWaiting.observation.opponent.handCount).toBe(5);
  expect(updatedWaiting).not.toHaveProperty('actions');
  const end = energyMove.actions.find((e: { action: { type: string } }) => e.action.type === 'endTurn');
  expect((await post('/api/action', { id: end.id, revision: energyMove.revision }, waiting.token)).status).toBe(403);
  expect((await post('/api/action', { id: end.id, revision: energyMove.revision }, undefined)).status).toBe(401);
  expect((await post('/api/action', { id: end.id, revision: energyMove.revision }, active.token, 'https://example.com')).status).toBe(403);
  const next = await (await post('/api/action', { id: end.id, revision: energyMove.revision }, active.token)).json();
  expect(next.phase).toBe('waiting-for-turn');
  expect(next.observation.self.hand).toHaveLength(5);
  const otherTurn = await (await get(waiting.token)).json();
  expect(otherTurn.phase).toBe('playing');
  expect(otherTurn.observation.self.hand).toHaveLength(7);
  expect((await post('/api/action', { id: end.id, revision: energyMove.revision }, waiting.token)).status).toBe(409);
  const secondRoom = await (await post('/api/create', { deck: 'rzymianie' })).json();
  expect(secondRoom.view.roomCode).not.toBe(created.view.roomCode);
  expect((await get(secondRoom.token)).status).toBe(200);
  expect((await post('/api/cancel', {}, secondRoom.token)).status).toBe(200);
  expect((await get(secondRoom.token)).status).toBe(401);
  expect((await post('/api/cancel', {}, created.token)).status).toBe(409);
  expect((await get('wrong-token')).status).toBe(401);
});
