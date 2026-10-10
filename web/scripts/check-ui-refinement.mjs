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
  const search = page.getByRole('combobox', { name: 'Search by state, town, county or ZIP code', exact: true });
  assert.equal(await search.count(), 1, 'Only one place search');
  assert.equal(await page.getByRole('heading', { name: 'Find your place', exact: true }).count(), 0, 'Search does not repeat a separate heading');
  assert.equal(await page.getByRole('button', { name: 'Search places', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Explore map', exact: true }).getAttribute('aria-pressed'), 'false');
  assert(await page.locator('.coverage-map-stage').evaluate(n => getComputedStyle(n).backgroundColor === getComputedStyle(document.body).backgroundColor), 'Atlas shares the page background');
  assert(await page.locator('#coverage-map-content').evaluate(n => n.inert && n.getAttribute('aria-hidden') === 'true'), 'Preview map is not interactive or announced behind search');
  assert.equal(await page.getByText('Try Princeton or 07030.', { exact: false }).count(), 0);
  await search.fill('Somerset');
  await page.getByRole('option').first().waitFor();
  await page.getByRole('button', { name: 'Explore map', exact: true }).click();
  assert(await page.locator('.coverage-map').evaluate(n => n === document.activeElement), 'Reveal transfers focus to map');
  assert.equal(await search.isVisible(), false);
  assert.equal(await page.getByRole('button', { name: 'Explore map', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#coverage-map-content').evaluate(n => n.inert), false);
  await page.getByRole('button', { name: 'Zoom in United States map', exact: true }).click();
  const zoomed = await page.locator('.coverage-viewport').getAttribute('style');
  await page.getByRole('button', { name: 'Search places', exact: false }).click();
  assert(await search.evaluate(n => n === document.activeElement), 'Return transfers focus to search');
  assert.equal(await search.inputValue(), 'Somerset', 'Switching preserves the query');
  await page.getByRole('button', { name: 'Explore map', exact: true }).click();
  assert.equal(await page.locator('.coverage-viewport').getAttribute('style'), zoomed, 'Switching preserves map position');
  await page.getByRole('button', { name: 'Search places', exact: false }).click();
  await search.fill('');
  await search.blur();
  const prices = page.locator('.national-benchmark', { has: page.getByRole('heading', { name: 'Home prices · past year', exact: true }) });
  assert.match(await prices.locator('.national-rate > strong').textContent(), /^[+-]?\d+\.\d%$/);
  assert.match(await prices.locator('.national-rate small').textContent(), /[A-Z][a-z]{2} \d{4} → [A-Z][a-z]{2} \d{4} · FHFA HPI/);
  assert.equal(await page.getByRole('heading', { name: 'The national backdrop', exact: true }).count(), 1);
  assert.equal(await page.locator('.national-trend').count(), 2);
  assert.equal(await page.locator('.national-trend-line').count(), 2);
  assert(await page.locator('.national-trend-line').first().getAttribute('d'), 'Actual mortgage history drawn');
  assert(await page.locator('.national-trend-line').last().getAttribute('d'), 'Actual annual price changes drawn');
  for (const card of await page.locator('.national-benchmark').all()) {
    const headline = Number((await card.locator('.national-rate > strong').textContent()).replace('%', ''));
    const latest = Number((await card.locator('.national-trend-dot').last().locator('title').textContent()).split(': ')[1].replace('%', ''));
    const digits = await card.getAttribute('aria-labelledby') === 'national-home-prices-heading' ? 1 : 2;
    assert.equal(Number(latest.toFixed(digits)), Number(headline.toFixed(digits)), 'Latest plotted observation matches its headline');
  }
  assert.equal(await prices.getByRole('link', { name: 'FHFA HPI®', exact: true }).getAttribute('href'), 'https://www.fhfa.gov/data/hpi/datasets?tab=monthly-data');
  assert.equal(await page.locator('.publisher-notice p').filter({ hasText: 'This product uses FHFA data but is neither endorsed nor certified by FHFA.' }).count(), 1, 'Required FHFA notice displayed once');
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
      assert(await page.locator('.entry-free span').evaluate(n => getComputedStyle(n).color !== getComputedStyle(document.querySelector('.entry-introduction')).color), 'Free badge has stronger hierarchy than tagline');
      await page.locator('.nation-head').screenshot({ path: `${output}/landing-head-${width}-${theme}.png` });
      const stateLink = page.locator('.coverage-state-preview h3').getByRole('link', { name: 'New Jersey', exact: true });
      assert.equal(await stateLink.getAttribute('href'), '/states/new-jersey');
      assert.equal(await page.locator('.coverage-state-action').count(), 0, 'No redundant right-hand state button');
      assert(await page.locator('.foot-notice-head').evaluate(n => getComputedStyle(n.querySelector('svg')).stroke === getComputedStyle(n.querySelector('a')).color), 'Notice title matches yellow shield');
      assert(await page.locator('.entry-free').evaluate(n => n.previousElementSibling?.classList.contains('entry-introduction')), 'Free badge sits below tagline');
      assert(await page.locator('.coverage-state-preview .entry-kicker').evaluate(n => getComputedStyle(n).color !== getComputedStyle(n.parentElement.querySelector('h3')).color), 'Availability label is distinct from New Jersey blue');
      assert.equal(await page.locator('.coverage-search-panel input').isVisible(), true);
      await page.locator('.coverage-search-stage').screenshot({ path: `${output}/search-map-${width}-${theme}.png` });
      assert.equal(await page.locator('#coverage-map-content').evaluate(n => getComputedStyle(n).filter), 'none', 'No unlock-style blur');
      assert(await page.locator('.coverage-search-panel').evaluate(n => getComputedStyle(n).boxShadow === 'none' && parseFloat(getComputedStyle(n).borderTopWidth) === 0), 'Search is integrated rather than a blocking card');
      assert.equal(await page.locator('.atlas-travelling-line').evaluate(n => getComputedStyle(n).animationName), 'none', 'Reduced-motion atlas stays static');
      await page.getByRole('button', { name: 'Explore map', exact: true }).click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width} ${theme}: revealed map does not overflow`);
      if (width === 390) {
        const mapAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        assert.deepEqual(mapAudit.violations.map(v => v.id), [], `${theme}: revealed map accessibility`);
        await page.locator('.coverage-search-stage').screenshot({ path: `${output}/revealed-map-${theme}.png` });
      }
      await page.getByRole('button', { name: 'Search places', exact: false }).click();
      await search.blur();
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
      const externalIcon = await page.locator('.notice-external-icon').boundingBox();
      assert(externalIcon && externalIcon.width === 13 && externalIcon.height === 13, 'Notice external-link icon stays 13px');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} ${theme}: landing/footer reflow`);
      if (theme === 'dark' && width !== 320) {
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          scrollTo(0, 0);
        });
        await page.screenshot({ path: `${output}/us-landing-${width}.png` });
        await page.locator('.coverage-state-preview').screenshot({ path: `${output}/us-state-link-${width}.png` });
        await page.locator('.national-backdrop').screenshot({ path: `${output}/us-benchmarks-${width}.png` });
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
