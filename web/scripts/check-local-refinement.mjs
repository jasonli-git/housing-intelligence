import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch();
try {
  for (const id of [12, 224, 54, 51, 2842, 3160]) {
    for (const width of [1280, 390, 320]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${process.env.A11Y_ORIGIN ?? 'http://localhost:3002'}/regions/${id}`, { waitUntil: 'networkidle' });
        assert.equal(await page.locator('#housing-assistance .local-help-links a').count(), 3);
        assert.equal(await page.locator('.quiet-tool-group #housing-assistance, .quiet-tool-group #home-checks-heading').count(), 0);
        assert.equal(await page.locator('.page-head .verdict-details-label').filter({ hasText: 'Did paychecks' }).count(), 0);
        assert.ok(await page.getByRole('link', { name: `Buyer’s guide for`, exact: false }).count() > 0);
        const jump = page.getByRole('combobox', { name: 'Jump to section' });
        await jump.selectOption('#home-checks-heading');
        assert.equal(await page.locator('#home-checks-heading').isVisible(), true);
        assert.match(await page.locator('.home-action-checks').textContent(), /Confirm schools.*Check internet.*Check the commute/);
        assert.equal(await page.locator('.local-next-step-group .community-crime, .local-next-step-group .community-health').count(), 0);
        assert.equal(await page.locator('#local-property-evidence').count(), 1);
        await page.locator('.home-action-checks a[href="#local-property-evidence"]').first().click();
        assert.equal(await page.locator('#local-property-evidence').getAttribute('open'), '');
        assert.equal(await page.locator('#region-detailed-data').getAttribute('open'), '');
        if (id === 12) {
          await page.locator('#county-town-search').fill('Bridgewater');
          assert.equal(await page.locator('.county-town-links a').count(), 1);
          assert.match(await page.locator('.county-town-links a').textContent(), /Bridgewater/);
        } else assert.equal(await page.locator('#county-places').count(), 0);
        await jump.selectOption('#region-detailed-data');
        if (await page.locator('.local-evidence-charts figure').count()) assert.equal(await page.locator('.local-evidence-charts').isVisible(), true);
        await jump.selectOption('#housing-assistance');
        assert.equal(await page.locator('.local-help-links').isVisible(), true);
        for (const detail of await page.locator('main details.quiet-disclosure').all()) await detail.evaluate(n => { n.open = true; });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(errors, []);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        assert.deepEqual(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) })), []);
        if (id === 224 && width === 390 && theme === 'dark') await page.screenshot({ path: '/tmp/local-refined-princeton.png', fullPage: true });
        console.log(`PASS /regions/${id} ${width}px ${theme}`);
        await context.close();
      }
    }
  }
} finally { await browser.close(); }
