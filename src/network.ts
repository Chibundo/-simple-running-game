import type { ClientMessage, RoomView, ServerMessage } from '../shared/protocol';
export type Session = { code: string; token: string; playerId: string };
const KEY = 'simple-running-game.race-session';
export class RaceConnection {
  room: RoomView | null = null;
  session: Session | null = null;
  status: 'offline' | 'connecting' | 'connected' | 'reconnecting' = 'offline';
  error = '';
  receivedAt = 0;
  private ws?: WebSocket;
  private timer?: ReturnType<typeof setTimeout>;
  private retry = 0;
  private stopped = false;
  private pending?: ClientMessage;
  constructor(private change: () => void) {
    try { const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); if (typeof s?.code === 'string' && typeof s?.token === 'string' && typeof s?.playerId === 'string') this.session = s; } catch { /* session persistence is optional */ }
  }
  connect(message?: ClientMessage) {
    this.stopped = false;
    if (message) this.pending = message;
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (this.pending) { this.ws.send(JSON.stringify(this.pending)); this.pending = undefined; }
      return;
    }
    if (this.ws?.readyState === WebSocket.CONNECTING) return;
    this.status = this.session ? 'reconnecting' : 'connecting'; this.error = ''; this.change();
    const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
    let url: URL;
    try {
      url = new URL(configured || '/ws', location.href);
      url.protocol = location.protocol === 'https:' || url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
    } catch { this.error = 'Invalid race server address. Solo play is still available.'; this.status = 'offline'; this.change(); return; }
    const ws = this.ws = new WebSocket(url);
    const timeout = setTimeout(() => { if (ws.readyState === WebSocket.CONNECTING) ws.close(); }, 8000);
    ws.onopen = () => {
      clearTimeout(timeout); this.status = 'connected'; this.retry = 0; this.error = '';
      if (this.session) ws.send(JSON.stringify({ type: 'reconnect', code: this.session.code, token: this.session.token }));
      else if (this.pending) { ws.send(JSON.stringify(this.pending)); this.pending = undefined; }
      this.change();
    };
    ws.onmessage = event => {
      let m: ServerMessage;
      try { m = JSON.parse(event.data); } catch { return; }
      if (m.type === 'session') {
        this.session = { code: m.code, token: m.token, playerId: m.playerId }; this.pending = undefined; this.error = '';
        try { sessionStorage.setItem(KEY, JSON.stringify(this.session)); } catch { /* memory only */ }
      } else if (m.type === 'state') { this.room = m.room; this.receivedAt = performance.now(); }
      else if (m.type === 'error') {
        this.error = m.message;
        if (m.fatal) { this.clearSession(); this.room = null; }
      } else if (m.type === 'left') { this.clearSession(); this.room = null; }
      this.change();
    };
    ws.onerror = () => { this.error = 'Race server unavailable. Check your connection or try again. Solo play still works.'; this.change(); };
    ws.onclose = () => {
      clearTimeout(timeout);
      if (this.ws !== ws) return;
      this.status = 'offline';
      if (!this.stopped && this.session) {
        this.status = 'reconnecting';
        this.error = 'Connection lost. Reconnecting to your runner…';
        this.timer = setTimeout(() => this.connect(), Math.min(3000, 500 * ++this.retry));
      } else if (!this.stopped && this.pending) this.error = 'Race server unavailable. Try again; solo play still works.';
      this.change();
    };
  }
  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) { this.error = ''; this.ws.send(JSON.stringify(message)); }
    else { this.error = 'You are offline. Wait for reconnection or leave the room.'; this.change(); }
  }
  leave() {
    if (this.ws?.readyState === WebSocket.OPEN) this.send({ type: 'leave' });
    this.stopped = true; clearTimeout(this.timer); this.clearSession(); this.room = null; this.pending = undefined;
    this.ws?.close(); this.status = 'offline'; this.error = ''; this.change();
  }
  private clearSession() { this.session = null; try { sessionStorage.removeItem(KEY); } catch { /* memory only */ } }
}
