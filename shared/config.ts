/** Provisional balancing defaults live here; see README for confirmed rules. */
export const GAME = {
  maxEnergy: 100,
  energyPerSecond: 2,
  earningsPerSpeedSecond: 20,
  tiredMs: 1800,
  maxSavedEarnings: 1e12,
  maxProfiles: 20,
  upgrades: [
    { speed: 2, threshold: 100 }, { speed: 3, threshold: 150 },
    { speed: 4, threshold: 300 }, { speed: 5, threshold: 500 },
    { speed: 6, threshold: 1500 }, { speed: 7, threshold: 3000 },
    { speed: 8, threshold: 10000 }, { speed: 9, threshold: 15000 },
    { speed: 10, threshold: 100000 },
  ],
  worlds: [
    { id: 'meadow', name: 'Sunny Meadows', short: 'Meadows', icon: '✿', description: 'A little sunshine, a lot of possibility.', speed: 1, earned: 0 },
    { id: 'twilight', name: 'Twilight Trails', short: 'Twilight', icon: '☾', description: 'Chase the stars beyond the mountains.', speed: 10, earned: 100000 },
  ],
  colors: [ { id: 'ink', name: 'Midnight', value: '#263e3c' }, { id: 'coral', name: 'Coral', value: '#cf5547' }, { id: 'blue', name: 'Ocean', value: '#377ab0' }, { id: 'purple', name: 'Plum', value: '#85549a' } ],
  hats: ['none', 'cap', 'crown'],
  glasses: ['none', 'round', 'sun'],
  outfits: ['none', 'scarf', 'jersey'],
} as const;
export type WorldId = typeof GAME.worlds[number]['id'];
export type Cosmetics = { color: string; hat: string; glasses: string; outfit: string };
export const DEFAULT_LOOK: Cosmetics = { color: 'ink', hat: 'none', glasses: 'none', outfit: 'none' };
export const RACE = {
  capacity: 8, durationMs: 45000, countdownMs: 3000, reconnectGraceMs: 15000,
  emptyRoomMs: 60000, idleRoomMs: 30 * 60000, tickMs: 100,
  maxPayload: 4096, messagesPerSecond: 20, maxRooms: 500, maxConnections: 1000,
} as const;
export function validLook(value: unknown): value is Cosmetics {
  if (!value || typeof value !== 'object') return false;
  const c = value as Cosmetics;
  return GAME.colors.some(x => x.id === c.color) && (GAME.hats as readonly string[]).includes(c.hat)
    && (GAME.glasses as readonly string[]).includes(c.glasses) && (GAME.outfits as readonly string[]).includes(c.outfit);
}
export function canEnter(world: WorldId, speed: number, earned: number) {
  const w = GAME.worlds.find(w => w.id === world)!;
  return speed >= w.speed && earned >= w.earned;
}
