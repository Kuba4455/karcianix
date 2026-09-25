import { expect, test } from 'vitest';
import { OnlineRooms } from '../src/online-rooms.ts';
import { flush, webHarness } from './web-harness.ts';

test.each([0, 1])('obie wymiany przyjmowane z tej samej rewizji; pierwszy zatwierdza gracz %s', first => {
  const rooms = new OnlineRooms();
  const host = rooms.create('galowie'); const guest = rooms.join(host.view.roomCode, 'rzymianie');
  const tokens = [host.token, guest.token];
  const views = tokens.map(token => rooms.view(token));
  for (const view of views) {
    if (view.phase !== 'playing') throw new Error('Expected simultaneous setup');
    expect(view.actions.map(e => e.action.type)).toEqual(['mulligan']);
    expect(view.observation.opponent).not.toHaveProperty('hand');
    expect(view.observation.self.hand).toHaveLength(6);
  }
  const a = views[first], b = views[1 - first];
  if (a.phase !== 'playing' || b.phase !== 'playing') throw new Error('Expected setup');
  const selected = a.observation.self.hand.slice(0, 2).map(c => c.uid);
  expect(() => rooms.act(tokens[first], 0, a.revision + 1, selected)).toThrow('nieaktualny');
  expect(() => rooms.act(tokens[first], 0, a.revision, [b.observation.self.hand[0].uid])).toThrow('własnej ręki');
  expect(() => rooms.act(tokens[first], 0, a.revision, [selected[0], selected[0]])).toThrow('powtórzeń');
  expect(rooms.view(tokens[first])).toEqual(a);
  const after = rooms.act(tokens[first], 0, a.revision, selected);
  expect(after.phase).toBe('waiting-for-turn');
  expect(() => rooms.act(tokens[first], 0, a.revision, selected)).toThrow();
  const waiting = rooms.view(tokens[1 - first]);
  if (waiting.phase !== 'playing') throw new Error('Expected pending setup');
  expect(waiting.observation.self.hand).toEqual(b.observation.self.hand);
  expect(waiting.revision).toBeGreaterThan(b.revision);
  expect(waiting.log.at(-1)).toBe(`Gracz ${first + 1}: Wymiana kart na start: 2`);
  for (const uid of selected) expect(JSON.stringify(waiting.log)).not.toContain(uid);
  // In-flight confirmation from the same original revision must succeed.
  rooms.act(tokens[1 - first], 0, b.revision, b.observation.self.hand.map(c => c.uid));
  const final = tokens.map(token => rooms.view(token));
  expect(final.filter(v => v.phase === 'playing')).toHaveLength(1);
  for (const view of final) {
    if (!('observation' in view)) throw new Error('Expected board');
    expect(view.mulligan).toBe(false);
    expect(view.observation.self.hand).toHaveLength(6);
    expect(view.observation.self.discard).toHaveLength(0);
    expect(view.observation.self.energy).toBe(1);
    expect(view.log).toHaveLength(3);
  }
  expect(() => rooms.act(tokens[1 - first], 0, b.revision, [])).toThrow();
  expect(tokens.map(token => rooms.view(token))).toEqual(final);
});

test('zaznaczenia przeżywają wymianę rywala; historia widoczna podczas przygotowania i obu tur', async () => {
  const rooms = new OnlineRooms(); const host = rooms.create('galowie'); const guest = rooms.join(host.view.roomCode, 'rzymianie');
  const tokens = [host.token, guest.token];
  const submitted: { seat: number; cardUids?: string[] }[] = [];
  const clients = tokens.map((token, seat) => webHarness(async (path, options) => {
    const data = options?.body ? JSON.parse(options.body) : null;
    if (path === '/api/action') submitted.push({ seat, cardUids: data.cardUids });
    const view = path === '/api/action' ? rooms.act(token, data.id, data.revision, data.cardUids) : rooms.view(token);
    return { ok: true, status: 200, json: async () => view };
  }, token));
  await flush();
  const original = rooms.view(tokens[1]); if (original.phase !== 'playing') throw new Error('Expected setup');
  clients[1].click('input[type=checkbox]');
  clients[0].buttons().find(b => b.textContent!.startsWith('Zatwierdź'))!.click(); await flush();
  await clients[1].poll();
  expect(clients[1].query<HTMLInputElement>('input[type=checkbox]').checked).toBe(true);
  expect(clients[1].query('aside .game-log').textContent).toContain('Wymiana kart na start: 0');
  clients[1].buttons().find(b => b.textContent!.startsWith('Zatwierdź (') || b.textContent!.startsWith('Zatwierdź wymianę'))!.click(); await flush();
  expect(submitted[1]).toEqual({ seat: 1, cardUids: [original.observation.self.hand[0].uid] });
  await Promise.all(clients.map(c => c.poll()));
  const active = tokens.findIndex(token => rooms.view(token).phase === 'playing');
  expect(clients[0].query('aside .game-log').textContent).toBe(clients[1].query('aside .game-log').textContent);
  clients[active].click('.turn-bar button'); await flush(); await clients[1 - active].poll();
  for (const client of clients) expect(client.query('aside .game-log').textContent).toContain('Zakończ turę');
  expect(rooms.view(tokens[active]).phase).toBe('waiting-for-turn');
});
