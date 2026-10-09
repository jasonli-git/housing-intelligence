// Focused regression checks for the density/discoverability pass and shared identity.
// Run against `npm run check:a11y:serve` after a build; broader axe checks stay separate.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';

const origin = process.env.A11Y_ORIGIN ?? 'http://localhost:3002';
const output = process.env.UI_SCREENSHOTS ?? '/tmp/housing-ui-refinement';
const browser = await chromium.launch();
const errors = [];
try {
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce', colorScheme: 'light' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const go = async path => {
    const response = await page.goto(origin + path, { waitUntil: 'networkidle' });
    assert(response?.ok(), `${path}: HTTP ${response?.status()}`);
    await page.locator('main h1').waitFor();
  };
  await go('/regions/12');
  await page.screenshot({ path: `${output}/county-desktop.png` });
  const jump = page.getByRole('combobox', { name: 'Jump to section', exact: true });
  for (const [label, heading] of [['Before choosing a home', '#home-checks-heading'], ['Who is moving here', '#who-is-moving-heading']]) {
    await jump.selectOption({ label });
    assert(await page.locator(heading).evaluate(n => n === document.activeElement), `${label}: focus`);
    assert(await page.locator(heading).evaluate(n => {
      const top = n.getBoundingClientRect().top;
      return top >= document.querySelector('.bar').getBoundingClientRect().bottom && top < innerHeight;
    }), `${label}: destination clear of sticky navigation`);
  }
  await jump.selectOption('#region-detailed-data');
  assert(await page.locator('#region-detailed-data').evaluate(n => n.open), 'Evidence opens');
  await go('/freshness');
  await jump.selectOption({ label: 'Monthly' });
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Monthly/);
  await go('/terms');
  await jump.selectOption({ label: 'Who runs this site' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'terms-who');
  await go('/regions/12/report');
  await jump.selectOption({ label: 'Sources' });
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Sources');
  await page.emulateMedia({ media: 'print' });
  assert.equal(await jump.isVisible(), false, 'Screen shortcut stays out of printed report');
  await page.emulateMedia({ media: 'screen' });
  await go('/');
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  assert.equal(image, 'https://housing.jasonli.app/housing-preview.png');
  for (const path of ['/housing-preview.png', '/og-image.png', '/apple-icon.png', '/icon.svg', '/favicon.ico']) {
    const response = await context.request.get(origin + path);
    assert(response.ok(), `${path}: served`);
    if (path.endsWith('.png')) {
      const size = await sharp(await response.body()).metadata();
      assert.equal(size.width, path === '/apple-icon.png' ? 180 : 1200);
      assert.equal(size.height, path === '/apple-icon.png' ? 180 : 630);
    }
  }
  await page.screenshot({ path: `${output}/landing-desktop.png` });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme });
      assert.equal(await page.locator('.entry-free span').textContent(), 'Free · No fees, subscriptions or ads');
      assert(await page.locator('.entry-free').evaluate(n => n.previousElementSibling?.classList.contains('entry-introduction') && n.nextElementSibling?.classList.contains('home-find')), 'Free badge sits between tagline and place search');
      assert(await page.locator('.foot-notice-head > svg').evaluate(n => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--notice-text)';
        n.parentElement.appendChild(probe);
        const expected = getComputedStyle(probe).color;
        probe.remove();
        return getComputedStyle(n).stroke === expected;
      }), `${theme}: Notice shield uses the warning accent`);
      assert(await page.locator('.entry-free span').evaluate(n => {
        const range = document.createRange();
        range.selectNodeContents(n);
        return range.getClientRects().length === 1;
      }), `${width} ${theme}: free badge stays on one line`);
      assert(await page.locator('.foot-notice-head').evaluate(n => {
        const icon = n.querySelector('svg').getBoundingClientRect();
        const title = n.querySelector('a').getBoundingClientRect();
        return Math.abs(icon.top + icon.height / 2 - title.top - title.height / 2) < 1;
      }), `${width} ${theme}: Notice shield is centred on heading`);
      assert.equal(await page.getByRole('navigation', { name: 'Site policies', exact: true }).getByRole('link').count(), 3);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} ${theme}: landing/footer reflow`);
      if (theme === 'dark' && width !== 320) {
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          scrollTo(0, 0);
        });
        await page.screenshot({ path: `${output}/us-landing-${width}.png` });
        await page.locator('.foot-notice').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/us-footer-${width}.png` });
        await page.locator('.foot-notice').screenshot({ path: `${output}/us-notice-${width}.png` });
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light' });
  await go('/404.html'); // Preview helper serves the exported document, not a host's 404 routing.
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
  assert.equal(await page.getByRole('combobox', { name: 'Search by state, town, county or ZIP code' }).count(), 1, 'One useful recovery search');
  await page.screenshot({ path: `${output}/404-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(scan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `404 ${theme}: axe`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `404 ${theme}: reflow`);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await go('/regions/12');
  await page.screenshot({ path: `${output}/county-mobile.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile county reflow');
  assert.deepEqual(errors, [], 'No application errors');
  console.log(`PASS: closed-section jumps, freshness/legal/report navigation, print exclusion, metadata, five assets, 404 recovery, mobile reflow, single-line free badge and centred Notice icon at 1280/390/320px in both themes. Screenshots: ${output}`);
} finally {
  await browser.close();
}
