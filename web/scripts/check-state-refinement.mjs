import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch();
try {
  for (const width of [1280, 390, 320]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.A11Y_ORIGIN ?? 'http://localhost:3002'}/states/new-jersey`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.nj-atlas-entry').count(), 0);
      assert.equal(await page.locator('.place-county-grid a').count(), 21);
      assert.equal(await page.locator('#county-directory-heading').textContent(), 'Explore 21 counties');
      assert.equal(await page.locator('.place-budget-link').getAttribute('href'), '/afford?county=all');
      assert.match(await page.locator('.place-budget-link').textContent(), /Across New Jersey/);
      assert.equal(await page.locator('.state-facts article').count(), 3);
      assert.match(await page.locator('.state-facts').textContent(), /National average, not a local rate/);
      assert.match(await page.locator('.state-facts').textContent(), /reporting towns only/);
      assert.equal(await page.locator('.foot-notices').isVisible(), true);
      for (const selector of ['.state-extra-figures', '#county-comparison', '#state-detailed-data']) {
        await page.locator(`${selector} > summary`).focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator(selector).getAttribute('open'), '');
      }
      assert.ok(await page.locator('#county-comparison tbody tr').count() > 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.deepEqual(results.violations.map(v => v.id), []);
      assert.deepEqual(errors, []);
      for (const selector of ['.state-extra-figures', '#county-comparison', '#state-detailed-data']) {
        await page.locator(`${selector} > summary`).click();
      }
      await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: `/tmp/nj-refined-${width}-${theme}.png`, fullPage: true });
      await page.screenshot({ path: `/tmp/nj-refined-viewport-${width}-${theme}.png` });
      console.log(`PASS ${width}px ${theme}: directory, scope, caveats, disclosures, reflow and WCAG`);
      await context.close();
    }
  }
} finally { await browser.close(); }
