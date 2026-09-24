import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach } from 'vitest';
const windows: JSDOM[] = [];
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });
export const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
export function webHarness(fetch: (path: string, options?: { body?: string; headers?: Record<string, string> }) => Promise<unknown>, token = 'seat-token') {
  const dom = new JSDOM(readFileSync(new URL('../web/index.html', import.meta.url), 'utf8'), { url: 'http://localhost', runScripts: 'outside-only' });
  windows.push(dom);
  const w = dom.window;
  if (token) w.localStorage.setItem('karcianix:seat', token);
  let poll: () => unknown = () => {};
  Object.assign(w, { fetch, setInterval: (callback: () => unknown) => { poll = callback; } });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.eval(readFileSync(new URL('../web/app.js', import.meta.url), 'utf8'));
  const query = <T extends Element = HTMLElement>(selector: string): T => {
    const node = w.document.querySelector<T>(selector); if (!node) throw new Error(`Missing ${selector}`); return node;
  };
  return { dom, query, poll: () => poll(), click: (selector: string) => query<HTMLButtonElement>(selector).click(),
    buttons: (selector = '#app button') => [...w.document.querySelectorAll<HTMLButtonElement>(selector)] };
}
