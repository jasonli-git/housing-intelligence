import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.CLARITY_ORIGIN ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({ colorScheme: theme, viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(t => localStorage.setItem('housing-theme', t), theme);
    const page = await context.newPage();
    await page.goto(origin);
    assert.ok(await page.locator('.entry-free').evaluate(e => {
      const tagline = document.querySelector('.entry-introduction').getBoundingClientRect();
      const box = e.getBoundingClientRect(), style = getComputedStyle(e);
      return !e.classList.contains('computed') && parseFloat(style.borderTopWidth) === 0 && box.top >= tagline.bottom && box.top - tagline.bottom < 30 && Math.abs(box.left - tagline.left) < 2;
    }), 'Free reassurance follows the tagline without a badge container');
    const cards = page.locator('.home-tools a[data-tool]');
    assert.equal(await cards.count(), 3);
    const washes = await cards.evaluateAll(nodes => nodes.map(e => getComputedStyle(e).backgroundImage));
    assert.equal(new Set(washes).size, 3);
    assert.ok(washes.every(w => w.includes('radial-gradient')));
    assert.ok(await cards.evaluateAll(nodes => nodes.every(e => getComputedStyle(e.querySelector('.home-tool-title')).color === getComputedStyle(e.querySelector('svg')).stroke)));
    await cards.first().scrollIntoViewIfNeeded();
    if (width === 390) await page.screenshot({ path: `/tmp/reader-tools-${theme}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await page.goto(`${origin}/nj/somerset-county`);
    const explanation = page.locator('.income-limit-explainer');
    // Reveal existing parent disclosures before interacting with the new explanation.
    await explanation.evaluate(e => { for (let p = e.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
    await explanation.locator('..').getByLabel('Yearly household income before tax', { exact:true }).fill('68000');
    assert.ok(await explanation.locator('..').locator('.household-position').evaluate(e => getComputedStyle(e).fontWeight === '500'));
    await explanation.locator('summary').click();
    assert.equal(await explanation.getAttribute('open'), '');
    assert.equal(await explanation.locator('.reader-details-chevron').getAttribute('aria-hidden'), 'true');
    assert.ok(await explanation.locator('.reader-details-body').evaluate(e => parseFloat(getComputedStyle(e).paddingLeft) > 10));
    assert.ok((await explanation.textContent()).includes('different from the budget comparison'));
    assert.ok((await page.locator('.household-lines').textContent()).includes('30% level'));
    await explanation.scrollIntoViewIfNeeded();
    if (width === 390) await page.screenshot({ path: `/tmp/reader-income-${theme}.png` });
    await explanation.locator('summary').click();
    await page.emulateMedia({ media:'print' });
    assert.ok(await explanation.locator('.reader-details-body').isVisible());
    assert.equal(await explanation.locator('summary').isVisible(), false);
    await page.emulateMedia({ media:'screen' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    // Synthetic records exercise presentation only; these are not published property data.
    await page.route('**/parcels/**/*.json', async route => {
      const url = route.request().url();
      await route.fulfill({ json: url.endsWith('/meta.json')
        ? { shards: [], towns: {}, zips: {}, words: {} }
        : { geoid: 'fixture', county: 'Mercer', tax_year: 2025,
            classes: { '2': 'Residential' }, assessment_ratio: { year: 2025, value: 50 },
            nj_director_ratio: { year: 2025, value: 50 }, nj_general_tax_rate: { year: 2025, value: 3 }, nj_effective_tax_rate: { year: 2025, value: 1.5 },
            columns: ['block', 'lot', 'address', 'class', 'land', 'improvement', 'assessed', 'tax'],
            parcels: [['1', '1', 'TEST PROPERTY', '2', 100000, 100000, 200000, 6000], ['2', '1', 'TEST OTHER', '2', 50000, 50000, 100000, 3000]] } });
    });
    await page.goto(`${origin}/tax`);
    const town = await page.locator('#tax-towns option').evaluateAll(nodes => nodes.find(n => n.value.startsWith('Princeton,'))?.value);
    assert.ok(town);
    await page.locator('.tax-town-filter summary').click();
    await page.getByLabel('Town', { exact: true }).fill(town);
    await page.getByRole('textbox', { name: 'Address, or block and lot' }).fill('1/1');
    await page.locator('.tax-results button').first().click();
    const tax = page.locator('.tax-card');
    await tax.waitFor();
    const copy = await tax.textContent();
    for (const text of ['Value used to calculate property tax', 'Higher assessed value than', 'not a valuation of this particular home', 'equalized value']) assert.ok(copy.includes(text), text);
    await tax.scrollIntoViewIfNeeded();
    if (width === 390) await page.screenshot({ path: `/tmp/reader-tax-${theme}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log(`PASS ${theme} ${width}px: tool palettes, income explanation, synthetic tax result, reflow`);
    await context.close();
  }
} finally { await browser.close(); }
