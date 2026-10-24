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
    console.log(`${width}/${theme}: tool captures, themes, rail controls, keyboard, metrics, sources, no clipping and axe passed. Heights: ${sizes.map((s) => Math.round(s.height)).join(', ')}; national panel: ${Math.round((await figures.boundingBox()).height)}px`);
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
  await motion.close();
  console.log('Tools 180ms hover fade and reduced-motion suppression passed');
} finally { await browser.close(); }
