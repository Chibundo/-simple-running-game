import { test, expect, type Page } from '@playwright/test';

async function position(page: Page, name: string) {
  return page.locator(`[data-scenery-layer="${name}"]`).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41);
}

test('running visibly scrolls multiple depths; pause freezes every layer and resume continues', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.clock.runFor(500);
  expect(await position(page, 'trees')).toBe(0);
  await page.getByRole('button', { name: 'Start running', exact: true }).click();
  await page.clock.runFor(2000);
  const trees = await position(page, 'trees');
  const hills = await position(page, 'hills');
  const foreground = await position(page, 'foreground');
  expect(trees).toBeLessThan(-100);
  expect(Math.abs(hills)).toBeLessThan(Math.abs(trees));
  expect(Math.abs(foreground)).toBeGreaterThan(Math.abs(trees));

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const frozen = await position(page, 'trees');
  await expect(page.locator('#scene-caption')).toContainText('PAUSED');
  await page.clock.runFor(4000);
  expect(await position(page, 'trees')).toBe(frozen);
  await page.getByRole('button', { name: 'Make it yours' }).click();
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await position(page, 'trees')).toBe(frozen);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(500);
  expect(await position(page, 'trees')).toBeLessThan(frozen - 20);
});

test('world tiles cover the scene after repeated wraps; faster runners move scenery faster', async ({ browser }) => {
  const distances: number[] = [];
  for (const speed of [1, 9]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(speed => {
      localStorage.setItem('simple-running-game.v1', JSON.stringify({ version: 1, active: 'motion-fixture', profiles: [{ id: 'motion-fixture', alias: 'Runner', earned: 19030, speed, world: 'meadow', look: { color: 'ink', hat: 'none', glasses: 'none', outfit: 'none' } }] }));
    }, speed);
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: 'Start running', exact: true }).click();
    await page.clock.runFor(2000);
    distances.push(Math.abs(await position(page, 'trees')));
    if (speed === 9) {
      await page.clock.runFor(8000);
      for (const width of [360, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        const coverage = await page.locator('.scenery-trees').evaluate(el => {
          const layer = el.getBoundingClientRect();
          const scene = document.querySelector('#scene')!.getBoundingClientRect();
          return { left: layer.left <= scene.left, right: layer.right >= scene.right };
        });
        expect(coverage).toEqual({ left: true, right: true });
      }
    }
    await context.close();
  }
  expect(distances[1]).toBeGreaterThan(distances[0] * 2);
});

test('reduced motion keeps scenery stationary while gameplay still earns progress', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Start running', exact: true }).click();
  await page.clock.runFor(2000);
  expect(await position(page, 'trees')).toBe(0);
  expect(await position(page, 'foreground')).toBe(0);
  expect(Number(await page.locator('#earned').innerText())).toBeGreaterThan(30);
  expect(await page.locator('#runner .front-leg').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});
