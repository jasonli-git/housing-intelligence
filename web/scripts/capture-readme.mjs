// The README's screenshots, captured from the build about to ship (ARCHITECTURE #175,
// #393): `make deploy` runs this against dist/site served locally and writes the images
// into dist/artifacts/screenshots/, which the same deploy uploads beside the data. The
// README links to them there, so they are never committed and always show the deployed
// site — refreshed by every deploy, the Friday one included.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.SCREENSHOT_ORIGIN ?? 'http://localhost:3006';
const outDir = resolve(process.env.SCREENSHOT_DIR ?? '../dist/artifacts/screenshots');

// What the README shows: the entry, the state, a county and a town, and the four tools.
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'new-jersey', path: '/states/new-jersey' },
  { name: 'county', path: '/nj/mercer-county' },
  { name: 'town', path: '/nj/princeton' },
  { name: 'budget-explorer', path: '/afford?income=110000' },
  { name: 'buyers-guide', path: '/guide?place=224' },
  { name: 'tax-lookup', path: '/tax' },
  { name: 'atlas', path: '/atlas' },
];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, scale: 1 },
  { name: 'mobile', width: 390, height: 844, scale: 2 },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.scale,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      locale: 'en-US',
    });
    const page = await context.newPage();
    for (const { name, path } of PAGES) {
      const response = await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 90_000 });
      if (!response?.ok()) throw new Error(`${path}: ${response?.status() ?? 'no response'}`);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
      const file = resolve(outDir, `${name}-${viewport.name}.png`);
      await page.screenshot({ path: file, animations: 'disabled', scale: viewport.scale > 1 ? 'device' : 'css' });
      console.log(`screenshot: ${name}-${viewport.name}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
