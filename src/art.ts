import { GAME, type Cosmetics } from '../shared/config';
export const escape = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function icon(name: string) {
  const paths: Record<string, string> = {
    play: '<path d="m9 5 11 7-11 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>', star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
    shirt: '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c-2 3-6 3-8 0z"/>', mountain: '<path d="m2 20 7-13 4 7 3-10 7 16zM7 11l3 2 1-2"/>',
    trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0zm0 2H3v3a5 5 0 0 0 5 5m8-8h5v3a5 5 0 0 1-5 5m-4 1v6m-4 1h8"/>',
    people: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-4a7 7 0 0 1 14 0v4M17 4a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 7"/>',
    settings: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>', check: '<path d="m5 12 4 4L19 6"/>', flag: '<path d="M5 22V3h14l-3 5 3 5H5"/>',
  };
  return `<svg class="icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.star}</svg>`;
}
export function stickman(look: Cosmetics, className = '') {
  const color = GAME.colors.find(c => c.id === look.color)?.value ?? GAME.colors[0].value;
  return `<svg class="stickman ${className}" viewBox="0 0 100 140" aria-hidden="true" style="color:${color}">
  <ellipse class="shadow" cx="50" cy="132" rx="25" ry="4" fill="#1d393d" opacity=".12"/>
  <g class="body" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
  <g class="back-leg"><path d="M50 80 37 105 26 128"/></g><g class="back-arm"><path d="M50 51 34 69 21 64"/></g>
  <path d="M50 43v37"/><g class="front-leg"><path d="m50 80 17 22 9 26"/></g><g class="front-arm"><path d="m50 51 18 14 13-11"/></g>
  <g class="head"><circle cx="50" cy="27" r="16" fill="#f8f7ef"/><path d="M55 26h.1" stroke-width="4"/><path d="M54 34q4 2 6-2" stroke-width="2"/>
  ${look.hat === 'cap' ? '<path d="M33 23q0-22 32-10v10H29" fill="#e99d55" stroke="#b96629" stroke-width="3"/>' : look.hat === 'crown' ? '<path d="m33 16-1-14 12 8 7-10 7 10 12-8-3 14z" fill="#efbe53" stroke="#b17d29" stroke-width="2"/>' : ''}
  ${look.glasses === 'round' ? '<circle cx="44" cy="26" r="6" stroke-width="2"/><circle cx="59" cy="26" r="6" stroke-width="2"/><path d="M50 26h3" stroke-width="2"/>' : look.glasses === 'sun' ? '<path d="M37 22h27v8H37z" fill="#263e3c" stroke-width="2"/>' : ''}</g>
  ${look.outfit === 'scarf' ? '<path d="M43 45h14l10 14-9 2-8-13" fill="#e48460" stroke="#c76546" stroke-width="3"/>' : look.outfit === 'jersey' ? '<path d="m41 47 18 0-1 25H42z" fill="#91b3c5" stroke-width="2"/>' : ''}
  </g></svg>`;
}
export function scene() {
  return `<div class="scene" id="scene" role="img" aria-label="Stickman on a sunny meadow running track">
  <div class="scene-label"><span class="live-dot"></span><span id="scene-world">SUNNY MEADOWS</span></div><span class="scene-caption" id="scene-caption">A fresh start awaits.</span>
  <div class="sun"></div><div class="moon-stars">✧ · ✦ · ✧</div>
  <div class="cloud cloud-one"></div><div class="cloud cloud-two"></div>
  <div class="mountains"><svg viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V130Q150-60 330 130Q450 30 600 130Q800-60 1000 140V200" fill="currentColor"/></svg></div>
  <div class="hills"><svg viewBox="0 0 1200 180" preserveAspectRatio="none"><path d="M0 180V95Q150 5 300 95T600 95T900 95T1200 95V180" fill="currentColor"/></svg></div>
  <div class="far-ground"></div><div class="track"><div class="track-dashes"></div></div>
  <div class="scene-plant plant-one">✿</div><div class="scene-plant plant-two">✿</div><div class="mile-marker"><span>GO!</span><i></i></div>
  <div class="runner" id="runner"></div><div class="ground-front"></div>
  <div class="scene-bottom"><span id="run-label">YOUR LITTLE ADVENTURE</span><span id="distance">0.0 m</span></div></div>`;
}
