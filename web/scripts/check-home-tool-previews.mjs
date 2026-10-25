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
    const track = tools.locator('.home-tools-track');
    const rail = tools.locator('.home-tools-rail');
    assert(await track.evaluate((el) => el.scrollWidth > el.clientWidth + 4), 'tools scroll inside their row');
    assert.equal(await track.locator('li').evaluateAll((items) => new Set(items.map((li) => Math.round(li.getBoundingClientRect().top))).size), 1, 'all tools stay in one row');
    const next = tools.getByRole('button', { name: 'Next tools' });
    const previous = tools.getByRole('button', { name: 'Previous tools' });
    await rail.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    assert.equal(await next.evaluate((el) => getComputedStyle(el).opacity), '0');
    await rail.hover();
    assert.equal(await next.evaluate((el) => getComputedStyle(el).opacity), '1');
    assert.equal(await previous.isDisabled(), true);
    const arrowBox = await next.boundingBox(), imageBox = await tools.locator('.home-tool-preview').first().boundingBox();
    assert.equal(Math.round(arrowBox.height), 160);
    assert(Math.abs(arrowBox.y + arrowBox.height / 2 - imageBox.y - imageBox.height / 2) <= 2, 'controls centered on screenshots');
    await next.click();
    await page.waitForFunction(() => document.querySelector('#home-tools-track').scrollLeft > 4 && !document.querySelector('.home-tools-previous').disabled);
    await previous.click();
    await page.waitForFunction(() => document.querySelector('#home-tools-track').scrollLeft <= 4);
    await page.mouse.move(0, 0);
    await links.first().focus();
    await page.keyboard.press('ArrowLeft');
    assert(await links.first().evaluate((el) => el.matches(':focus-visible')));
    assert.equal(await next.evaluate((el) => getComputedStyle(el).opacity), '1', 'keyboard access reveals controls');
    await page.keyboard.press('ArrowRight');
    assert(await links.nth(1).evaluate((el) => document.activeElement === el));
    await page.keyboard.press('End');
    assert(await links.last().evaluate((el) => document.activeElement === el));
    await page.waitForFunction(() => document.querySelector('.home-tools-next').disabled);
    await page.keyboard.press('Home');
    assert(await links.first().evaluate((el) => document.activeElement === el));
    await page.waitForFunction(() => document.querySelector('.home-tools-previous').disabled);
    await links.first().evaluate((el) => el.blur());
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
    await figures.locator('summary').click();
    assert.equal(await figures.locator('svg[role="img"]:visible').count(), 8, 'every history opens');
    assert((await figures.innerText()).includes('Historical figures, not forecasts.'));
    const audit = await new AxeBuilder({ page }).include('.home-tools').include('.national-strip').analyze();
    assert.deepEqual(audit.violations.map((v) => v.id), []);
    await figures.locator('summary').click();
    await tools.screenshot({ path: `/tmp/home-tools-${width}-${theme}.png` });
    await figures.screenshot({ path: `/tmp/home-figures-${width}-${theme}.png` });
    console.log(`${width}/${theme}: tool captures, themes, rail controls, keyboard, US market strip, sources, histories and axe passed`);
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
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await touch.newPage();
  await page.goto(origin);
  const next = page.getByRole('button', { name: 'Next tools' });
  await next.scrollIntoViewIfNeeded();
  assert.equal(await next.evaluate((el) => getComputedStyle(el).opacity), '1', 'touch controls available without hover');
  await next.tap();
  await page.waitForFunction(() => document.querySelector('#home-tools-track').scrollLeft > 4);
  await touch.close();
  console.log('Tools touch controls visible and tappable without hover');
  const motion = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const motionPage = await motion.newPage();
  await motionPage.goto(origin);
  const stage = motionPage.locator('.home-tools-rail'), forward = motionPage.getByRole('button', { name: 'Next tools' });
  await stage.scrollIntoViewIfNeeded();
  assert((await forward.evaluate((el) => getComputedStyle(el).transitionDuration)).includes('0.18s'));
  await stage.hover();
  await motionPage.waitForFunction(() => getComputedStyle(document.querySelector('.home-tools-next')).opacity === '1');
  await motionPage.mouse.move(0, 0);
  await motionPage.waitForFunction(() => getComputedStyle(document.querySelector('.home-tools-next')).opacity === '0');
  await motionPage.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await forward.evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
  await motionPage.emulateMedia({ media: 'print' });
  assert.equal(await motionPage.locator('.national-score-trend:visible').count(), 0, 'background-only charts do not alter printed layout');
  await motion.close();
  console.log('Tools 180ms hover fade and reduced-motion suppression passed');
} finally { await browser.close(); }
