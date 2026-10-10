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
    const state = page.locator('.crumbs li[data-level="state"] a');
    assert.equal(await state.evaluate(n => getComputedStyle(n).color), await state.evaluate(n => {const probe = document.createElement('span'); probe.style.color = 'var(--state-blue)'; n.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color;}));
    const town = page.locator('.county-town-links a').first();
    assert.equal(await town.evaluate(n => getComputedStyle(n).color), theme === 'dark' ? 'rgb(162, 218, 213)' : 'rgb(38, 119, 117)');
    const guide = page.locator('.household-next a[href^="/guide"]');
    assert.equal(await guide.evaluate(n => getComputedStyle(n).color), theme === 'dark' ? 'rgb(215, 163, 173)' : 'rgb(146, 84, 96)');
    assert.equal(await page.locator('.local-picture-note .standouts-disclosure').count(), 1);
    assert.equal(await page.locator('.local-picture-note .editorial-annotation').count(), 1);
    assert.equal(await page.locator('.local-picture-note .cited').first().evaluate(n => getComputedStyle(n).color), theme === 'dark' ? 'rgb(232, 236, 230)' : 'rgb(48, 54, 50)');
    assert.equal(await page.locator('.local-picture-note .consumer-feature-editorial > .editorial-annotation').count(), 1);
    if (width === 1280) {
      const answer = await page.locator('.local-picture-note .consumer-feature-answer').boundingBox();
      const annotation = await page.locator('.local-picture-note .editorial-annotation').boundingBox();
      assert.ok(annotation.x >= answer.x + answer.width, 'Computed highlight is on the right');
    }
    assert.equal(await page.locator('.home-action-checks a[href^="/tax"]').evaluate(n => getComputedStyle(n).color), theme === 'dark' ? 'rgb(142, 217, 226)' : 'rgb(0, 105, 119)');
    for (const link of await page.locator('.home-action-checks a[href^="#"]').all()) assert.equal(await link.evaluate(n => getComputedStyle(n).color), theme === 'dark' ? 'rgb(166, 217, 192)' : 'rgb(36, 107, 85)');
    await page.locator('.local-picture-note .standouts-disclosure').evaluate(n => {n.open = true;});
    for (const panel of await page.locator('.quiet-disclosure[data-treatment]').all()) await panel.evaluate(n => {n.open = true;});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    const results = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    assert.deepEqual(results.violations.map(v => ({id: v.id, targets: v.nodes.map(n => n.target)})), []);
    await page.locator('.quiet-tool-group').scrollIntoViewIfNeeded();
    await page.screenshot({path: `/tmp/card-polish-${width}-${theme}.png`});
    await page.locator('.local-picture-note').evaluate(n => {n.scrollIntoView({block: 'start'}); window.scrollBy(0, -90);});
    await page.screenshot({path: `/tmp/local-note-${width}-${theme}.png`});
    await page.goto('http://localhost:3002/states/new-jersey', {waitUntil: 'networkidle'});
    const county = page.locator('a.destination-county').first();
    assert.equal(await county.evaluate(n => getComputedStyle(n).color), theme === 'dark' ? 'rgb(166, 217, 192)' : 'rgb(36, 107, 85)');
    console.log(`PASS ${width}px ${theme}`);
    await context.close();
  }
  const motionContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'no-preference'});
  const motionPage = await motionContext.newPage();
  await motionPage.goto('http://localhost:3002/regions/12', {waitUntil: 'networkidle'});
  const metric = motionPage.locator('.local-picture-note .editorial-metric');
  const before = await metric.textContent();
  await motionPage.waitForTimeout(10500);
  assert.notEqual(await metric.textContent(), before, 'Computed highlight rotates after ten seconds');
  console.log('PASS computed highlight rotation');
  await motionContext.close();
} finally {await browser.close();}
