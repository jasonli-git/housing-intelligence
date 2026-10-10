import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch();
try {
  for (const width of [1280, 768, 390, 320]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await context.newPage();
      await page.goto(`${process.env.A11Y_ORIGIN ?? 'http://localhost:3002'}/afford?county=all`, { waitUntil: 'networkidle' });
      const mobile = width <= 1000;
      const links = page.locator(mobile ? '.bar-tool-menu .bar-controls' : '.bar-desktop-tools');
      if (mobile) {
        assert.equal(await links.isVisible(), false);
        await page.locator('.bar-tool-menu summary').focus();
        await page.keyboard.press('Enter');
      }
      assert.equal(await links.isVisible(), true);
      assert.deepEqual(await links.locator('a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href'))), ['/afford?county=all', '/guide', '/tax']);
      assert.equal(await links.locator('[aria-current="page"]').count(), 1);
      await links.locator('a').first().focus();
      assert.equal(await links.locator('a').first().evaluate(n => n === document.activeElement), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.deepEqual(results.violations.map(v => v.id), []);
      await page.screenshot({ path: `/tmp/tool-nav-${width}-${theme}.png` });
      if (mobile) {
        await page.locator('.bar-tool-menu summary').click();
        assert.equal(await links.isVisible(), false);
      }
      console.log(`PASS ${width}px ${theme}: tool order, current page, keyboard, reflow and WCAG`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
