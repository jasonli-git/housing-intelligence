import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.SITE_URL ?? 'http://localhost:3002';
const routes = (process.env.FOOTER_ROUTES ?? '/,/states/new-jersey,/nj/somerset-county,/nj/princeton,/nj/zip-08540,/nj/princeton/report,/guide,/tax,/afford,/compare,/help,/atlas,/stories,/freshness,/changes,/missing-footer-check').split(',');
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
    await context.route('**/status.json', (r) => r.fulfill({ status: 404, body: '' }));
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(`${origin}${route}`);
      await page.evaluate((t) => document.documentElement.dataset.theme = t, theme);
      const footer = page.getByRole('navigation', { name: 'Source check status' });
      const link = footer.getByRole('link', { name: 'Source checks scheduled Fridays', exact: true });
      assert.equal(await page.locator('.site-status').count(), 1, 'one universal status link');
      assert.equal(await page.locator('.site-meta-row .site-status').count(), 0);
      const provenance = page.locator('details.footer-provenance');
      assert(await provenance.locator('.foot-title-block').evaluate((el) => {
        const kicker = el.querySelector('.foot-kicker').getBoundingClientRect(), heading = el.querySelector('.foot-label').getBoundingClientRect();
        const separator = el.querySelector('.foot-title-separator');
        return heading.left > kicker.right && heading.top < kicker.bottom && heading.bottom > kicker.top && getComputedStyle(el.querySelector('.foot-label')).fontSize === '18px' && separator.textContent === '·' && separator.getAttribute('aria-hidden') === 'true';
      }), 'Sources sits to the right of Data provenance on the same line');
      assert(await provenance.evaluate((el) => {
        const title = el.querySelector('.foot-title-block').getBoundingClientRect(), publishers = el.querySelector('.foot-brief').getBoundingClientRect(), s = getComputedStyle(el);
        return publishers.top >= title.bottom + 8 && Math.abs(publishers.left - title.left) < 1 && s.borderRadius === '0px' && s.backgroundImage === 'none' && s.boxShadow === 'none';
      }), 'provenance title sits above left-aligned publishers in an open section');
      const publisherCount = await provenance.locator('.brief-item').count();
      assert(await provenance.locator('.brief-item').evaluateAll((items) => items.every((el) => {
        const bounds = el.getBoundingClientRect(), container = el.closest('.foot-brief').getBoundingClientRect();
        return bounds.left >= container.left - 1 && bounds.right <= container.right + 1 && el.scrollWidth <= el.clientWidth + 1;
      })), 'long publisher names wrap instead of clipping');
      const summary = provenance.locator('summary');
      const closedChevron = await summary.locator('.disclose-hint').evaluate((el) => getComputedStyle(el, '::after').transform);
      await summary.hover();
      assert(await summary.evaluate((el) => getComputedStyle(el).boxShadow !== 'none' && getComputedStyle(el.querySelector('.foot-label')).textDecorationLine === 'underline'), 'disclosure row has a subtle hover affordance without changing its background');
      assert(await summary.locator('.disclose-hint').evaluate((el) => getComputedStyle(el, '::after').transitionDuration === '0s'), 'reduced motion disables chevron transition');
      await provenance.locator('summary').focus();
      await page.keyboard.press('Enter');
      assert(await provenance.evaluate((el) => el.open), 'source disclosure opens by keyboard');
      assert.notEqual(await summary.locator('.disclose-hint').evaluate((el) => getComputedStyle(el, '::after').transform), closedChevron, 'chevron reflects open state');
      assert.equal(await provenance.locator('.inst').count(), publisherCount, 'every publisher retained in full disclosure');
      assert(await provenance.locator('.inst-grid').isVisible());
      await page.keyboard.press('Enter');
      assert.equal(await provenance.evaluate((el) => el.open), false);
      assert.deepEqual(await page.locator('.foot-link-list a').evaluateAll((links) => links.map((a) => a.getAttribute('href'))), ['/freshness', '/changes']);
      const notice = page.getByRole('region', { name: 'Code and data terms' });
      assert(await notice.evaluate((el) => {
        const s = getComputedStyle(el);
        return s.outlineStyle === 'none' && s.backgroundImage === 'none' && s.boxShadow === 'none' && s.borderLeftWidth === '0px' && s.borderTopWidth === '1px';
      }), 'notice is a quiet open colophon, not an outlined card');
      assert.equal(await notice.getByRole('navigation', { name: 'Site policies' }).getByRole('link').count(), 3);
      assert(await notice.locator('.foot-notice-head').evaluate((el) => {
        const icon = el.querySelector(':scope > svg').getBoundingClientRect(), title = el.querySelector('a').getBoundingClientRect();
        return getComputedStyle(el.querySelector('a')).fontSize === '32px' && icon.width === 28 && icon.height === 28 && Math.abs(icon.top + icon.height / 2 - title.top - title.height / 2) < 1;
      }), 'prominent yellow heading and shield stay aligned');
      assert(await notice.getByRole('link', { name: 'its source is public', exact: true }).isVisible());
      assert.equal(await link.getAttribute('href'), '/freshness');
      await footer.scrollIntoViewIfNeeded();
      assert(await link.isVisible());
      assert(await footer.locator('.site-status-word').isVisible(), 'scheduled is not hidden on phones');
      assert(await link.evaluate((el) => {
        const s = getComputedStyle(el), box = el.getBoundingClientRect();
        return s.borderTopWidth === '0px' && s.backgroundImage === 'none' && s.backgroundColor === 'rgba(0, 0, 0, 0)' && box.height >= 44 && box.left >= 0 && box.right <= innerWidth;
      }), 'quiet unboxed and tappable link fits the viewport');
      assert(await footer.evaluate((el) => {
        const sourceFooter = document.querySelector('.foot');
        return !sourceFooter || (Boolean(sourceFooter.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) && sourceFooter.getBoundingClientRect().bottom <= el.getBoundingClientRect().top + 1);
      }), 'status follows the complete notice/source/policy footer');
      await link.focus();
      assert(await link.evaluate((el) => el.matches(':focus-visible')));
      const audit = await new AxeBuilder({ page }).include('.site-check-footer').include('.site-meta-row').include('.footer-provenance').include('.footer-colophon').include('.foot-links').analyze();
      assert.deepEqual(audit.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), []);
      await page.emulateMedia({ media: 'print' });
      assert.equal(await footer.isVisible(), false, 'no extra status line in printed reports');
      await page.emulateMedia({ media: 'screen' });
      if (route === '/') {
        await footer.screenshot({ path: `/tmp/source-check-footer-${width}-${theme}.png`, style: 'nextjs-portal { visibility: hidden; }' });
        await link.click();
        await page.waitForURL('**/freshness');
      }
      console.log(`${width}/${theme} ${route}: one full-wording footer link, placement, reflow, focus, axe and print passed`);
    }
    await context.close();
  }
  // Narrowest supported phone: do not hide or abbreviate the schedule.
  const context = await browser.newContext({ viewport: { width: 320, height: 900 } });
  await context.route('**/status.json', (r) => r.fulfill({ status: 404, body: '' }));
  const page = await context.newPage();
  await page.goto(origin);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(await page.locator('.footer-provenance .disclose-hint').evaluate((el) => getComputedStyle(el, '::after').transitionDuration), '0.14s', 'normal motion gets a short chevron transition');
  assert(await page.locator('.foot-inner').evaluate((el) => getComputedStyle(el).rowGap === '16px'), 'footer uses a consistent section gap');
  const link = page.locator('.site-check-footer .site-status');
  await link.scrollIntoViewIfNeeded();
  assert((await link.innerText()).includes('scheduled'));
  assert(await link.evaluate((el) => el.getBoundingClientRect().right <= innerWidth));
  await context.close();
  console.log('320px: full schedule fits without abbreviation');
} finally { await browser.close(); }
