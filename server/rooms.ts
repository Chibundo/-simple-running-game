import { randomBytes, randomInt } from 'node:crypto';
import { GAME, RACE, canEnter, validLook, type WorldId } from '../shared/config';
import { cleanAlias } from '../shared/game';
import type { PlayerInput, RacePlayer, RoomView, ServerMessage, RaceSettings } from '../shared/protocol';
export interface Peer { send(message: ServerMessage): void; close(): void }
type Member = RacePlayer & { token: string; peer?: Peer; disconnectedAt?: number };
type Room = Omit<RoomView, 'players' | 'serverNow' | 'elapsedMs'> & { players: Member[]; touchedAt: number; emptyAt?: number };
export type Settings = RaceSettings & { emptyRoomMs: number; idleRoomMs: number; maxRooms: number };
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class Rooms {
  rooms = new Map<string, Room>();
  private memberships = new Map<Peer, { room: Room; player: Member }>();
  readonly settings: Settings;
  constructor(settings: Partial<Settings> = {}, private now = () => Date.now()) {
    this.settings = { ...RACE, ...settings };
  }
  private error(peer: Peer, message: string, fatal = false) { peer.send({ type: 'error', message, fatal }); }
  private input(value: unknown): PlayerInput | null {
    if (!value || typeof value !== 'object') return null;
    const p = value as PlayerInput;
    if (typeof p.alias !== 'string' || p.alias.trim().length < 1 || p.alias.length > 20 || cleanAlias(p.alias) !== p.alias.trim()
      || !Number.isInteger(p.speed) || p.speed < 1 || p.speed > 10 || !Number.isFinite(p.earned) || p.earned < 0 || p.earned > GAME.maxSavedEarnings || !validLook(p.look)) return null;
    return { alias: p.alias.trim(), speed: p.speed, earned: p.earned, look: { ...p.look } };
  }
  receive(peer: Peer, raw: unknown) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return this.error(peer, 'Invalid message.');
    const m = raw as Record<string, unknown>;
    const fields: Record<string, string[]> = { create: ['player'], join: ['code', 'player'], reconnect: ['code', 'token'], ready: ['ready', 'player'], world: ['world'], start: [], lobby: [], leave: [] };
    if (typeof m.type !== 'string' || !Object.hasOwn(fields, m.type) || Object.keys(m).some(k => k !== 'type' && !fields[m.type as string].includes(k))) return this.error(peer, 'Unsupported message.');
    this.tick();
    if (['create', 'join', 'reconnect'].includes(m.type)) {
      if (this.memberships.has(peer)) return this.error(peer, 'Leave your current room first.');
      if (m.type === 'reconnect') return this.reconnect(peer, m.code, m.token);
      const input = this.input(m.player);
      if (!input) return this.error(peer, 'Choose an alias (1–20 characters) and valid runner settings.');
      let room: Room | undefined;
      if (m.type === 'create') {
        if (this.rooms.size >= this.settings.maxRooms) return this.error(peer, 'Race server is busy. Try again later.');
        let code: string;
        do { code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (this.rooms.has(code));
        room = { code, hostId: '', phase: 'lobby', world: 'meadow', players: [], raceId: 0, startAt: 0, touchedAt: this.now(), rules: this.rules() };
        this.rooms.set(code, room);
      } else {
        room = typeof m.code === 'string' ? this.rooms.get(m.code.toUpperCase()) : undefined;
        if (!room) return this.error(peer, 'Room not found or expired. Check the invitation code.');
      }
      if (room.players.length >= this.settings.capacity) return this.error(peer, 'This room is full.');
      const player: Member = { ...input, id: randomBytes(12).toString('hex'), token: randomBytes(32).toString('base64url'), peer, connected: true, ready: false, spectator: room.phase !== 'lobby', distance: 0, energy: 100, status: 'waiting' };
      room.players.push(player);
      if (!room.hostId) room.hostId = player.id;
      // A new runner must not bypass the requirements of a selected race world.
      if (room.phase === 'lobby' && !canEnter(room.world, player.speed, player.earned)) {
        room.world = 'meadow'; room.players.forEach(p => p.ready = false);
      }
      this.attach(room, player, peer);
      return;
    }
    const membership = this.memberships.get(peer);
    if (!membership) return this.error(peer, 'Join a room first.');
    const { room, player } = membership;
    room.touchedAt = this.now();
    if (m.type === 'leave') { this.depart(room, player); peer.send({ type: 'left' }); return; }
    if (m.type === 'ready') {
      if (room.phase !== 'lobby' || typeof m.ready !== 'boolean') return this.error(peer, 'Readiness can only change in the lobby.');
      const input = this.input(m.player);
      if (!input || !canEnter(room.world, input.speed, input.earned)) return this.error(peer, 'Runner does not meet the world requirements.');
      Object.assign(player, input, { ready: m.ready });
    } else if (m.type === 'world') {
      if (player.id !== room.hostId || room.phase !== 'lobby') return this.error(peer, 'Only the lobby host can choose a world.');
      if (!GAME.worlds.some(w => w.id === m.world) || room.players.some(p => !canEnter(m.world as WorldId, p.speed, p.earned))) return this.error(peer, 'Every runner must meet this world’s requirements.');
      room.world = m.world as WorldId; room.players.forEach(p => p.ready = false);
    } else if (m.type === 'start') {
      if (player.id !== room.hostId || room.phase !== 'lobby') return this.error(peer, 'Only the lobby host can start a race.');
      if (room.players.length < 2 || room.players.some(p => !p.connected || !p.ready)) return this.error(peer, 'At least two runners must be connected, and everyone must be ready.');
      room.phase = 'countdown'; room.startAt = this.now() + this.settings.countdownMs; room.raceId++;
      room.players.forEach(p => { p.distance = 0; p.energy = 100; p.status = 'running'; p.spectator = false; delete p.place; });
    } else if (m.type === 'lobby') {
      if (room.phase !== 'results' || player.id !== room.hostId) return this.error(peer, 'The host can return everyone to the lobby after results.');
      room.players = room.players.filter(p => p.connected);
      room.phase = 'lobby'; room.startAt = 0;
      room.players.forEach(p => { p.ready = false; p.spectator = false; p.distance = 0; p.energy = 100; p.status = 'waiting'; delete p.place; });
    }
    this.broadcast(room);
  }
  private rules(): RaceSettings {
    const { durationMs, countdownMs, reconnectGraceMs, capacity } = this.settings;
    return { durationMs, countdownMs, reconnectGraceMs, capacity };
  }
  private attach(room: Room, player: Member, peer: Peer) {
    player.peer = peer; player.connected = true; delete player.disconnectedAt;
    room.emptyAt = undefined; room.touchedAt = this.now();
    this.memberships.set(peer, { room, player });
    peer.send({ type: 'session', code: room.code, token: player.token, playerId: player.id });
    this.transfer(room); this.broadcast(room);
  }
  private reconnect(peer: Peer, code: unknown, token: unknown) {
    const room = typeof code === 'string' ? this.rooms.get(code) : undefined;
    const player = room?.players.find(p => p.token === token && typeof token === 'string');
    if (!room || !player) return this.error(peer, 'Session expired. Rejoin with the room code.', true);
    if (player.disconnectedAt !== undefined && this.now() - player.disconnectedAt >= this.settings.reconnectGraceMs) return this.error(peer, 'Reconnect window ended. Your runner forfeited; join again to spectate.', true);
    if (player.peer) { this.memberships.delete(player.peer); player.peer.close(); }
    this.attach(room, player, peer);
  }
  disconnect(peer: Peer) {
    const entry = this.memberships.get(peer);
    if (!entry) return;
    this.tick(); this.memberships.delete(peer);
    entry.player.connected = false; entry.player.peer = undefined; entry.player.disconnectedAt = this.now();
    if (entry.room.phase === 'lobby') entry.player.ready = false;
    if (!entry.room.players.some(p => p.connected)) entry.room.emptyAt ??= this.now();
    this.transfer(entry.room); this.broadcast(entry.room);
  }
  private depart(room: Room, player: Member) {
    if (player.peer) this.memberships.delete(player.peer);
    player.connected = false; player.peer = undefined; player.token = ''; player.disconnectedAt = this.now() - this.settings.reconnectGraceMs;
    if (room.phase === 'countdown' || room.phase === 'racing') {
      if (!player.spectator) player.status = 'forfeited';
      else room.players = room.players.filter(p => p !== player);
    } else if (room.phase !== 'results' || player.spectator) room.players = room.players.filter(p => p !== player);
    this.transfer(room); this.tick(); this.broadcast(room);
  }
  private transfer(room: Room) {
    if (!room.players.some(p => p.id === room.hostId && p.connected)) room.hostId = room.players.find(p => p.connected)?.id ?? '';
  }
  tick() {
    const now = this.now();
    for (const [code, room] of this.rooms) {
      if (room.phase === 'lobby') {
        room.players = room.players.filter(p => p.connected || p.disconnectedAt === undefined || now - p.disconnectedAt < this.settings.reconnectGraceMs);
        this.transfer(room);
      }
      if (room.phase === 'countdown' || room.phase === 'racing') {
        const elapsed = Math.max(0, Math.min(this.settings.durationMs, now - room.startAt));
        if (now >= room.startAt) room.phase = 'racing';
        for (const p of room.players.filter(p => !p.spectator && p.status !== 'forfeited')) {
          const forfeited = p.disconnectedAt !== undefined && p.disconnectedAt + this.settings.reconnectGraceMs <= Math.min(now, room.startAt + this.settings.durationMs);
          const activeMs = Math.max(0, Math.min(elapsed, forfeited ? p.disconnectedAt! + this.settings.reconnectGraceMs - room.startAt : elapsed, GAME.maxEnergy / GAME.energyPerSecond * 1000));
          p.distance = p.speed * activeMs / 1000 * 1609.344 / 3600;
          p.energy = Math.max(0, GAME.maxEnergy - activeMs / 1000 * GAME.energyPerSecond);
          p.status = forfeited ? 'forfeited' : p.energy === 0 ? 'exhausted' : elapsed >= this.settings.durationMs ? 'finished' : 'running';
        }
        const runners = room.players.filter(p => !p.spectator);
        if (elapsed >= this.settings.durationMs || runners.every(p => p.status !== 'running')) {
          room.phase = 'results'; room.touchedAt = now;
          const sorted = [...runners].sort((a, b) => b.distance - a.distance);
          sorted.forEach((p, i) => p.place = i && Math.abs(p.distance - sorted[i - 1].distance) < 1e-7 ? sorted[i-1].place : i + 1);
        }
      }
      if (!room.players.some(p => p.connected)) room.emptyAt ??= now; else room.emptyAt = undefined;
      if ((room.emptyAt !== undefined && now - room.emptyAt >= this.settings.emptyRoomMs) || (room.phase !== 'racing' && room.phase !== 'countdown' && now - room.touchedAt >= this.settings.idleRoomMs)) {
        for (const p of room.players) if (p.peer) { this.error(p.peer, 'This room expired. Create a new race.', true); this.memberships.delete(p.peer); p.peer.close(); }
        this.rooms.delete(code);
      }
    }
  }
  view(room: Room): RoomView {
    return { code: room.code, hostId: room.hostId, phase: room.phase, world: room.world, raceId: room.raceId, startAt: room.startAt, serverNow: this.now(), elapsedMs: Math.max(0, Math.min(this.settings.durationMs, this.now() - room.startAt)), rules: room.rules,
      players: room.players.map(({ token: _token, peer: _peer, disconnectedAt: _at, ...publicPlayer }) => ({ ...publicPlayer, look: { ...publicPlayer.look } })) };
  }
  broadcast(room: Room) { const message: ServerMessage = { type: 'state', room: this.view(room) }; room.players.forEach(p => p.peer?.send(message)); }
  broadcastAll() { for (const room of this.rooms.values()) this.broadcast(room); }
}
