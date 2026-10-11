import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('http://localhost:3002/nj/somerset-county', { waitUntil: 'networkidle' });
    await page.locator('.cost-yours > summary').click();
    const bill = page.locator('.monthly-bill');
    const baseline = await bill.locator('.bill-head > div:last-child > small').textContent();
    const total = async () => Number((await bill.locator('.bill-head strong').textContent()).split('/')[0].replace(/[^\d.]/g, ''));
    const start = await total();
    await page.getByLabel('HOA or condo fees a month', { exact: true }).fill('250');
    assert.equal(await total() - start, 250);
    await page.getByLabel('Flood insurance a year', { exact: true }).fill('1200');
    assert.equal(await total() - start, 350, 'Yearly input becomes monthly, once');
    assert.equal(await bill.locator('.bill-head > div:last-child > small').textContent(), baseline);
    await bill.locator('[data-cost="flood"]').click();
    assert((await bill.locator('.bill-reading').textContent()).includes('Your input.'));
    await bill.locator('[data-cost="mortgage"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await bill.locator('[data-cost="mortgage"]').getAttribute('aria-pressed'), 'true');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
    const a11y = await new AxeBuilder({ page }).include('.monthly-bill').analyze();
    assert.deepEqual(a11y.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []);
    await bill.screenshot({ path: `/tmp/monthly-bill-${width}-${theme}.png` });
    await page.emulateMedia({ media: 'print' });
    assert.equal(await bill.isVisible(), false, 'Personalisation stays out of print');
    console.log(`${width} ${theme}: passed`);
    await context.close();
  }
} finally { await browser.close(); }
