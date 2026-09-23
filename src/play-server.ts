import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { PlayError, PlaySession } from './play-session.ts';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

export function createPlayServer() {
  const session = new PlaySession();
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    try {
      const address = res.socket?.localPort;
      const hosts = [`127.0.0.1:${address}`, `localhost:${address}`];
      if (!hosts.includes(req.headers.host ?? '')) throw new PlayError('Użyj lokalnego adresu serwera.', 403);
      const path = req.url ?? '/';
      if (req.method === 'GET' && assets.has(path)) {
        const [file, type] = assets.get(path)!;
        const content = await readFile(new URL(`../web/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': type }); res.end(content); return;
      }
      if (req.method === 'GET' && path === '/api/view') { json(200, session.view()); return; }
      if (req.method !== 'POST' || !['/api/new', '/api/reveal', '/api/action'].includes(path)) throw new PlayError('Nie znaleziono.', 404);
      if (req.headers.origin !== `http://${req.headers.host}` || req.headers['content-type']?.split(';')[0] !== 'application/json') {
        throw new PlayError('Ruchy są przyjmowane tylko z lokalnej strony gry.', 403);
      }
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 4096) throw new PlayError('Zbyt duże żądanie.', 413);
      }
      let input;
      try { input = JSON.parse(body); } catch { throw new PlayError('Nieprawidłowe dane.'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PlayError('Nieprawidłowe dane.');
      const view = path === '/api/new' ? session.start(input) : path === '/api/reveal' ? session.reveal(input.revision) : session.act(input.id, input.revision);
      json(200, view);
    } catch (error) {
      json(error instanceof PlayError ? error.status : 500, { error: error instanceof PlayError ? error.message : 'Błąd serwera gry.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT musi być liczbą 1–65535.');
  const server = createPlayServer();
  server.on('error', error => { console.error(`Nie można uruchomić gry: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Karcianix — gra dla dwóch osób na jednym urządzeniu: http://127.0.0.1:${port}\nZatrzymaj serwer: Ctrl+C.`));
}
