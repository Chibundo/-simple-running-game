import type { Cosmetics, WorldId } from './config';
export type RaceSettings = { durationMs: number; countdownMs: number; reconnectGraceMs: number; capacity: number };
export type PlayerInput = { alias: string; speed: number; earned: number; look: Cosmetics };
export type RacePlayer = PlayerInput & { id: string; connected: boolean; ready: boolean; spectator: boolean; distance: number; energy: number; status: 'waiting' | 'running' | 'finished' | 'exhausted' | 'forfeited'; place?: number };
export type RoomView = { code: string; hostId: string; phase: 'lobby' | 'countdown' | 'racing' | 'results'; world: WorldId; players: RacePlayer[]; raceId: number; startAt: number; serverNow: number; elapsedMs: number; rules: RaceSettings };
export type ServerMessage = { type: 'session'; code: string; token: string; playerId: string } | { type: 'state'; room: RoomView } | { type: 'error'; message: string; fatal?: boolean } | { type: 'left' };
export type ClientMessage = { type: 'create'; player: PlayerInput } | { type: 'join'; code: string; player: PlayerInput } | { type: 'reconnect'; code: string; token: string } | { type: 'ready'; ready: boolean; player: PlayerInput } | { type: 'world'; world: WorldId } | { type: 'start' | 'lobby' | 'leave' };
