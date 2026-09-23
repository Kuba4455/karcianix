import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { OnlineRooms } from './online-rooms.ts';
import { PlayError } from './play-session.ts';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

export function createPlayServer() {
  const rooms = new OnlineRooms();
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    try {
      const path = req.url ?? '/';
      if (req.method === 'GET' && assets.has(path)) {
        const [file, type] = assets.get(path)!;
        const content = await readFile(new URL(`../web/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': type }); res.end(content); return;
      }
      const authorization = req.headers.authorization;
      const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
      if (req.method === 'GET' && path === '/api/view') { json(200, rooms.view(token)); return; }
      if (req.method !== 'POST' || !['/api/create', '/api/join', '/api/action', '/api/cancel'].includes(path)) throw new PlayError('Nie znaleziono.', 404);
      // Origin uses the public scheme, including when TLS is terminated by a reverse proxy.
      if (!req.headers.host || ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(req.headers.origin ?? '') ||
        req.headers['content-type']?.split(';')[0] !== 'application/json') {
        throw new PlayError('Żądanie musi pochodzić ze strony gry.', 403);
      }
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 4096) throw new PlayError('Zbyt duże żądanie.', 413);
      }
      let input: Record<string, unknown>;
      try { input = JSON.parse(body); } catch { throw new PlayError('Nieprawidłowe dane.'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PlayError('Nieprawidłowe dane.');
      const result = path === '/api/create' ? rooms.create(input.deck) :
        path === '/api/join' ? rooms.join(input.code, input.deck) :
        path === '/api/cancel' ? rooms.cancel(token) : rooms.act(token, input.id, input.revision);
      json(200, result);
    } catch (error) {
      json(error instanceof PlayError ? error.status : 500, { error: error instanceof PlayError ? error.message : 'Błąd serwera gry.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT musi być liczbą 1–65535.');
  const host = process.env.HOST ?? '127.0.0.1';
  const server = createPlayServer();
  server.on('error', error => { console.error(`Nie można uruchomić gry: ${error.message}`); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Karcianix — gra online: http://${host}:${port}\nZatrzymaj serwer: Ctrl+C.`));
}
