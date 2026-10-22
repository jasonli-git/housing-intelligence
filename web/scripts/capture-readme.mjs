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

// What the README shows: the entry, the state, a county and a town, every tool in the bar,
// and the visual stories. Kept in step with the bar's links (Masthead.tsx): three of them
// went unpictured from 2026-10-12 to 2026-10-22.
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'new-jersey', path: '/states/new-jersey' },
  { name: 'county', path: '/nj/mercer-county' },
  { name: 'town', path: '/nj/princeton' },
  { name: 'budget-explorer', path: '/afford?income=110000' },
  { name: 'buyers-guide', path: '/guide?place=224' },
  { name: 'tax-lookup', path: '/tax' },
  { name: 'atlas', path: '/atlas' },
  { name: 'compare', path: '/compare?places=224,394,85' },
  { name: 'housing-help', path: '/help' },
  { name: 'visual-stories', path: '/stories' },
];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, scale: 1 },
  { name: 'mobile', width: 390, height: 844, scale: 2 },
];

// The home page's showcase of the visual stories: the first screenful of each story's
// chart, light and dark, as JPEGs into screenshots/stories/. The list is read from the
// stories index, so a new story is pictured without touching this file.
const SHOT = { width: 820, height: 900, aspect: 0.62, scale: 1 };
const only = process.env.SCREENSHOT_ONLY;

await mkdir(resolve(outDir, 'stories'), { recursive: true });
const browser = await chromium.launch();
try {
  if (only !== 'readme') {
    for (const scheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: SHOT.scale, colorScheme: scheme, reducedMotion: 'reduce', locale: 'en-US' });
      const page = await context.newPage();
      const index = await page.goto(origin + '/stories', { waitUntil: 'networkidle', timeout: 90_000 });
      if (!index?.ok()) throw new Error(`/stories: ${index?.status() ?? 'no response'}`);
      const hrefs = await page.$$eval('.stories-grid a[href^="/stories/"]', (links) => links.map((a) => a.getAttribute('href')));
      for (const href of hrefs) {
        const response = await page.goto(origin + href, { waitUntil: 'networkidle', timeout: 90_000 });
        if (!response?.ok()) throw new Error(`${href}: ${response?.status() ?? 'no response'}`);
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
        const box = await page.locator('[data-story-shot]').first().boundingBox();
        if (!box) throw new Error(`${href}: no [data-story-shot] element`);
        const slug = href.split('/').pop();
        await page.screenshot({
          path: resolve(outDir, 'stories', `${slug}-${scheme}.jpg`),
          type: 'jpeg',
          quality: 78,
          fullPage: true,
          clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, Math.round(box.width * SHOT.aspect)) },
        });
        console.log(`screenshot: stories/${slug}-${scheme}`);
      }
      await context.close();
    }
  }
  for (const viewport of only === 'stories' ? [] : VIEWPORTS) {
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
