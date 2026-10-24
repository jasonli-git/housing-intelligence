import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.SITE_URL ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin);
    await page.evaluate((theme) => document.documentElement.dataset.theme = theme, theme);
    await page.evaluate(() => document.fonts.ready);
    const tools = page.getByRole('region', { name: 'Tools', exact: true });
    await tools.scrollIntoViewIfNeeded();
    const links = tools.locator('a[data-tool]');
    assert.deepEqual(await links.evaluateAll((a) => a.map((e) => e.getAttribute('href'))), ['/afford', '/guide', '/tax', '/compare', '/help', '/atlas']);
    await tools.locator('img').evaluateAll(async (images) => {
      await Promise.all(images.map(async (img) => { img.loading = 'eager'; await img.decode(); }));
    });
    assert.equal(await tools.locator('img').count(), 12);
    assert.equal(await tools.locator('img:visible').count(), 6);
    assert(await tools.locator('img').evaluateAll((images) => images.every((img) => img.naturalWidth === 1440 && img.naturalHeight === 900 && getComputedStyle(img).objectFit === 'contain')), 'normal viewport screenshots shown without additional cropping');
    assert(await tools.locator(`.shot-${theme}`).evaluateAll((images) => images.every((img) => getComputedStyle(img).display !== 'none' && img.naturalWidth > 100)));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal page overflow');
    const columns = await tools.locator('ul').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(columns, width > 1000 ? 3 : 2);
    await links.first().focus();
    assert(await links.first().evaluate((el) => el.matches(':focus-visible')));
    await links.first().evaluate((el) => el.blur());
    const figures = page.getByRole('region', { name: 'United States housing figures' });
    assert.equal(await page.getByRole('heading', { name: 'The national backdrop', exact: true }).count(), 0);
    assert.equal(await figures.locator('svg[role="img"]').count(), 2);
    assert.equal(await figures.locator('a[href^="https://"]').count(), 2);
    assert((await figures.innerText()).includes('Historical figures, not forecasts.'));
    const sizes = await figures.locator('.national-benchmark').evaluateAll((cards) => cards.map((card) => {
      const box = card.getBoundingClientRect(), definition = card.querySelector('.national-benchmark-definition').getBoundingClientRect(), caption = card.querySelector('figcaption').getBoundingClientRect();
      return { height: box.height, textGap: caption.top - definition.bottom };
    }));
    assert(sizes.every((s) => s.height <= (width > 760 ? 260 : 240)), JSON.stringify(sizes));
    assert(sizes.every((s) => s.textGap >= 0), `no definition/caption overlap: ${JSON.stringify(sizes)}`);
    const audit = await new AxeBuilder({ page }).include('.home-tools').include('.national-backdrop').analyze();
    assert.deepEqual(audit.violations.map((v) => v.id), []);
    await tools.screenshot({ path: `/tmp/home-tools-${width}-${theme}.png` });
    await figures.screenshot({ path: `/tmp/home-figures-${width}-${theme}.png` });
    console.log(`${width}/${theme}: tool captures, themes, columns, focus, metrics, sources, no clipping and axe passed. Heights: ${sizes.map((s) => Math.round(s.height)).join(', ')}; national panel: ${Math.round((await figures.boundingBox()).height)}px`);
    assert.deepEqual(errors, []);
    if ((width === 1440 && theme === 'light') || (width === 390 && theme === 'dark')) {
      for (const path of ['/afford', '/guide', '/tax', '/compare', '/help', '/atlas']) {
        await page.locator(`.home-tools a[href="${path}"]`).click();
        await page.waitForURL((url) => url.pathname === path);
        await page.locator('main h1').waitFor();
        await page.goBack();
      }
      console.log(`${width}/${theme}: all six preview cards open their tools and back navigation works`);
    }
    await context.close();
  }
} finally { await browser.close(); }
