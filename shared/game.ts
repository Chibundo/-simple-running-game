import { GAME, DEFAULT_LOOK, canEnter, validLook, type Cosmetics, type WorldId } from './config';
export type Profile = { id: string; alias: string; earned: number; speed: number; world: WorldId; unlocked: WorldId[]; look: Cosmetics };
export type Run = { phase: 'ready' | 'running' | 'paused' | 'tired'; energy: number; distance: number; seconds: number; earned: number };
export const newRun = (): Run => ({ phase: 'ready', energy: GAME.maxEnergy, distance: 0, seconds: 0, earned: 0 });
export const newProfile = (alias = 'Little Runner', id: string = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')): Profile => ({ id, alias, earned: 0, speed: 1, world: 'meadow', unlocked: ['meadow'], look: { ...DEFAULT_LOOK } });
export const nextUpgrade = (speed: number) => GAME.upgrades.find(u => u.speed === speed + 1);
export function unlock(p: Profile) {
  for (const w of GAME.worlds) if (canEnter(w.id, p.speed, p.earned) && !p.unlocked.includes(w.id)) p.unlocked.push(w.id);
}
export function upgrade(p: Profile, phase: Run['phase']) {
  const next = nextUpgrade(p.speed);
  if (phase !== 'ready' || !next || p.earned < next.threshold) return false;
  p.speed = next.speed; unlock(p); return true;
}
/** Active time only; clamps the final step at exhaustion so rewards stop exactly once. */
export function advance(p: Profile, run: Run, seconds: number) {
  if (run.phase !== 'running' || !Number.isFinite(seconds) || seconds <= 0) return;
  const dt = Math.min(seconds, run.energy / GAME.energyPerSecond);
  const earned = dt * p.speed * GAME.earningsPerSpeedSecond;
  run.seconds += dt; run.distance += p.speed * dt * 1609.344 / 3600; run.earned += earned;
  p.earned = Math.min(GAME.maxSavedEarnings, p.earned + earned);
  run.energy = Math.max(0, run.energy - dt * GAME.energyPerSecond);
  if (run.energy < 1e-8) { run.energy = 0; run.phase = 'tired'; }
  unlock(p);
}
export function ranking(profiles: Profile[]) {
  const sorted = [...profiles].sort((a, b) => b.earned - a.earned || b.speed - a.speed || a.alias.localeCompare(b.alias));
  return sorted.map((p, i) => ({ ...p, rank: i && p.earned === sorted[i-1].earned && p.speed === sorted[i-1].speed ? 0 : i + 1 }))
    .map((p, i, arr) => { if (!p.rank) p.rank = arr[i - 1].rank; return p; });
}
export function cleanAlias(a: unknown) { return typeof a === 'string' ? a.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20) : ''; }
export function sanitizeProfile(value: unknown): Profile | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<Profile>;
  if (typeof v.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(v.id)) return null;
  const p = newProfile(cleanAlias(v.alias) || 'Runner', v.id);
  p.earned = typeof v.earned === 'number' && Number.isFinite(v.earned) ? Math.max(0, Math.min(GAME.maxSavedEarnings, v.earned)) : 0;
  const requested = typeof v.speed === 'number' && Number.isFinite(v.speed) ? Math.max(1, Math.min(10, Math.floor(v.speed))) : 1;
  p.speed = Math.min(requested, 1 + GAME.upgrades.filter(x => p.earned >= x.threshold).length);
  if (validLook(v.look)) p.look = { ...v.look };
  unlock(p);
  // Unlocks are derived from lifetime progression, which never decreases.
  if (GAME.worlds.some(x => x.id === v.world) && p.unlocked.includes(v.world as WorldId)) p.world = v.world as WorldId;
  return p;
}
