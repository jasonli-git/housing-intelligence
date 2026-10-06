// Run against a local build/preview: ART_ORIGIN=http://localhost:3000 node scripts/check-artful-data.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.ART_ORIGIN ?? 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/regions/12', '/regions/194', '/tax', '/freshness', '/changes']) {
        const response = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
        assert(response?.ok(), `${route}: HTTP ${response?.status()}`);
        await page.locator('main h1').waitFor();
        await page.locator('main details').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
        const calculation = page.getByRole('button', { name: 'Show the calculation' });
        if (await calculation.count()) {
          assert.equal(await calculation.count(), 1, 'One shared calculation control');
          await calculation.click();
          assert.equal(await page.getByRole('button', { name: 'Hide the calculation' }).getAttribute('aria-expanded'), 'true');
          assert.equal(await page.locator('.shared-calculation details').count(), 0, 'No nested ledger expansion');
          assert.equal(await page.locator('.shared-calculation').getAttribute('hidden'), null);
        }
        assert.equal(await page.locator('.editorial-carousel button').count(), 0, 'Local picture has no carousel buttons');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route}: ${width}px reflow`);
        assert(await page.locator('.abstract-field').evaluateAll(nodes => nodes.every(node =>
          node.getAttribute('aria-hidden') === 'true' && node.getAttribute('focusable') === 'false' &&
          getComputedStyle(node).pointerEvents === 'none' && getComputedStyle(node).animationName === 'none'
        )), `${route}: decorative artwork stays static and noninteractive`);
        if (!route.startsWith('/regions/')) {
          const colors = await page.locator('.crumbs li[data-level="nation"] a').evaluate(node => ({
            link: getComputedStyle(node).color,
            primary: getComputedStyle(node.closest('main')).getPropertyValue('--text-primary').trim(),
          }));
          // Resolve the light-dark token to an actual color for comparison.
          assert(await page.locator('.crumbs li[data-level="nation"] a').evaluate((node, colors) => {
            const sample = document.createElement('span'); sample.style.color = colors.primary;
            node.append(sample); const same = getComputedStyle(sample).color === colors.link; sample.remove(); return same;
          }, colors), `${route}: neutral national breadcrumb`);
        } else {
          assert.equal(await page.locator('.data-portrait, .cost-composition').count(), 0, 'Rejected graphic sections remain absent');
          assert.equal(await page.locator('.cost-ribbon').count(), 0, 'Rejected ribbon stays absent');
          assert(await page.locator('.more-body sup.mk').evaluateAll(nodes => nodes.every(node => {
            const sample = document.createElement('span'); sample.style.color = 'var(--text-secondary)';
            node.append(sample); const same = getComputedStyle(sample).color === getComputedStyle(node).color; sample.remove(); return same;
          })), `${route}: neutral evidence footnotes`);
        }
        if (width === 390) {
          const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          assert.deepEqual(results.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `${route}: ${theme} expanded accessibility`);
        }
        console.log(`PASS ${route} ${width}px ${theme}`);
      }
    }
    await page.goto(`${origin}/regions/12`, { waitUntil: 'networkidle' });
    assert(await page.locator('.abstract-field').count() > 0, 'Print check includes artwork');
    await page.emulateMedia({ media: 'print' });
    assert(await page.locator('.abstract-field').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display === 'none')), 'Artwork hidden in print');
    await context.close();
  }
  assert.deepEqual(errors, [], 'No browser runtime errors');
} finally { await browser.close(); }
