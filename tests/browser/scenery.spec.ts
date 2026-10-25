import { test, expect, type Page } from '@playwright/test';

async function freezeClock(page: Page) {
  // Keep shader compilation and UI interactions from adding unequal real time.
  await page.clock.install({ time: new Date('2026-10-25T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-25T12:00:05Z'));
}

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('#scene')).toHaveAttribute('data-renderer', 'webgl', { timeout: 30000 });
  await page.clock.fastForward(100);
  await expect(page.locator('.world-canvas')).toBeVisible();
}
async function travel(page: Page) {
  return Number(await page.locator('#scene').getAttribute('data-world-travel'));
}
async function landscapeImage(page: Page) {
  const box = await page.locator('#scene').boundingBox();
  if (!box) throw new Error('Scene missing');
  return page.screenshot({ clip: { x: box.x + 25, y: box.y + 60, width: box.width - 50, height: box.height - 120 } });
}

test('3D world renders real geometry, moves during running and freezes when paused', async ({ page }) => {
  await freezeClock(page); await ready(page);
  expect(await travel(page)).toBe(0);
  const before = await landscapeImage(page);
  await page.getByRole('button', { name: 'Start running', exact: true }).click();
  await page.clock.fastForward(2000);
  expect(await travel(page)).toBeGreaterThan(3);
  const moving = await landscapeImage(page);
  expect(moving.equals(before)).toBe(false);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.clock.fastForward(100);
  const frozenTravel = await travel(page);
  const frozenFrame = await page.locator('.world-canvas').getAttribute('data-frame');
  await expect(page.locator('#scene-caption')).toContainText('PAUSED');
  await page.clock.fastForward(4000);
  expect(await travel(page)).toBe(frozenTravel);
  expect(await page.locator('.world-canvas').getAttribute('data-frame')).toBe(frozenFrame);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.fastForward(1000);
  expect(await travel(page)).toBeGreaterThan(frozenTravel + 1);
});

test('faster saved runners move through the world faster; the canvas resizes without overflow', async ({ browser }) => {
  const distances: number[] = [];
  for (const speed of [1, 9]) {
    const context = await browser.newContext(); const page = await context.newPage();
    try {
      await page.addInitScript(speed => {
        localStorage.setItem('simple-running-game.v1', JSON.stringify({ version: 1, active: 'motion-fixture', profiles: [{ id: 'motion-fixture', alias: 'Runner', earned: 19030, speed, world: 'meadow', look: { color: 'ink', hat: 'none', glasses: 'none', outfit: 'none' } }] }));
      }, speed);
      await freezeClock(page); await ready(page);
      await page.getByRole('button', { name: 'Start running', exact: true }).click();
      await page.clock.fastForward(2000); distances.push(await travel(page));
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      for (const width of [360, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        const sizes = await page.locator('.world-canvas').evaluate(el => ({ canvas: el.getBoundingClientRect().width, scene: el.parentElement!.clientWidth, overflow: document.documentElement.scrollWidth > innerWidth }));
        expect(Math.abs(sizes.canvas - sizes.scene)).toBeLessThan(1); expect(sizes.overflow).toBe(false);
      }
    } finally { await context.close(); }
  }
  expect(distances[1]).toBeGreaterThan(distances[0] * 2);
});

test('reduced motion keeps the 3D scenery and human still while progress continues', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await freezeClock(page); await ready(page);
  await page.getByRole('button', { name: 'Start running', exact: true }).click();
  await page.clock.fastForward(2000);
  expect(await travel(page)).toBe(0);
  expect(Number(await page.locator('#earned').innerText())).toBeGreaterThan(30);
  const frame = await page.locator('.world-canvas').getAttribute('data-frame');
  await page.clock.fastForward(3000);
  expect(await page.locator('.world-canvas').getAttribute('data-frame')).toBe(frame);
});

test('WebGL loss falls back to the animated human and keeps the game playable', async ({ page }) => {
  await freezeClock(page); await ready(page);
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.world-canvas')!;
    canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.locator('#scene')).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.locator('#runner .human-avatar')).toBeVisible();
  await page.getByRole('button', { name: 'Start running', exact: true }).click();
  await page.clock.fastForward(2000);
  expect(Number(await page.locator('#earned').innerText())).toBeGreaterThan(30);
  const x = await page.locator('[data-scenery-layer="trees"]').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41);
  expect(x).toBeLessThan(-100);
});
