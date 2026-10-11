import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ colorScheme: theme, reducedMotion: 'reduce' });
    const town = theme === 'light' ? 'rgb(38, 119, 117)' : 'rgb(162, 218, 213)';
    const county = theme === 'light' ? 'rgb(36, 107, 85)' : 'rgb(166, 217, 192)';
    for (const path of ['/nj/somerset-county', '/states/new-jersey', '/guide?place=224']) {
      await page.goto(`http://localhost:3002${path}`, { waitUntil: 'networkidle' });
      if (path.startsWith('/guide')) await page.getByRole('link', { name: 'Everything published for Princeton' }).waitFor();
      const colors = await page.locator('main a.destination-town, main a.destination-county').evaluateAll(links => links.map(a => ({ name: a.textContent, kind: a.className, color: getComputedStyle(a).color })));
      assert(colors.length > 0, `Missing destination links: ${path}`);
      for (const link of colors) assert.equal(link.color, link.kind.includes('destination-town') ? town : county, `${path}: ${link.name}`);
      console.log(`${theme} ${path}: ${colors.length} destination links passed`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
