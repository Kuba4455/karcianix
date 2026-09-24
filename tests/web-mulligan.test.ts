import { test, expect } from 'vitest';
import { createGame, observe } from '../src/engine.ts';
import { flush, webHarness } from './web-harness.ts';

test('przycisk wymiany wysyła wybór kart nawet podczas odświeżania widoku', async () => {
  const game = createGame();
  const card = game.players[0].hand[0];
  const view = { phase: 'playing', mulligan: true, roomCode: 'ABCDEF123456', revision: 2, decks: game.decks,
    actions: [{ id: 0, action: { type: 'mulligan', cardUids: [] } }], observation: observe(game, 0) };
  let finishPoll: ((result: unknown) => void) | undefined;
  const posted: unknown[] = []; let gets = 0;
  const ui = webHarness((path, options) => {
    if (path === '/api/view') {
      if (gets++ === 0) return Promise.resolve({ ok: true, status: 200, json: async () => view });
      return new Promise(resolve => { finishPoll = resolve; });
    }
    posted.push(JSON.parse(options!.body!));
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...view, revision: 3 }) });
  });
  await flush();
  ui.click('input[type=checkbox]'); ui.poll();
  const checkbox = ui.query<HTMLInputElement>('input[type=checkbox]');
  const confirm = ui.buttons().find(node => node.textContent!.startsWith('Zatwierdź'))!;
  expect(checkbox.disabled).toBe(false); expect(checkbox.checked).toBe(true); expect(confirm.disabled).toBe(false);
  confirm.click();
  expect(posted).toEqual([{ id: 0, revision: 2, cardUids: [card.uid] }]);
  finishPoll!({ ok: true, status: 200, json: async () => view }); await flush();
});
