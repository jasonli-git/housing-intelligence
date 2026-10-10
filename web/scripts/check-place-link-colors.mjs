import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch();
try {
  for (const [id, level, colors] of [[12, 'county', ['rgb(36, 107, 85)', 'rgb(166, 217, 192)']], [224, 'municipality', ['rgb(38, 119, 117)', 'rgb(162, 218, 213)']], [2842, 'zip', ['rgb(115, 94, 145)', 'rgb(210, 188, 233)']]]) {
    for (const [index, theme] of ['light', 'dark'].entries()) {
      const context = await browser.newContext({viewport: {width: 390, height: 900}, colorScheme: theme, reducedMotion: 'reduce'});
      const page = await context.newPage();
      await page.goto(`http://localhost:3002/regions/${id}`, {waitUntil: 'networkidle'});
      assert.equal(await page.locator('main').getAttribute('data-region-level'), level);
      const links = page.locator('.home-action-checks a[href^="#"]');
      assert.equal(await links.count(), 2);
      for (const link of await links.all()) assert.equal(await link.evaluate(n => getComputedStyle(n).color), colors[index]);
      const audit = await new AxeBuilder({page}).include('.home-action-checks').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.deepEqual(audit.violations.map(v => v.id), []);
      console.log(`PASS ${level} ${theme}`);
      await context.close();
    }
  }
} finally {await browser.close();}
