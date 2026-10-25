import { type Cosmetics } from '../shared/config';
import { humanAvatar } from './graphics/avatar';
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
/** Kept as an internal compatibility name for existing menu render calls. */
export function stickman(look: Cosmetics, className = '') {
  return humanAvatar(look, className);
}
const TILE_WIDTH = 960;

/** Three identical tiles keep every layer seamless at wide and narrow sizes. */
function sceneryLayer(name: string, artwork: string) {
  const tile = `<svg viewBox="0 0 ${TILE_WIDTH} 400" preserveAspectRatio="none" aria-hidden="true">${artwork}</svg>`;
  return `<div class="scenery-layer scenery-${name}" data-scenery-layer="${name}">${tile.repeat(3)}</div>`;
}

export function scene() {
  const clouds = sceneryLayer('clouds', `
    <g class="day-only" fill="#fff" opacity=".85">
      <path d="M70 83q-12-16 8-23 5-31 35-19 24-10 34 15 30 1 21 27z"/>
      <path d="M490 109q-8-15 9-20 6-24 26-16 18-8 27 11 24-1 19 25z"/>
      <path d="M780 58q-10-13 6-18 5-23 24-16 19-8 25 12 22-2 19 22z"/>
    </g>
    <g class="night-only" fill="#fff4c1"><path d="m112 65 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="m550 41 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><circle cx="320" cy="100" r="2"/><circle cx="840" cy="85" r="3"/><circle cx="670" cy="120" r="2"/></g>
    <g class="day-only" fill="none" stroke="#4f8990" stroke-width="2" stroke-linecap="round"><path d="M330 95q7-9 14 0 7-9 14 0M370 77q5-6 10 0 5-6 10 0"/></g>`);
  const mountains = sceneryLayer('mountains', `
    <path d="M0 400V220L92 170l78 48 128-115 108 114 115-63 114 75 114-108 113 97 98 2v180z" fill="var(--peak-back)"/>
    <path d="m240 155 58-52 49 53-31-10-18 9-21-10zM690 177l59-56 56 48-39-11-16 12-19-11z" fill="var(--peak-snow)" opacity=".7"/>
    <path d="M0 400V253Q100 194 215 244T455 236 690 242 960 253V400" fill="var(--peak-front)"/>`);
  const hills = sceneryLayer('hills', `
    <path d="M0 400V260Q120 190 240 255T480 255 720 255 960 260V400" fill="var(--hill-back)"/>
    <path d="M0 400V292Q120 250 240 290T480 290 720 290 960 292V400" fill="var(--hill-front)"/>
    <g fill="none" stroke="var(--hill-line)" stroke-width="2" opacity=".5"><path d="M40 278q70-18 120-7M480 279q70-13 115 0M820 291l70-4"/></g>`);
  const trees = sceneryLayer('trees', `
    <g transform="translate(670 0)">
      <path d="M-5 294 0 176h10l7 118" fill="var(--bark)"/>
      <path d="m6 244-28-29m32 12 25-22" fill="none" stroke="var(--bark)" stroke-width="7" stroke-linecap="round"/>
      <path d="M-56 210q-31-19-8-48-7-35 28-36 13-34 48-16 38-18 56 17 36 5 26 37 27 33-9 52-70 23-141-6" fill="var(--tree-dark)"/>
      <path d="M-54 177q-6-28 25-32 8-31 38-19 22-11 42 15 25 5 21 25-56 25-126 11" fill="var(--tree-light)"/>
      <ellipse cx="1" cy="301" rx="60" ry="7" fill="var(--tree-shadow)" opacity=".25"/>
    </g>
    <g transform="translate(150 20)"><path d="M0 277V190" stroke="var(--bark)" stroke-width="9"/><path d="m0 118-42 70h23l-39 49h42l-36 28H54l-38-28h43l-37-49h23z" fill="var(--pine-dark)"/><path d="m0 118-42 70h23l-39 49h42l-36 28h47l11-37-7-32 17-12z" fill="var(--pine-light)"/></g>
    <g fill="var(--bush)"><path d="M340 301q-16-27 10-32 7-30 31-12 28-16 32 11 29 1 22 33z"/><path d="M840 305q-17-23 4-29 2-24 23-12 25-16 29 13 26 1 21 28z"/></g>
    <g transform="translate(63 260) rotate(-5)"><path d="M15 3v43" stroke="#a77d4c" stroke-width="5"/><path d="M0 0h49v24H0z" fill="#fff5cf" stroke="#ad8a59" stroke-width="2"/><text x="24" y="16" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="900" fill="#3b5142">GO!</text></g>
    <g fill="#eaf59d"><ellipse cx="540" cy="304" rx="15" ry="4"/><ellipse cx="920" cy="303" rx="12" ry="3"/></g>`);
  const foreground = sceneryLayer('foreground', `
    <path d="M0 400v-28q30-10 60 0t60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0v28z" fill="var(--near-grass)"/>
    <g stroke="var(--grass-blade)" stroke-width="3" stroke-linecap="round" fill="none"><path d="m80 386-4-14m5 14 8-9m234 11-5-16m5 16 7-11m270 7-4-15m4 15 9-10m240 11-5-15m5 15 7-9"/></g>
    <g fill="var(--flower-petal)"><path d="M220 382c-15-10-4-17 1-9 4-12 16-6 9 2 13 1 10 14 0 8-1 11-14 8-10-1"/><path d="M740 385c-15-10-4-17 1-9 4-12 16-6 9 2 13 1 10 14 0 8-1 11-14 8-10-1"/></g><g fill="#ffc261"><circle cx="225" cy="379" r="3"/><circle cx="745" cy="382" r="3"/></g>
    <g fill="var(--stone)"><path d="m420 387 5-7 12 1 8 7z"/><path d="m890 393 5-8 14-2 9 10z"/></g>`);
  return `<div class="scene meadow ready" id="scene" role="img" aria-label="Runner on a scenic outdoor trail">
    <div class="sky-grain"></div><div class="sun"><span></span></div><div class="moon"></div>
    ${clouds}${mountains}${hills}${trees}
    <div class="track"><div class="track-dashes"></div><div class="track-specks"></div></div>
    ${foreground}
    <div class="scene-label"><span class="live-dot"></span><span id="scene-world">SUNNY MEADOWS</span></div>
    <span class="scene-caption" id="scene-caption">READY TO ROLL</span>
    <div class="runner" id="runner"></div>
    <div class="scene-bottom"><span id="run-label">YOUR NEXT ADVENTURE STARTS HERE</span><span id="distance">0.0 m</span></div>
  </div>`;
}
