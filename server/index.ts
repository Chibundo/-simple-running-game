import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { RACE } from '../shared/config';
import { Rooms, type Peer, type Settings } from './rooms';
function setting(name: string, fallback: number, min: number, max: number) {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return value;
}
export function createGameServer(options: { settings?: Partial<Settings>; dist?: string } = {}) {
  const rooms = new Rooms(options.settings);
  const root = options.dist ?? fileURLToPath(new URL('../dist', import.meta.url));
  const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true })); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!target.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403); res.end(); return; }
      const info = await stat(target);
      if (!info.isFile()) throw new Error('Not a file');
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(target));
    } catch { res.writeHead(404); res.end('Not found. Run npm run build to prepare the client.'); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: RACE.maxPayload });
  const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(x => x.trim()).filter(Boolean);
  server.on('upgrade', (req, socket, head) => {
    let acceptable = req.url === '/ws' && wss.clients.size < RACE.maxConnections;
    if (req.headers.origin) {
      try { acceptable &&= allowed.length ? allowed.includes(req.headers.origin) : new URL(req.headers.origin).hostname === new URL('http://' + req.headers.host).hostname; }
      catch { acceptable = false; }
    }
    if (!acceptable) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  wss.on('connection', ws => {
    const peer: Peer = { send: message => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 256 * 1024) ws.send(JSON.stringify(message)); }, close: () => ws.close() };
    let windowAt = Date.now(), count = 0, alive = true;
    const heartbeat = setInterval(() => { if (!alive) { ws.terminate(); return; } alive = false; ws.ping(); }, 5000);
    ws.on('pong', () => alive = true);
    ws.on('message', (data, binary) => {
      if (Date.now() - windowAt >= 1000) { windowAt = Date.now(); count = 0; }
      if (++count > RACE.messagesPerSecond) { peer.send({ type: 'error', message: 'Too many messages. Please reconnect.' }); ws.close(1008, 'Rate limit'); return; }
      try { if (binary) throw new Error(); rooms.receive(peer, JSON.parse(data.toString())); }
      catch { peer.send({ type: 'error', message: 'Invalid JSON message.' }); }
    });
    ws.on('error', () => {});
    ws.on('close', () => { clearInterval(heartbeat); rooms.disconnect(peer); });
  });
  const timer = setInterval(() => { rooms.tick(); rooms.broadcastAll(); }, RACE.tickMs);
  return { server, rooms, close: async () => { clearInterval(timer); for (const ws of wss.clients) ws.terminate(); await new Promise<void>(resolve => wss.close(() => resolve())); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const game = createGameServer({ settings: {
    durationMs: setting('RACE_DURATION_MS', RACE.durationMs, 100, 300000),
    countdownMs: setting('RACE_COUNTDOWN_MS', RACE.countdownMs, 100, 10000),
    reconnectGraceMs: setting('RACE_RECONNECT_GRACE_MS', RACE.reconnectGraceMs, 100, 120000),
  } });
  const port = setting('PORT', 3001, 1, 65535);
  game.server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(`Game and race server listening on port ${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { void game.close().then(() => process.exit(0)); });
}
