import * as THREE from 'three';

/** Deterministic, locally generated art: no remote textures or tracking requests. */
export function random(seed: number) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}
function surface(size: number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d')! };
}
function texture(canvas: HTMLCanvasElement, repeat = false) {
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  if (repeat) map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}
export function groundTexture(kind: 'grass' | 'dirt') {
  const { canvas, ctx } = surface(512), rng = random(kind === 'grass' ? 11 : 37);
  ctx.fillStyle = kind === 'grass' ? '#536442' : '#9a876e'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 34000; i++) {
    const x = rng() * 512, y = rng() * 512, v = rng();
    if (kind === 'grass') {
      ctx.strokeStyle = `rgba(${60 + v * 65},${70 + v * 65},${35 + v * 48},${.2 + rng() * .5})`;
      ctx.lineWidth = .5 + rng(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng() * 3 - 1.5, y - rng() * 6); ctx.stroke();
    } else {
      const shade = Math.floor(75 + v * 110);
      ctx.fillStyle = `rgba(${shade + 12},${shade},${shade - 17},${.15 + rng() * .35})`;
      ctx.beginPath(); ctx.ellipse(x, y, .4 + rng() * 2.2, .4 + rng() * 1.5, rng() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  return texture(canvas, true);
}
export function barkTexture() {
  const { canvas, ctx } = surface(256), rng = random(91);
  ctx.fillStyle = '#665445'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1000; i++) {
    const x = rng() * 256, y = rng() * 256;
    ctx.strokeStyle = rng() > .5 ? '#392e2860' : '#bcaa8570'; ctx.lineWidth = .4 + rng() * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng() * 5, y + 3 + rng() * 40); ctx.stroke();
  }
  return texture(canvas, true);
}
export function foliageTexture(kind: 'leaves' | 'grass') {
  const { canvas, ctx } = surface(256), rng = random(kind === 'leaves' ? 81 : 22);
  if (kind === 'leaves') {
    for (let i = 0; i < 65; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 105;
      const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
      const light = rng();
      ctx.fillStyle = `rgb(${38 + light * 55},${65 + light * 60},${23 + light * 30})`;
      ctx.beginPath(); ctx.ellipse(x, y, 6 + rng() * 13, 3 + rng() * 7, a, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b1b37630'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.stroke();
    }
  } else {
    for (let i = 0; i < 34; i++) {
      const x = rng() * 256, h = 35 + rng() * 200, lean = rng() * 50 - 25;
      ctx.fillStyle = `rgb(${55 + rng() * 45},${74 + rng() * 52},${29 + rng() * 30})`;
      ctx.beginPath(); ctx.moveTo(x, 256); ctx.quadraticCurveTo(x + lean, 256 - h * .7, x + lean * 1.5, 256 - h);
      ctx.quadraticCurveTo(x + lean + 5, 256 - h * .5, x + 5, 256); ctx.fill();
    }
  }
  return texture(canvas);
}
export function cloudTexture() {
  const { canvas, ctx } = surface(512), rng = random(888);
  for (let i = 0; i < 100; i++) {
    const x = rng() * 512, y = 140 + rng() * 230, radius = 16 + rng() * 70;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, '#ffffff18'); gradient.addColorStop(.5, '#ffffff0b'); gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  return texture(canvas);
}
export function moonTexture() {
  const { canvas, ctx } = surface(512), rng = random(1008);
  ctx.fillStyle = '#bdbdb7'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 950; i++) {
    const x = rng() * 512, y = rng() * 512, radius = 1 + Math.pow(rng(), 3) * 30;
    const gradient = ctx.createRadialGradient(x - radius * .2, y - radius * .2, 0, x, y, radius);
    gradient.addColorStop(0, '#676e6a50'); gradient.addColorStop(.75, '#92978f30'); gradient.addColorStop(.9, '#e9e7d850'); gradient.addColorStop(1, '#bdbdb700');
    ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  return texture(canvas);
}
