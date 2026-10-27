// Local pilot only: three selected views, two themes. No place × story export matrix.
import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.SITE_URL ?? 'http://localhost:3002';
const output = resolve(process.env.PLACE_STORY_SHOT_DIR ?? '../dist/artifacts/screenshots/place-stories');
const stories = { market: 'income-and-home-value', commute: 'the-long-commute-premium', water: 'water-you-can-check' };
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const start = performance.now(), files = [];
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 880, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce', locale: 'en-US' });
    for (const [topic, slug] of Object.entries(stories)) {
      const response = await page.goto(`${origin}/stories/${slug}?place=224`, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`${slug}: ${response?.status()}`);
      const shot = page.locator('[data-place-story-focus][data-selected="true"] [data-place-story-shot]');
      await shot.waitFor();
      const fingerprint = await shot.getAttribute('data-place-story-snapshot');
      if (!/^[a-f0-9]{16}$/.test(fingerprint ?? '')) throw new Error(`${slug}: missing snapshot identity`);
      await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: 'nextjs-portal{display:none!important} [data-place-story-shot]{min-height:500px;box-sizing:border-box} *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
      const file = resolve(output, `224-${topic}-${fingerprint}-${theme}.jpg`);
      await shot.screenshot({ path: file, type: 'jpeg', quality: 80, animations: 'disabled' });
      files.push({ topic, theme, fingerprint, bytes: (await stat(file)).size });
    }
    await page.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ files, count: files.length, totalBytes: files.reduce((n, f) => n + f.bytes, 0), elapsedSeconds: Number(((performance.now() - start) / 1000).toFixed(1)) }, null, 2));
