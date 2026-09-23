import { afterEach, describe, expect, test } from 'vitest';
import { createPlayServer } from '../src/play-server.ts';
import { PlaySession } from '../src/play-session.ts';
import { chooseAction } from '../src/bots.ts';
import { Rng } from '../src/rng.ts';

describe('Gra lokalna 1 na 1', () => {
  test('zasłona nie udostępnia ręki, akcji ani historii; odsłonięcie pokazuje tylko własną rękę', () => {
    const session = new PlaySession();
    const covered = session.start({ decks: ['galowie', 'rzymianie'], firstPlayer: 0, revision: 0 });
    expect(covered).toEqual({ phase: 'handoff', player: 0, turn: 1, decks: ['galowie', 'rzymianie'], revision: 1 });
    expect(() => session.act(0, 1)).toThrow('odsłoń');
    const view = session.reveal(1);
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
    const view = session.reveal(1);
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

test('HTTP: strona, nowa gra, przekazanie tury i ochrona przed obcą stroną', async () => {
  const server = createPlayServer(); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  const origin = `http://127.0.0.1:${address.port}`;
  const post = (path: string, data: unknown, source = origin) => fetch(`${origin}${path}`, {
    method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  for (const path of ['/', '/app.js', '/style.css']) {
    const res = await fetch(origin + path);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect((await res.text()).length).toBeGreaterThan(100);
  }
  expect((await fetch(origin + '/src/engine.ts')).status).toBe(404);
  expect((await post('/api/new', { decks: ['galowie', 'rzymianie'], firstPlayer: 0, revision: 0 }, 'https://example.com')).status).toBe(403);
  const created = await post('/api/new', { decks: ['galowie', 'rzymianie'], firstPlayer: 0, revision: 0 });
  const covered = await created.json();
  expect(covered.phase).toBe('handoff');
  const current = await (await post('/api/reveal', { revision: covered.revision })).json();
  const end = current.actions.find((e: { action: { type: string } }) => e.action.type === 'endTurn');
  const next = await (await post('/api/action', { id: end.id, revision: current.revision })).json();
  expect(next.phase).toBe('handoff');
  expect(next.player).toBe(1);
  expect((await post('/api/action', { id: end.id, revision: current.revision })).status).toBe(409);
});
