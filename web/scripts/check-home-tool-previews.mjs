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
    assert.equal(await tools.getByText('New Jersey coverage', { exact: true }).count(), 1);
    assert.equal(await tools.locator('.home-tool-scope').count(), 0, 'no repeated state badges');
    assert(await links.evaluateAll((links) => links.every((link) => link.getAttribute('aria-describedby') === 'home-tools-coverage')), 'shared coverage stays associated with every tool');
    assert.deepEqual(await links.evaluateAll((a) => a.map((e) => e.getAttribute('href'))), ['/afford', '/guide', '/tax', '/compare', '/help', '/atlas']);
    await tools.locator('img').evaluateAll(async (images) => {
      // Switching lazy images to eager can cancel a transfer in flight; a cancelled
      // load fails `decode()` once, so reload the image and decode again before failing.
      await Promise.all(images.map(async (img) => {
        img.loading = 'eager';
        try { await img.decode(); } catch { img.src = img.currentSrc || img.src; await img.decode(); }
      }));
    });
    assert.equal(await tools.locator('img').count(), 12);
    assert.equal(await tools.locator('img:visible').count(), 6);
    assert(await tools.locator('img').evaluateAll((images) => images.every((img) => img.naturalWidth === 1440 && img.naturalHeight === 900 && getComputedStyle(img).objectFit === 'contain')), 'normal viewport screenshots shown without additional cropping');
    assert(await tools.locator(`.shot-${theme}`).evaluateAll((images) => images.every((img) => getComputedStyle(img).display !== 'none' && img.naturalWidth > 100)));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal page overflow');
    const grid = tools.locator('.home-tools-grid');
    assert(await grid.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'all six tools fit without a horizontal rail');
    const columns = width > 1000 ? 3 : width > 700 ? 2 : 1;
    assert.equal(await grid.locator('li').evaluateAll((items) => new Set(items.map((li) => Math.round(li.getBoundingClientRect().top))).size), 6 / columns, 'tools reflow into complete rows');
    assert.equal(await tools.getByRole('button').count(), 0, 'no carousel controls');
    await links.first().focus();
    assert(await links.first().evaluate((el) => el.matches(':focus-visible')));
    for (let index = 1; index < 6; index++) {
      await page.keyboard.press('Tab');
      assert(await links.nth(index).evaluate((el) => document.activeElement === el), 'ordinary Tab order reaches every tool');
    }
    await links.last().evaluate((el) => el.blur());
    // Milestone 57: the US market strip, eight scoreboard tiles.
    const figures = page.getByRole('region', { name: 'US market' });
    const tiles = figures.locator('.score-tile');
    assert.equal(await tiles.count(), 8, 'eight national tiles');
    assert.equal(await figures.locator('svg[role="img"]:visible').count(), 0, 'histories closed by default');
    assert.equal(await figures.locator('.national-score-trend[aria-hidden="true"]').count(), 8);
    assert.equal(await figures.locator('.score-tile-meta a[href^="https://"]').count(), 8, 'every tile credits its source');
    assert(await tiles.evaluateAll((els) => els.every((el) => el.getBoundingClientRect().height <= 120)), 'tiles stay scoreboard-sized');
    assert(await figures.locator('.score-tile-label, .score-tile-value, .score-tile-meta').evaluateAll((els) => els.every((el) => el.scrollWidth <= el.clientWidth + 1)), 'no clipped tile text');
    assert(await tiles.evaluateAll((els) => els.every((el) => el.querySelector('.visually-hidden').textContent.includes('from a year earlier') || el.querySelector('.visually-hidden').textContent.includes('No comparable reading'))), 'each tile says its change in words');
    if (width > 1180) assert(await tiles.evaluateAll((els) => els.every((el) => Math.abs(el.getBoundingClientRect().top - els[0].getBoundingClientRect().top) < 1)), 'one row on wide screens');
    else assert(await figures.locator('.national-strip-track').evaluate((el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === 'auto'), 'scrolls as a ticker on narrow screens');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page-level horizontal scroll');
    // Takeaways: five pills, closed by default, one open at a time.
    const pills = figures.locator('details.takeaway');
    assert.equal(await pills.count(), 5, 'five takeaways');
    assert.equal(await figures.locator('details.takeaway[open]').count(), 0, 'takeaways closed by default');
    await pills.nth(0).locator('summary').click();
    await pills.nth(1).locator('summary').click();
    assert.equal(await figures.locator('details.takeaway[open]').count(), 1, 'one takeaway open at a time');
    assert((await pills.nth(1).locator('p').innerText()).length > 20, 'an open takeaway shows its figures');
    await pills.nth(1).locator('summary').click();
    await figures.locator('.national-history > summary').click();
    assert.equal(await figures.locator('svg[role="img"]:visible').count(), 8, 'every history opens');
    assert((await figures.innerText()).includes('Historical figures, not forecasts.'));
    const audit = await new AxeBuilder({ page }).include('.home-tools').include('.national-strip').analyze();
    assert.deepEqual(audit.violations.map((v) => v.id), []);
    await figures.locator('.national-history > summary').click();
    await tools.screenshot({ path: `/tmp/home-tools-${width}-${theme}.png` });
    await figures.screenshot({ path: `/tmp/home-figures-${width}-${theme}.png` });
    console.log(`${width}/${theme}: tool captures, themes, responsive grid, keyboard, US market strip, sources, histories and axe passed`);
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
  const motion = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const motionPage = await motion.newPage();
  await motionPage.goto(origin);
  const card = motionPage.locator('.home-tools-grid a').first();
  assert((await card.evaluate((el) => getComputedStyle(el).transitionDuration)).includes('0.16s'));
  await motionPage.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await card.evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
  await motionPage.emulateMedia({ media: 'print' });
  assert.equal(await motionPage.locator('.national-score-trend:visible').count(), 0, 'background-only charts do not alter printed layout');
  await motion.close();
  console.log('Tool focus, border transition and reduced-motion suppression passed');
} finally { await browser.close(); }
