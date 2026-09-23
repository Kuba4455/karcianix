import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test, expect } from 'vitest';

class Node {
  children: Node[] = [];
  listeners: Record<string, () => void> = {};
  textContent = '';
  disabled = false;
  checked = false;
  hidden = false;
  className = '';
  type = '';
  tag: string;
  constructor(tag: string) { this.tag = tag; }
  append(...nodes: Node[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; }
  addEventListener(name: string, callback: () => void) { this.listeners[name] = callback; }
  setAttribute() {}
  querySelectorAll(selector: string) {
    const tags = selector.split(',').map(tag => tag.trim());
    return this.descendants().filter(node => tags.includes(node.tag));
  }
  descendants(): Node[] { return this.children.flatMap(node => [node, ...node.descendants()]); }
}

test('przycisk wymiany wysyła wybór kart nawet podczas odświeżania widoku', async () => {
  const app = new Node('main');
  const error = new Node('p');
  const card = { uid: 'p0:gesi:0', cardId: 'gesi' };
  const view = { phase: 'playing', mulligan: true, roomCode: 'ABCDEF123456', revision: 2, actions: [{ id: 0, action: { type: 'mulligan', cardUids: [] } }],
    observation: { player: 0, self: { hand: [card] }, catalogs: [{ gesi: { name: 'Gęsi', cost: 1, text: '' } }] } };
  let poll: (() => void) | undefined;
  let finishPoll: ((result: unknown) => void) | undefined;
  const posted: unknown[] = [];
  let gets = 0;
  const fetch = (path: string, options?: { body?: string }) => {
    if (path === '/api/view') {
      if (gets++ === 0) return Promise.resolve({ ok: true, status: 200, json: async () => view });
      return new Promise(resolve => { finishPoll = resolve; });
    }
    posted.push(JSON.parse(options!.body!));
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...view, revision: 3 }) });
  };
  runInNewContext(readFileSync(new URL('../web/app.js', import.meta.url), 'utf8'), {
    document: { querySelector: (selector: string) => selector === '#app' ? app : error,
      createElement: (tag: string) => new Node(tag), createTextNode: (text: string) => Object.assign(new Node('text'), { textContent: text }) },
    localStorage: { getItem: () => 'seat-token', setItem() {}, removeItem() {} },
    fetch, setInterval: (callback: () => void) => { poll = callback; },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  const checkbox = app.descendants().find(node => node.tag === 'input')!;
  const confirm = app.descendants().find(node => node.tag === 'button' && node.textContent.startsWith('Zatwierdź'))!;
  checkbox.checked = true;
  checkbox.listeners.change();
  poll!();
  expect(checkbox.disabled).toBe(false);
  expect(confirm.disabled).toBe(false);
  confirm.listeners.click();
  expect(posted).toEqual([{ id: 0, revision: 2, cardUids: [card.uid] }]);
  finishPoll!({ ok: true, status: 200, json: async () => view });
});
