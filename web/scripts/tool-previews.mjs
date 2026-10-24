import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// UI samples, not property listings or publisher screenshots. Use only our own
// rendered interfaces and public aggregate figures; never capture a parcel address.
export const TOOL_PREVIEWS = [
  { name: 'budget-explorer', path: '/afford?income=110000', ready: '.budget-headline strong' },
  { name: 'buyers-guide', path: '/guide?place=224', ready: '.decision-guide[data-ready="true"]', income: true },
  { name: 'tax-lookup', path: '/tax', ready: '.tax-search-field input:not(:disabled)' },
  { name: 'compare', path: '/compare?places=224,394,85', ready: '.compare-table tbody tr' },
  { name: 'housing-help', path: '/help', ready: '.help-routes' },
  { name: 'atlas', path: '/atlas?level=county', ready: '.atlas-county-map path[data-county]' },
];

export async function captureToolPreviews(browser, { origin, outDir }) {
  await mkdir(resolve(outDir, 'tools'), { recursive: true });
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce', locale: 'en-US' });
    try {
      const page = await context.newPage();
      for (const tool of TOOL_PREVIEWS) {
        const response = await page.goto(origin + tool.path, { waitUntil: 'networkidle', timeout: 90_000 });
        if (!response?.ok()) throw new Error(`${tool.path}: ${response?.status() ?? 'no response'}`);
        await page.locator(tool.ready).first().waitFor({ timeout: 30_000 });
        if (tool.income) await page.getByLabel('Household income a year, before tax', { exact: true }).fill('110000');
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}nextjs-portal{visibility:hidden!important}' });
        // Show the ordinary first screen, including navigation and title. Filling
        // sample inputs can scroll them into view, so restore the top afterwards.
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await page.screenshot({ path: resolve(outDir, 'tools', `${tool.name}-${scheme}.jpg`), type: 'jpeg', quality: 82, fullPage: false });
        console.log(`screenshot: tools/${tool.name}-${scheme}`);
      }
    } finally { await context.close(); }
  }
}
