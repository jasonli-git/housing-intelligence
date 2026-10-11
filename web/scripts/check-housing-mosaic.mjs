import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.MOSAIC_ORIGIN ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 760, 1280]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const path of ['/nj/somerset-county', '/nj/princeton', '/regions/2842']) {
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      const mosaic = page.locator('.housing-mosaic');
      assert.equal(await mosaic.count(), 1, path + ' has a mosaic');
      assert.equal(await mosaic.locator('.mosaic-tile').count(), 100);
      assert.equal(await mosaic.locator('.mosaic-views button').count(), 3);
      assert(await mosaic.getByText(/Occupied homes ·/).isVisible());
      assert(await page.getByRole('combobox', { name: 'Jump to section' }).locator('option').evaluateAll(items => items.some(i => i.textContent === 'Housing mosaic')));
      await mosaic.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => scrollY);
      await mosaic.getByRole('button', { name: 'Occupied / empty', exact: true }).click();
      assert(await mosaic.getByText(/All homes ·/).isVisible());
      assert(await mosaic.locator('.mosaic-selected').getByText(/Includes seasonal homes/).isVisible());
      assert(Math.abs(await page.evaluate(() => scrollY) - before) < 2, 'View switching does not jump the page');
      await mosaic.getByRole('button', { name: 'Housing age', exact: true }).click();
      const groupButtons = mosaic.locator('.mosaic-legend button');
      assert.equal(await groupButtons.count(), 4);
      await groupButtons.last().focus();
      await page.keyboard.press('Enter');
      assert.equal(await groupButtons.last().getAttribute('aria-pressed'), 'true');
      assert(await mosaic.locator('.mosaic-selected').getByText('2000 or later', { exact: true }).isVisible());
      assert(await mosaic.locator('.mosaic-tile').evaluateAll(tiles => tiles.every(tile => {
        const field = tile.parentElement.getBoundingClientRect(), r = tile.getBoundingClientRect();
        return r.left >= field.left - 1 && r.right <= field.right + 1 && r.top >= field.top - 1 && r.bottom <= field.bottom + 1;
      })), 'Tiles stay inside their field');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      assert.equal(await mosaic.locator('.mosaic-tile').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s', 'Reduced motion removes tile animation');
      const a11y = await new AxeBuilder({ page }).include('.housing-mosaic').analyze();
      assert.deepEqual(a11y.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], 'Mosaic accessibility');
      if (path === '/nj/somerset-county') await mosaic.screenshot({ path: `/tmp/mosaic-${width}-${theme}.png` });
      await page.emulateMedia({ media: 'print' });
      assert.equal(await mosaic.evaluate(el => getComputedStyle(el).display), 'none', 'Print does not add decorative height');
      await page.emulateMedia({ media: 'screen' });
      console.log(`${width} ${theme} ${path}: passed`);
    }
    assert.deepEqual(errors, [], 'No browser errors');
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  await page.goto(origin + '/nj/somerset-county', { waitUntil: 'networkidle' });
  const tile = page.locator('.mosaic-tile').first();
  const original = await tile.getAttribute('style');
  await page.getByRole('button', { name: 'Housing age', exact: true }).click();
  assert.notEqual(await tile.getAttribute('style'), original, 'Switching rearranges tile identities');
  assert(await tile.evaluate(el => getComputedStyle(el).transitionDuration.includes('0.7s')), 'Normal motion animates rearrangement');
  await page.waitForTimeout(800);
  await page.locator('.mosaic-tile[data-group="3"]').first().hover();
  assert.equal(await page.locator('.mosaic-legend button').last().getAttribute('aria-pressed'), 'true', 'Hover reveals its group');
  await page.close();
} finally {
  await browser.close();
}
