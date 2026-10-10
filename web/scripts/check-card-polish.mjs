import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch();
try {
  for (const width of [1280, 390]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let inventoryRequests = 0;
    page.on('request', r => {if (r.url().includes('/affordable-housing')) inventoryRequests++;});
    await page.goto('http://localhost:3002/regions/12', {waitUntil: 'networkidle'});
    assert.equal(inventoryRequests, 0, 'Hidden inventory should not fetch');
    const help = page.locator('#housing-assistance details.quiet-disclosure');
    await help.locator(':scope > summary').click();
    await page.waitForTimeout(500);
    assert.ok(inventoryRequests > 0, 'Opening programme panel loads inventory');
    assert.equal(await help.locator('.housing-assistance > details[open]').count(), 2);
    assert.equal(await help.locator('.assistance-method').getAttribute('open'), null);
    const internal = page.locator('.home-action-checks a[href^="/"]').first();
    const external = page.locator('.local-help-links a').first();
    assert.notEqual(await internal.evaluate(n => getComputedStyle(n).color), await external.evaluate(n => getComputedStyle(n).color));
    for (const panel of await page.locator('.quiet-disclosure[data-treatment]').all()) await panel.evaluate(n => {n.open = true;});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    const results = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    assert.deepEqual(results.violations.map(v => ({id: v.id, targets: v.nodes.map(n => n.target)})), []);
    await page.locator('.quiet-tool-group').scrollIntoViewIfNeeded();
    await page.screenshot({path: `/tmp/card-polish-${width}-${theme}.png`});
    console.log(`PASS ${width}px ${theme}`);
    await context.close();
  }
} finally {await browser.close();}
