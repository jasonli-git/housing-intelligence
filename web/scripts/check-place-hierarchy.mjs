import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.SITE_URL ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 768, 1024, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/nj/princeton`, { waitUntil: 'networkidle' });
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    const opening = page.getByRole('region', { name: 'The housing market', exact: true });
    assert(await opening.isVisible());
    assert.equal(await opening.locator('details').count(), 0, 'all primary findings and qualifications are visible');
    assert.equal(await page.locator('.orientation-details .region-orientation').count(), 0, 'promoted summary is not duplicated');
    assert(await opening.evaluate(el => Boolean(el.compareDocumentPosition(document.getElementById('quiet-cost')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'market before household costs');
    assert(await opening.getByText('Typical home value', { exact: true }).isVisible());
    assert(await opening.getByText('Typical market rent', { exact: true }).isVisible());
    const text = await opening.innerText();
    for (const qualification of ['Zillow ·', 'modeled value', 'not a sale price or an appraisal', 'not what every existing tenant pays', 'over five years', 'municipalities with data', 'not a nearby-place comparison', 'Census ACS', '90% margin:']) assert(text.includes(qualification), qualification);
    assert(!text.includes('/mo / month'), 'rent unit appears only once');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
    const box = await opening.boundingBox();
    assert(box.y < 650, 'market starts near the opening, not after the cost model');
    const nav = page.getByRole('navigation', { name: 'Place sections' });
    if (width <= 760) await nav.getByRole('combobox').selectOption('place-market');
    else await nav.getByRole('link', { name: 'Market at a glance', exact: true }).click();
    assert.equal(new URL(page.url()).hash, '#place-market');
    await opening.getByRole('link', { name: /cost per month/ }).click();
    assert.equal(new URL(page.url()).hash, '#quiet-cost');
    const cost = page.locator('.place-cost-overview');
    assert(await cost.isVisible());
    // The prototype must not change the existing budget model or hide its controls.
    const before = await cost.locator('.cost-figure').first().innerText();
    const assumptions = cost.locator('.cost-yours');
    if (!(await assumptions.evaluate(el => el.open))) await assumptions.locator(':scope > summary').click();
    await cost.getByLabel('Purchase price', { exact: true }).fill('500000');
    assert.notEqual(await cost.locator('.cost-figure').first().innerText(), before);
    await cost.getByRole('button', { name: 'Use the published figures', exact: true }).click();
    assert.equal(await cost.locator('.cost-figure').first().innerText(), before);
    assert.equal(await opening.getByRole('link', { name: /buying plans/ }).getAttribute('href'), '/guide?place=224');
    const audit = await new AxeBuilder({ page }).include('#place-market').include('nav[aria-label="Place sections"]').analyze();
    assert.deepEqual(audit.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []);
    await page.mouse.move(0, 0);
    await page.goto(`${origin}/nj/princeton`, { waitUntil: 'networkidle' });
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    await page.screenshot({ path: `/tmp/place-hierarchy-${width}-${theme}.png` });
    assert.deepEqual(errors, []);
    console.log(`${width}/${theme}: market-first order, visible limits, section nav, cost inputs/reset, overflow and axe passed`);
    await context.close();
  }
  const page = await browser.newPage();
  for (const path of ['/nj/mercer-county', '/nj/zip-08540', '/nj/hoboken']) {
    await page.goto(`${origin}${path}`);
    assert.equal(await page.locator('#place-market').count(), 0, `${path}: one-town experiment only`);
    assert(await page.locator('.orientation-details').count() > 0);
    console.log(`${path}: original opening retained`);
  }
} finally { await browser.close(); }
