import { GAME } from '../shared/config';
import { newProfile, sanitizeProfile, type Profile } from '../shared/game';
export const SAVE_KEY = 'simple-running-game.v1';
export type Save = { version: 1; active: string; profiles: Profile[] };
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export function load(storage: StorageLike): { data: Save; warning: boolean } {
  const initial = newProfile();
  const fallback: Save = { version: 1, active: initial.id, profiles: [initial] };
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { data: fallback, warning: false };
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.profiles)) throw new Error('Unknown save');
    const profiles: Profile[] = value.profiles.slice(0, GAME.maxProfiles).map(sanitizeProfile).filter(Boolean);
    const unique = profiles.filter((p, i) => profiles.findIndex(x => x.id === p.id) === i);
    if (!unique.length) throw new Error('Empty save');
    return { data: { version: 1, active: unique.some(p => p.id === value.active) ? value.active : unique[0].id, profiles: unique }, warning: unique.length !== value.profiles.length };
  } catch { return { data: fallback, warning: true }; }
}
export function persist(storage: StorageLike, data: Save) { try { storage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; } }
