import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.SITE_URL ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/nj/princeton`, { waitUntil: 'networkidle' });
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    const gallery = page.locator('#place-story-gallery');
    await gallery.scrollIntoViewIfNeeded();
    const topics = ['market', 'sales', 'pressure', 'lending', 'building', 'migration', 'commute', 'water'];
    assert.equal(await gallery.locator('[data-preview-topic]').count(), topics.length);
    for (const topic of topics) {
      const card = gallery.locator(`[data-preview-topic="${topic}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.locator('img:visible').evaluate(async img => { await img.decode(); });
      const headline = await card.locator('h3').innerText();
      const snapshot = await card.getAttribute('data-preview-snapshot');
      assert((await card.locator('img:visible').getAttribute('src')).includes(snapshot));
      assert((await card.getAttribute('href')).endsWith('?place=224'));
      await card.click();
      const focus = page.locator('[data-place-story-focus][data-selected="true"]');
      await focus.waitFor();
      const chart = focus.locator('[data-place-story-shot]');
      assert.equal(await chart.getAttribute('data-place-story-id'), '224');
      assert.equal(await chart.getAttribute('data-place-story-snapshot'), snapshot, 'same data/wording identity as preview');
      assert.equal(await chart.locator('figcaption strong').innerText(), headline, 'headline agrees with selected destination');
      if (topic === 'market') {
        assert(await focus.getByRole('heading', { name: 'Prices and paychecks over time', exact: true }).isVisible());
        assert.equal(await page.locator('.dot.hit[data-region-id="224"]').count(), 1, 'selected town remains highlighted in statewide context');
      }
      if (topic === 'commute') assert(await focus.getByRole('heading', { name: 'How do people here get around?', exact: true }).isVisible());
      if (topic === 'water') assert(await focus.getByRole('heading', { name: 'Water systems and records', exact: true }).isVisible());
      if (topic === 'sales') assert(await focus.getByRole('heading', { name: 'What did buyers actually pay?', exact: true }).isVisible());
      if (topic === 'lending') assert(await focus.getByRole('heading', { name: 'How do people here pay for homes?', exact: true }).isVisible());
      if (topic === 'building') {
        assert(await focus.getByRole('heading', { name: 'Are we adding homes—or losing them?', exact: true }).isVisible());
        assert((await chart.innerText()).includes('Preliminary'));
      }
      if (topic === 'migration') {
        assert((await chart.innerText()).includes('Mercer County'));
        assert((await chart.innerText()).includes('not town-level migration'));
        await focus.getByRole('button', { name: 'Where leavers went', exact: true }).click();
        assert(await focus.getByRole('button', { name: 'Where leavers went', exact: true }).getAttribute('aria-pressed') === 'true');
      }
      if (topic === 'pressure') {
        await focus.getByRole('button', { name: 'Owners', exact: true }).click();
        await focus.getByRole('button', { name: 'Over 30–50%', exact: true }).click();
        assert((await focus.locator('#income-band-explanation').innerText()).includes('household size'));
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
      const audit = await new AxeBuilder({ page }).include('[data-place-story-focus]').analyze();
      assert.deepEqual(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
      await focus.getByRole('link', { name: /Back to Princeton/ }).click();
      await gallery.waitFor();
    }
    const audit = await new AxeBuilder({ page }).include('#place-story-gallery').analyze();
    assert.deepEqual(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
    await page.locator('#about-living-there > summary').click();
    assert(await page.getByRole('heading', { name: 'Contaminated-site records', exact: true }).isVisible());
    assert.equal(await page.locator('.exhibit-gallery .indexed-comparison').count(), 0, 'moved trends do not remain duplicated');
    assert.equal(await page.locator('.exhibit-gallery #more-market-evidence, .exhibit-gallery #sales-heading, .exhibit-gallery .income-pressure, .exhibit-gallery .who-is-moving, .exhibit-gallery .homes-added').count(), 0, 'market exhibits have moved, not been duplicated');
    assert(await page.locator('#sales-heading').evaluate(el => Boolean(el.closest('[data-preview-topic="sales"]'))), 'existing property-tax and guide sale links still land on sales');
    assert.equal(await page.locator('#ground-water-heading').count(), 1, 'existing drinking-water links retain one correct target');
    assert(await page.locator('#ground-water-heading').evaluate(el => Boolean(el.closest('[data-preview-topic="water"]'))));
    await gallery.screenshot({ path: `/tmp/place-story-gallery-${width}-${theme}.png` });
    assert.deepEqual(errors, []);
    console.log(`${width}/${theme}: eight real shots, snapshot/headline identity, selected stories, interactions, return links, retained sites, no overflow and axe passed`);
    await context.close();
  }
  const page = await browser.newPage();
  await page.goto(`${origin}/stories/the-long-commute-premium?place=224`, { waitUntil: 'networkidle' });
  const picker = page.getByRole('combobox', { name: 'Focus this story on a town, county or ZIP' });
  await picker.fill('Hoboken');
  await page.getByRole('option').filter({ hasText: 'Hoboken' }).first().click();
  await page.getByRole('heading', { name: 'Exploring Hoboken', exact: true }).waitFor();
  assert.notEqual(new URL(page.url()).searchParams.get('place'), '224');
  await page.goBack();
  await page.getByRole('heading', { name: 'Exploring Princeton', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Exploring Princeton', exact: true }).waitFor();
  for (const [route, fixed] of [['/stories/income-and-home-value', { id: 11, name: 'Mercer County' }], ['/stories/water-you-can-check', null]]) {
    // This ZIP id is resolved from the existing search index, not inferred from a county.
    const selected = fixed ?? await page.evaluate(async () => (await (await fetch('/search.json')).json()).find(e => e.level === 'zip' && e.name.includes('08540')));
    assert(selected, 'registered ZIP selection exists');
    await page.goto(`${origin}${route}?place=${selected.id}`, { waitUntil: 'networkidle' });
    const focused = page.locator('[data-place-story-focus][data-selected="true"]');
    await focused.waitFor();
    assert.equal(await focused.locator('[data-place-story-shot]').getAttribute('data-place-story-id'), String(selected.id));
    assert(!(await focused.locator('[data-place-story-shot] figcaption').innerText()).includes('Princeton ·'), 'county/ZIP is not replaced by Princeton');
    if (fixed) await page.getByText(/This statewide chart plots towns/).waitFor();
  }
  for (const suffix of ['?place=999999', '?place=bad']) {
    await page.goto(`${origin}/stories/water-you-can-check${suffix}`, { waitUntil: 'networkidle' });
    await page.locator('[data-place-story-focus] [role="status"]').filter({ hasText: suffix.includes('bad') ? 'Invalid place selection' : 'could not be loaded' }).waitFor();
    assert.equal(await page.locator('[data-place-story-focus] [data-place-story-shot]').count(), 0, 'invalid/unavailable selection does not fall back to Princeton');
  }
  for (const slug of ['price-ladder', 'the-mortgage-market', 'is-new-jersey-building', 'who-moves-in', 'who-feels-housing-costs']) {
    await page.goto(`${origin}/stories/${slug}?place=11`, { waitUntil: 'networkidle' });
    const focus = page.locator('[data-place-story-focus][data-selected="true"]');
    await focus.getByRole('heading', { name: 'Exploring Mercer County', exact: true }).waitFor();
    assert.equal(await focus.locator('[data-place-story-shot]').getAttribute('data-place-story-id'), '11');
    assert(!(await focus.locator('[data-place-story-shot] figcaption').innerText()).includes('Princeton'));
  }
  await page.goto(`${origin}/stories/who-feels-housing-costs`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-place-story-focus] [data-place-story-shot]').count(), 0, 'new story has no implicit Princeton selection');
  assert(await page.locator('[data-story-shot] #state-income-pressure-heading').isVisible(), 'statewide burden chart remains visible without a selection');
  await page.goto(`${origin}/stories`);
  await page.getByRole('button', { name: /All stories/ }).click();
  await page.getByRole('searchbox', { name: 'Search stories' }).fill('Who feels housing costs');
  const libraryCard = page.locator('a.library-card[href="/stories/who-feels-housing-costs"]');
  await libraryCard.waitFor();
  await libraryCard.locator('img:visible').evaluate(async img => { await img.decode(); });
  for (const route of ['/nj/hoboken', '/nj/mercer-county', '/nj/zip-08540']) {
    await page.goto(origin + route);
    assert.equal(await page.locator('#place-story-gallery').count(), 0);
    assert.equal(await page.locator('.ground-water').count(), 1, 'other places retain original sections');
  }
  console.log('Place picker, new-topic county selections, county/ZIP identity, back/reload, invalid/missing selection, new library cover and non-pilot place regressions passed');
} finally { await browser.close(); }
