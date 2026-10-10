import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.A11Y_ORIGIN ?? 'http://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: 'light', hasTouch: true });
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const go = async path => {
  const response = await page.goto(`${origin}${path}`, {waitUntil:'networkidle'});
  assert(response?.ok(), `${path}: HTTP ${response?.status()}`);
  await page.locator('main h1').waitFor();
};
const axe = async label => {
  const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  assert.deepEqual(results.violations.map(v => ({id:v.id,targets:v.nodes.map(n=>n.target)})), [], label);
};
try {
  await go('/');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const trend = page.locator('.trend-entrance').first();
  await trend.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.trend-entrance')?.getAttribute('data-entered') === 'true');
  assert.equal(await trend.locator('.national-trend-line').evaluate(n => getComputedStyle(n).animationIterationCount), '1', 'National chart traces once, not continuously');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await trend.locator('.national-trend-line').evaluate(n => getComputedStyle(n).animationName), 'none', 'Reduced motion leaves the chart static');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(await page.locator('.portrait-house').evaluate(n => getComputedStyle(n).animationIterationCount), 'infinite', 'House illustration loops');
  await page.locator('.portrait-house').evaluate(n => { for (const a of n.getAnimations()) a.currentTime = 13500; });
  assert.equal(await page.locator('.portrait-house').evaluate(n => getComputedStyle(n).opacity), '1', 'Finished house remains visible in second cycle');
  assert.equal(await page.locator('.portrait-motion-control').count(), 0, 'No illustration pause control');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.portrait-house').evaluate(n => getComputedStyle(n).animationName), 'none', 'Reduced motion is static');
  console.log('PASS: looping house illustration without a control; reduced motion');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(await page.locator('.atlas-travelling-line').evaluate(n => getComputedStyle(n).animationIterationCount), 'infinite', 'Atlas accent moves without animating the map camera');
  assert.equal(await page.locator('.coverage-unavailable').first().evaluate(n => getComputedStyle(n).animationName), 'atlas-outline-draw', 'Atlas boundaries trace into place');
  assert.equal(await page.locator('.coverage-atlas-traces path').first().evaluate(n => getComputedStyle(n).animationIterationCount), 'infinite', 'State-boundary accents keep tracing');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.coverage-atlas-traces').evaluate(n => getComputedStyle(n).display), 'none', 'Reduced motion retains only the static atlas');
  await page.getByRole('button', { name: 'Explore the map', exact: true }).click();
  await page.locator('.coverage-map-stage').scrollIntoViewIfNeeded();
  await page.locator('.coverage-viewport').waitFor();
  await page.getByRole('button', {name:'Zoom in United States map'}).click();
  const national = page.locator('.coverage-viewport');
  const before = await national.getAttribute('style');
  await page.getByRole('button', {name:'Move map right',exact:true}).click();
  assert.notEqual(await national.getAttribute('style'),before,'National map moves without dragging');
  const nationalKeys = await national.getAttribute('style');
  await page.locator('.coverage-map').focus();
  const nationalScroll = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('ArrowRight');
  assert.notEqual(await national.getAttribute('style'), nationalKeys, 'National map responds to physical arrow keys');
  assert.equal(await page.evaluate(() => window.scrollY), nationalScroll, 'Focused national map does not scroll page');
  const theme = page.getByRole('button', {name:'Switch to the dark theme'});
  await theme.focus(); await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Switch to the light theme'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-theme')),false);
  console.log('PASS: national map non-drag movement; keyboard theme switch with reduced motion');

  await go('/states/new-jersey');
  assert.equal(await page.locator('.globe-stage').count(), 0, 'New Jersey page has no map');
  await page.locator('.place-discovery-search input[role="combobox"]').waitFor();
  const counties = page.getByRole('navigation',{name:'New Jersey counties'}).getByRole('link');
  assert.equal(await counties.count(), 21, 'All 21 county links');
  const comparison = page.locator('#county-comparison');
  assert.equal(await comparison.evaluate(n => n.open), false, 'County comparison starts closed');
  await comparison.locator('summary').focus(); await page.keyboard.press('Enter');
  await comparison.locator('table.ranks').waitFor();
  assert.equal(await comparison.locator('table.ranks tbody th[scope="row"] a').count(), 21, 'Comparison lists every county');
  await axe('New Jersey place search and county comparison');
  console.log('PASS: New Jersey place search, county links, keyboard-opened comparison table; axe check');

  const search = page.locator('.bar input[role="combobox"]');
  await search.fill('Atlantic');
  await page.getByRole('listbox',{name:'Places'}).waitFor();
  await axe('Search results');
  await page.keyboard.press('Escape'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForURL('**/regions/5');
  console.log('PASS: keyboard search, active result and navigation; search popup axe check');

  await go('/regions/5');
  const term = page.locator('.quiet-profile .term').first();
  await term.tap();
  const tip = page.locator('.floating-tip'); await tip.waitFor();
  const box = await tip.boundingBox();
  assert(box && box.x>=0 && box.x+box.width<=390 && box.y>=0 && box.y+box.height<=844,'Mobile definition stays in viewport');
  await axe('Open mobile definition');
  await page.keyboard.press('Escape'); await tip.waitFor({state:'detached'});
  assert(await term.evaluate(node=>node===document.activeElement),'Definition Escape preserves focus');
  await page.getByRole('combobox',{name:'Jump to section'}).selectOption('#region-detailed-data');
  assert(await page.locator('#region-detailed-data').evaluate(node=>node.open),'Evidence shortcut opens disclosure');
  assert(await page.locator('#region-detailed-data > summary').evaluate(node=>node===document.activeElement),'Evidence shortcut transfers focus');
  console.log('PASS: mobile definition bounds/dismissal; evidence shortcut focus');

  for (const path of ['/','/states/new-jersey','/regions/5','/regions/194','/regions/2842','/regions/54','/regions/51','/afford?income=120000&county=5','/tax','/freshness','/changes','/regions/5/report']) {
    await page.setViewportSize({width:320,height:900}); await go(path);
    await page.locator('details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path}: 320px reflow`);
    const duplicates = await page.locator('[id]').evaluateAll(nodes=>{
      const ids = nodes.map(n=>n.id); return [...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
    });
    assert.deepEqual(duplicates,[],`${path}: unique definition/control IDs`);
    await axe(`${path}: 320px expanded`);
    const tableTerm = page.locator('.values .term').last();
    if (await tableTerm.count()) {
      await tableTerm.focus();
      const definition = page.locator('.floating-tip'); await definition.waitFor();
      const bounds = await definition.boundingBox();
      assert(bounds && bounds.x>=0 && bounds.x+bounds.width<=320 && bounds.y>=0 && bounds.y+bounds.height<=900,`${path}: table definition viewport bounds`);
      await page.keyboard.press('Escape'); await definition.waitFor({state:'detached'});
    }
    console.log(`PASS: ${path} 320px expanded axe/reflow/unique IDs`);
  }
  const noScript = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},reducedMotion:'reduce'});
  const report = await noScript.newPage();
  await report.goto(`${origin}/regions/5/report`);
  assert((await report.locator('.tip').count())>0,'Report definitions remain in static HTML');
  await report.locator('.term').first().focus();
  await report.locator('.gl > .tip').first().waitFor({state:'visible'});
  await noScript.close();
  console.log('PASS: report definition fallback without JavaScript');
  assert.deepEqual(errors,[],'No browser application errors');
} finally { await browser.close(); }
