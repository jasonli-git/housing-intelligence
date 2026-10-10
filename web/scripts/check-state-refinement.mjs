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
      assert.equal(await page.locator('.state-fit-shortcut').getAttribute('href'), '/afford?county=all');
      assert.match(await page.locator('.state-fit-shortcut').textContent(), /Across New Jersey/);
      assert.equal(await page.locator('.place-discovery .state-fit-shortcut, .place-budget-link').count(), 0);
      assert.equal(await page.locator('.state-facts article').count(), 3);
      assert.match(await page.locator('.state-facts').textContent(), /National average, not a local rate/);
      assert.match(await page.locator('.state-facts').textContent(), /reporting towns only/);
      assert.equal(await page.locator('.foot-notices').isVisible(), true);
      await page.getByRole('button', { name: 'Compare counties', exact: true }).click();
      assert.equal(await page.locator('#state-explore-panel').isVisible(), false);
      assert.equal(await page.locator('#state-compare-panel').isVisible(), true);
      await page.waitForFunction(() => [...document.querySelectorAll('.section-jump option')].some(n => n.textContent === 'Compare counties'));
      const measure = page.locator('#county-comparison select').first();
      const options = await measure.locator('option').evaluateAll(nodes => nodes.map(n => n.value));
      if (options.length > 1) await measure.selectOption(options[1]);
      const changeWindow = page.locator('#county-comparison select').last();
      await changeWindow.selectOption('since_2019');
      assert.equal(await page.locator('.state-discovery-intro .window-aside').isVisible(), true);
      assert.match(await page.locator('.state-discovery-intro .window-aside').textContent(), /before COVID/);
      const noteBox = await page.locator('.state-discovery-intro .window-aside').boundingBox();
      const controlsBox = await page.locator('.place-comparison-controls').boundingBox();
      const introBox = await page.locator('.comparison-intro').boundingBox();
      assert.ok(noteBox.y + noteBox.height <= controlsBox.y);
      assert.ok(Math.abs(controlsBox.width - introBox.width) < 2);
      if (width > 800) {
        const modesBox = await page.locator('.state-discovery-modes').boundingBox();
        assert.ok(Math.abs(noteBox.y - modesBox.y) < 2);
        assert.ok(noteBox.x > modesBox.x + modesBox.width);
      }
      assert.equal(await page.locator('#county-comparison > .place-comparison-body > .meta').filter({ hasText: 'before COVID' }).count(), 0);
      await page.getByRole('button', { name: 'Explore places', exact: true }).click();
      assert.equal(await page.locator('.place-county-grid').isVisible(), true);
      await page.waitForFunction(() => ![...document.querySelectorAll('.section-jump option')].some(n => n.textContent === 'Compare counties'));
      await page.getByRole('button', { name: 'Compare counties', exact: true }).click();
      if (options.length > 1) assert.equal(await measure.inputValue(), options[1]);
      assert.equal(await page.locator('#state-detailed-data .housing-assistance, #state-detailed-data .homes-added, #state-detailed-data .how-unusual, #state-detailed-data .section.sales:not(.mortgage-lending):not(.getting-around)').count(), 0);
      assert.equal(await page.locator('#housing-assistance .state-help-links a').count(), 3);
      assert.equal(await page.locator('.history-exhibit .persistence-history').isVisible(), true);
      assert.equal(await page.locator('#housing-assistance > details').count(), 1);
      for (const selector of ['.state-extra-figures', '.state-extra-market > details', '.state-help-details', '#state-detailed-data']) {
        const details = page.locator(selector);
        for (let i = 0; i < await details.count(); i++) {
          await details.nth(i).locator(':scope > summary').focus();
          await page.keyboard.press('Enter');
          assert.equal(await details.nth(i).getAttribute('open'), '');
        }
      }
      assert.ok(await page.locator('#county-comparison tbody tr').count() > 0);
      assert.equal(await page.locator('.state-supporting-context > details').count(), 3);
      const contextDetails = page.locator('.state-supporting-context > details');
      for (let i = 0; i < await contextDetails.count(); i++) await contextDetails.nth(i).locator(':scope > summary').click();
      assert.equal(await page.locator('.work-destinations tbody tr').count(), 10);
      assert.match(await page.locator('.state-broadband').textContent(), /not households or people/);
      assert.match(await page.locator('.mortgage-lending').textContent(), /not.*qualify/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.deepEqual(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) })), []);
      assert.deepEqual(errors, []);
      await page.evaluate(() => document.querySelectorAll('main details[open]').forEach(n => n.removeAttribute('open')));
      await page.getByRole('button', { name: 'Explore places', exact: true }).click();
      await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `/tmp/nj-refined-${width}-${theme}.png`, fullPage: true });
      await page.screenshot({ path: `/tmp/nj-refined-viewport-${width}-${theme}.png` });
      console.log(`PASS ${width}px ${theme}: directory, scope, caveats, disclosures, reflow and WCAG`);
      await context.close();
    }
  }
} finally { await browser.close(); }
