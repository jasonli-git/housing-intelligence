import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch();
try {
  for (const width of [320, 390, 814, 1243]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion:'reduce' });
    const page = await context.newPage();
    await page.goto('http://localhost:3002/guide?place=224#guide-checks-heading');
    await page.locator('#guide-check-tax').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.guide-check').count(), 10);
    assert.equal(await page.locator('#guide-panel-2 .guide-supporting-evidence').count(), 0);
    assert.equal(await page.locator('.guide-check-evidence > p').count(), 10);
    assert.equal(await page.locator('.guide-check-detail:not([open])').count(), 10);
    const link = page.locator('.guide-check-index a').first();
    assert(await link.evaluate(n => {
      const probe = document.createElement('span'); probe.style.color = 'var(--atlas-ink)'; n.append(probe);
      const match = getComputedStyle(n).color === getComputedStyle(probe).color; probe.remove(); return match;
    }));
    await page.locator('#guide-check-tax .guide-check-detail > summary').click();
    assert(await page.locator('#guide-check-tax .guide-check-detail').evaluate(n => n.open));
    const checksAudit = await new AxeBuilder({ page }).include('#guide-panel-2').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(checksAudit.violations.map(v => ({id:v.id, targets:v.nodes.map(n=>n.target)})), []);
    await page.locator('.guide-step-selector button').first().click();
    const arrows = page.locator('.guide-side-arrow');
    for (const arrow of await arrows.all()) assert(await arrow.evaluate(n => {
      const a = n.getBoundingClientRect(), b = n.firstElementChild.getBoundingClientRect();
      return Math.abs((a.left+a.width/2)-(b.left+b.width/2)) < 1;
    }));
    await page.locator('.guide-side-next').click();
    assert.equal(await page.locator('#guide-panel-1').getAttribute('data-active'), 'true');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v => ({id:v.id, targets:v.nodes.map(n=>n.target)})), []);
    await page.screenshot({ path: `/tmp/guide-checks-${width}-${theme}.png` });
    console.log(`PASS ${width} ${theme}: combined checks, link color, disclosure, arrows, reflow, axe`);
    await context.close();
  }
} finally { await browser.close(); }
