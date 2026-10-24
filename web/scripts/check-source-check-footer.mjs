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
      assert.deepEqual(await page.locator('.foot-link-list a').evaluateAll((links) => links.map((a) => a.getAttribute('href'))), ['/freshness', '/changes']);
      const notice = page.getByRole('region', { name: 'Code and data terms' });
      assert(await notice.evaluate((el) => {
        const s = getComputedStyle(el);
        return s.outlineStyle === 'none' && s.backgroundImage === 'none' && s.boxShadow === 'none' && s.borderLeftWidth === '0px' && s.borderTopWidth === '1px';
      }), 'notice is a quiet open colophon, not an outlined card');
      assert.equal(await notice.getByRole('navigation', { name: 'Site policies' }).getByRole('link').count(), 3);
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
      const audit = await new AxeBuilder({ page }).include('.site-check-footer').include('.site-meta-row').include('.footer-colophon').include('.foot-links').analyze();
      assert.deepEqual(audit.violations.map((v) => v.id), []);
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
  const link = page.locator('.site-check-footer .site-status');
  await link.scrollIntoViewIfNeeded();
  assert((await link.innerText()).includes('scheduled'));
  assert(await link.evaluate((el) => el.getBoundingClientRect().right <= innerWidth));
  await context.close();
  console.log('320px: full schedule fits without abbreviation');
} finally { await browser.close(); }
