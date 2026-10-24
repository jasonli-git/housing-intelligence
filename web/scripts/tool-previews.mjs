import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// UI samples, not property listings or publisher screenshots. Use only our own
// rendered interfaces and public aggregate figures; never capture a parcel address.
export const TOOL_PREVIEWS = [
  { name: 'budget-explorer', path: '/afford?income=110000', selector: '.budget-explorer', ready: '.budget-headline strong' },
  { name: 'buyers-guide', path: '/guide?place=224', selector: '.guide-answers', ready: '.decision-guide[data-ready="true"]', income: true },
  { name: 'tax-lookup', path: '/tax', selector: '.tax-lookup', ready: '.tax-search-field input:not(:disabled)' },
  { name: 'compare', path: '/compare?places=224,394,85', selector: '.compare-scroll', ready: '.compare-table tbody tr' },
  { name: 'housing-help', path: '/help', selector: '.housing-assistance', ready: '.help-routes' },
  { name: 'atlas', path: '/atlas?level=county', selector: '.housing-atlas', ready: '.atlas-county-map path[data-county]', wide: true },
];

export async function captureToolPreviews(browser, { origin, outDir }) {
  await mkdir(resolve(outDir, 'tools'), { recursive: true });
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce', locale: 'en-US' });
    try {
      const page = await context.newPage();
      for (const tool of TOOL_PREVIEWS) {
        await page.setViewportSize({ width: tool.wide ? 1600 : 1100, height: 1000 });
        const response = await page.goto(origin + tool.path, { waitUntil: 'networkidle', timeout: 90_000 });
        if (!response?.ok()) throw new Error(`${tool.path}: ${response?.status() ?? 'no response'}`);
        await page.locator(tool.ready).first().waitFor({ timeout: 30_000 });
        if (tool.income) await page.getByLabel('Household income a year, before tax', { exact: true }).fill('110000');
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}.bar{visibility:hidden!important}nextjs-portal{visibility:hidden!important}' });
        const target = page.locator(tool.selector).first();
        await target.scrollIntoViewIfNeeded();
        const box = await target.boundingBox();
        if (!box || box.width < 100 || box.height < 80) throw new Error(`${tool.name}: no usable preview content`);
        await page.screenshot({ path: resolve(outDir, 'tools', `${tool.name}-${scheme}.jpg`), type: 'jpeg', quality: 82, fullPage: true,
          clip: { x: box.x, y: box.y + await page.evaluate(() => scrollY), width: box.width, height: Math.min(box.height, Math.round(box.width * .625)) } });
        console.log(`screenshot: tools/${tool.name}-${scheme}`);
      }
    } finally { await context.close(); }
  }
}
