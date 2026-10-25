import { GAME, type Cosmetics } from '../../shared/config';
let serial = 0;
/** Lightweight human portrait for menus, race lanes and WebGL fallback. */
export function humanAvatar(look: Cosmetics, className = '') {
  const id = `human-${++serial}`, color = GAME.colors.find(c => c.id === look.color)?.value ?? '#263e3c';
  return `<svg class="stickman human-avatar ${className}" viewBox="0 0 100 180" aria-hidden="true">
    <defs>
      <linearGradient id="${id}-skin"><stop stop-color="#82543d"/><stop offset=".48" stop-color="#c69370"/><stop offset="1" stop-color="#a36e51"/></linearGradient>
      <linearGradient id="${id}-shirt"><stop stop-color="#000" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
    </defs>
    <ellipse cx="48" cy="175" rx="28" ry="3" fill="#172d2a" opacity=".18"/>
    <g class="body">
      <g class="back-leg"><path d="m45 105-11 30-8 30 9 3 12-30 10-25" fill="url(#${id}-skin)"/><path d="m26 164-7 6q-2 4 4 4h17l-3-7" fill="#c7d0cb" stroke="#53615a" stroke-width="1"/></g>
      <g class="back-arm"><path d="m45 55-13 25-10 15 6 4 15-16 10-20" fill="url(#${id}-skin)"/><path d="m44 53-10 15 12 8 10-17" fill="${color}"/></g>
      <path d="m46 40-1 14 16 1-3-17" fill="url(#${id}-skin)"/>
      <path d="M42 51q10-6 23 2l-3 29 1 18-27 1 4-26z" fill="${color}"/>
      <path d="M42 51q10-6 23 2l-3 29 1 18-27 1 4-26z" fill="url(#${id}-shirt)"/>
      <path d="m37 96 26-1 1 21-13 2-3-10-4 10-14-3z" fill="#263338"/>
      <g class="front-leg"><path d="m55 113 11 23 8 31-9 3-11-28-12-23" fill="url(#${id}-skin)"/><path d="m65 167-2 6q0 3 6 3h18q3-4-7-6l-6-4" fill="#dce2da" stroke="#53615a" stroke-width="1"/></g>
      <g class="front-arm"><path d="m62 59 11 22 11-7 4 6-18 13-17-27" fill="url(#${id}-skin)"/><path d="m57 52 10 5 6 13-14 7-8-15z" fill="${color}"/></g>
      <g class="head"><path d="M42 22q1-14 12-13 12 1 13 14l-1 7 5 6-6 2-3 9-11 1-9-8z" fill="url(#${id}-skin)"/>
      <path d="M42 33q-8-16 0-23 9-8 20-1 6 3 6 13l-9-4-11 3-1 13z" fill="#2d2722"/><ellipse cx="45" cy="31" rx="3" ry="5" fill="#b9805e"/>
      <path d="m59 28 5 1" stroke="#33271e" stroke-width="1.5"/><circle cx="62" cy="31" r="1.1" fill="#242721"/><path d="m61 42 4-1" stroke="#764c39" stroke-width="1.2"/>
      ${look.hat === 'cap' ? '<path d="M40 21q-2-17 16-16 13 1 14 17l9 2-1 4-36-4z" fill="#c57d42" stroke="#7c5935" stroke-width="1"/>' : look.hat === 'crown' ? '<path d="m40 17-1-12 10 6 6-10 6 11 11-6-3 14z" fill="#c6a24b" stroke="#8a732f" stroke-width="1"/>' : ''}
      ${look.glasses === 'sun' ? '<path d="m52 28 18 2-1 9-14-2z" fill="#253336"/>' : look.glasses === 'round' ? '<ellipse cx="61" cy="32" rx="6" ry="5" fill="none" stroke="#65777a" stroke-width="1.5"/><path d="m55 30-10-1" stroke="#65777a" stroke-width="1.5"/>' : ''}</g>
      ${look.outfit === 'scarf' ? '<path d="m44 49 17 1-1 6-17-2-12 22-5-4z" fill="#d2774c"/>' : look.outfit === 'jersey' ? '<path d="m49 59-4 32" stroke="#d1ded8" stroke-width="3"/>' : ''}
    </g>
  </svg>`;
}
