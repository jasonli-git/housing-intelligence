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
    for (const path of ['/states/new-jersey']) {
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      const mosaic = page.locator('.housing-mosaic');
      assert.equal(await mosaic.count(), 1, path + ' has a mosaic');
      assert.equal(await mosaic.locator('.mosaic-tile').count(), 100);
      assert.equal(await mosaic.locator('.mosaic-views button').count(), 2);
      assert(await mosaic.getByText(/reported new homes finished ·/).isVisible());
      assert(await mosaic.locator('.mosaic-source').getByText(/Reporting towns only/).isVisible());
      assert.equal(await page.locator('.state-extra-figures .homes-added, .state-extra-figures .home-sales').count(), 0);
      assert.equal(await page.locator('.state-market-exhibits > .learning-exhibit').count(), 2);
      assert(await page.locator('#nj-explore').evaluate(el => el.nextElementSibling?.id === 'state-market-exhibits'), 'Sales and building exhibits follow Find your place');
      assert(await page.locator('#state-market-exhibits #sales-heading').isVisible());
      assert(await page.locator('#state-market-exhibits #homes-added-heading').isVisible());
      assert(await page.getByRole('combobox', { name: 'Jump to section' }).locator('option').evaluateAll(items => items.some(i => i.textContent === 'Housing mosaic')));
      await mosaic.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => scrollY);
      await mosaic.getByRole('button', { name: 'Purchase loans', exact: true }).click();
      assert(await mosaic.getByText(/reported home-purchase loans ·/).isVisible());
      assert(await mosaic.locator('.mosaic-source').getByText(/cash buyers and non-reporting lenders are excluded/).isVisible());
      assert(!await mosaic.locator('.mosaic-selected').textContent().then(t => t.includes('90% margin')), 'Record shares do not pretend to have survey margins');
      assert(Math.abs(await page.evaluate(() => scrollY) - before) < 2, 'View switching does not jump the page');
      const groupButtons = mosaic.locator('.mosaic-legend button');
      assert.equal(await groupButtons.count(), 4);
      await groupButtons.last().focus();
      await page.keyboard.press('Enter');
      assert.equal(await groupButtons.last().getAttribute('aria-pressed'), 'true');
      assert(await mosaic.locator('.mosaic-selected').getByText('Other', { exact: true }).isVisible());
      assert(await mosaic.locator('.mosaic-tile').evaluateAll(tiles => tiles.every(tile => {
        const field = tile.parentElement.getBoundingClientRect(), r = tile.getBoundingClientRect();
        return r.left >= field.left - 1 && r.right <= field.right + 1 && r.top >= field.top - 1 && r.bottom <= field.bottom + 1;
      })), 'Tiles stay inside their field');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      assert.equal(await mosaic.locator('.mosaic-tile').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s', 'Reduced motion removes tile animation');
      const a11y = await new AxeBuilder({ page }).include('.housing-mosaic').analyze();
      assert.deepEqual(a11y.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], 'Mosaic accessibility');
      await mosaic.screenshot({ path: `/tmp/mosaic-${width}-${theme}.png` });
      await page.emulateMedia({ media: 'print' });
      assert.equal(await mosaic.evaluate(el => getComputedStyle(el).display), 'none', 'Print does not add decorative height');
      await page.emulateMedia({ media: 'screen' });
      console.log(`${width} ${theme} ${path}: passed`);
    }
    assert.deepEqual(errors, [], 'No browser errors');
    for (const path of ['/', '/nj/somerset-county', '/nj/princeton', '/regions/2842']) {
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.housing-mosaic').count(), 0, 'Mosaic is state-only: ' + path);
    }
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  await page.goto(origin + '/states/new-jersey', { waitUntil: 'networkidle' });
  const tile = page.locator('.mosaic-tile').first();
  const original = await tile.getAttribute('style');
  await page.getByRole('button', { name: 'Purchase loans', exact: true }).click();
  assert.notEqual(await tile.getAttribute('style'), original, 'Switching rearranges tile identities');
  assert(await tile.evaluate(el => getComputedStyle(el).transitionDuration.includes('0.7s')), 'Normal motion animates rearrangement');
  await page.waitForTimeout(800);
  await page.locator('.mosaic-tile[data-group="1"]').first().hover();
  assert.equal(await page.locator('.mosaic-legend button').nth(1).getAttribute('aria-pressed'), 'true', 'Hover reveals its group');
  await page.close();
} finally {
  await browser.close();
}
