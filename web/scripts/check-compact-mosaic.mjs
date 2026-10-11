import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch();
try {
  for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('http://localhost:3002/states/new-jersey', { waitUntil: 'networkidle' });
    const mosaic = page.locator('.mosaic-embedded');
    assert.equal(await mosaic.locator('.mosaic-tile').count(), 100);
    assert.equal(await mosaic.locator('.mosaic-source, .mosaic-caption').count(), 1);
    for (const view of await mosaic.locator('.mosaic-views button').all()) {
      await view.click();
      assert.equal(await view.getAttribute('aria-pressed'), 'true');
      for (const group of await mosaic.locator('.mosaic-legend button').all()) {
        await group.click();
        assert.equal(await group.getAttribute('aria-pressed'), 'true');
        assert((await group.boundingBox()).height >= 44);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      console.log(width, theme, await view.textContent(), Math.round((await mosaic.boundingBox()).height));
    }
    await mosaic.screenshot({ path: `/tmp/compact-mosaic-${width}-${theme}.png` });
    await page.close();
  }
} finally { await browser.close(); }
