import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch();
try {
  for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('http://localhost:3002/states/new-jersey', { waitUntil: 'networkidle' });
    const cabinet = page.locator('.county-cabinet');
    assert.equal(await page.locator('.place-discovery').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    const files = cabinet.locator('.cabinet-file');
    assert.equal(await files.count(), 21);
    await files.first().focus();
    await page.keyboard.press('End');
    assert.equal(await files.last().getAttribute('aria-pressed'), 'true');
    assert.equal(await cabinet.locator('.cabinet-open').getAttribute('href'), '/nj/warren-county');
    await page.keyboard.press('Home');
    assert.equal(await files.first().getAttribute('aria-pressed'), 'true');
    if (width > 700) {
      await files.nth(1).hover();
      assert.equal(await files.nth(1).getAttribute('aria-pressed'), 'true');
    }
    await cabinet.getByRole('button', { name: 'All counties', exact: true }).click();
    assert.equal(await cabinet.getByRole('navigation', { name: 'All counties' }).getByRole('link').count(), 21);
    await cabinet.getByRole('button', { name: 'Folder view', exact: true }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const result = await new AxeBuilder({ page }).include('.place-first-workspace').analyze();
    assert.deepEqual(result.violations.map(v => v.id), []);
    await page.locator('.place-first-workspace').screenshot({ path: `/tmp/county-cabinet-${width}-${theme}.png` });
    await page.getByRole('button', { name:'Compare counties', exact:true }).click();
    assert(await page.locator('#state-compare-panel').isVisible());
    await page.getByRole('button', { name:'Explore places', exact:true }).click();
    assert(await cabinet.isVisible());
    console.log(width, theme, 'passed');
    await context.close();
  }
} finally { await browser.close(); }
