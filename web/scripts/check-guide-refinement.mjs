import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.A11Y_ORIGIN ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  for (const width of [1280, 390, 320]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/guide`, { waitUntil: 'networkidle' });
      await page.locator('.guide-question-tagline').waitFor();
      assert.equal(await page.locator('.guide-question-tagline li').count(), 3, 'All questions preview next to the title');
      assert(await page.locator('.guide-page .page-title').evaluate(n => {
        const probe = document.createElement('span'); probe.style.color = 'var(--atlas-ink)'; n.append(probe);
        const same = getComputedStyle(probe).color === getComputedStyle(n).color; probe.remove(); return same;
      }), 'Guide title uses its own ink rather than the generic orange tool ink');
      assert(await page.locator('.guide-page > .page-head').evaluate(n => {
        const probe = document.createElement('span'); probe.style.color = 'var(--atlas-accent)'; n.append(probe);
        const same = getComputedStyle(probe).color === getComputedStyle(n).borderTopColor; probe.remove(); return same;
      }), 'Guide navigation rule uses the matching accent');
      assert.equal(await page.locator('.guide-household').isVisible(), false, 'Household setup waits for a place');
      assert.equal(await page.locator('.guide-answer').first().isVisible(), false, 'No duplicate empty answer blocks below setup');
      assert(await page.locator('.crumbs li[data-level="nation"] a').evaluate(n => {
        const probe = document.createElement('span'); probe.style.color = 'var(--text-primary)'; n.append(probe);
        const same = getComputedStyle(probe).color === getComputedStyle(n).color; probe.remove(); return same;
      }), 'United States uses the neutral navigation colour');
      const heading = await page.locator('#guide-afford-heading').elementHandle();
      const picker = page.locator('.guide-picker input');
      await picker.fill('Somerset');
      await page.getByRole('option').filter({ hasText: 'Somerset County' }).first().click();
      await page.locator('.guide-answer[data-ready="true"]').first().waitFor({ timeout: 30000 });
      assert(await heading.evaluate(n => n === document.querySelector('#guide-afford-heading')), 'Question heading stays in place when its answer expands');
      assert.equal(await page.locator('.guide-preview').count(), 0);
      await page.getByLabel('Yearly household income, before tax', { exact: true }).fill('120000');
      await page.locator('.guide-lead').first().waitFor();
      assert.equal(await page.locator('#guide-rent-heading').count(), 1);
      assert.equal(await page.locator('#guide-checks-heading').count(), 1);
      assert(await page.locator('.guide-check').count() > 0, 'Pre-offer checks retained');
      await page.locator('.guide-about summary').click();
      await page.locator('.evidence summary').first().click();
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      assert.deepEqual(audit.violations, [], `${width} ${theme}: axe violations`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      assert.deepEqual(errors, [], 'No application errors');
      await page.screenshot({ path: `/tmp/guide-${width}-${theme}.png`, fullPage: true });
      console.log(`PASS: guide ${width}px ${theme}: place search, income answer, comparison/checklist, expanded evidence, axe and reflow`);
      await context.close();
    }
  }
} finally { await browser.close(); }
