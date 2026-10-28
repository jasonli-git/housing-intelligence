import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.SITE_URL ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 768, 1024, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce', hasTouch: width <= 760 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/nj/princeton`, { waitUntil: 'networkidle' });
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    const opening = page.getByRole('region', { name: 'The housing market', exact: true });
    assert(await opening.isVisible());
    assert.equal(await opening.locator('details').count(), 0, 'all primary findings and qualifications are visible');
    assert.equal(await page.locator('.orientation-details .region-orientation').count(), 1, 'full prose retained only in supporting context');
    assert(await opening.evaluate(el => Boolean(el.compareDocumentPosition(document.getElementById('quiet-cost')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'market before household costs');
    assert(await opening.getByText('Typical home value', { exact: true }).isVisible());
    assert(await opening.getByText('Typical market rent', { exact: true }).isVisible());
    const text = await opening.innerText();
    for (const qualification of ['Zillow ·', 'Modeled value', 'not a sale price or appraisal', 'not existing tenants’ bills', 'not just nearby towns', 'Census ACS', '90% margin:', 'not inflation-adjusted']) assert(text.includes(qualification), qualification);
    assert(!text.includes('Typical home values in Princeton are'), 'no introductory paragraph before the visual evidence');
    assert.equal(await opening.locator('[data-portrait="peers"]').count(), 2);
    assert.equal(await opening.locator('[data-portrait="trend"]').count(), 2);
    for (const plot of await opening.locator('[data-portrait="peers"]').all()) {
      const count = Number(await plot.getAttribute('data-peer-count'));
      assert(count>1);
      assert.equal(await plot.locator('[data-distribution="box-range"]').count(),1);
      assert.equal(await plot.locator('circle').count(),0,'peer distribution uses a box and markers, not dot clutter');
      assert((await plot.innerText()).includes('Middle 50%:'));
      assert((await plot.innerText()).includes(`${count} of 564 NJ towns`), 'coverage matches the actual plotted cohort');
      const control = plot.getByRole('slider');
      const value = await control.getAttribute('aria-valuetext');
      await control.focus(); await page.keyboard.press('End');
      assert.notEqual(await control.getAttribute('aria-valuetext'), value);
      assert((await plot.getByRole('link', { name: /Compare/ }).getAttribute('href')).startsWith('/compare?places=224,'));
      await page.keyboard.press('Home');
      const bounds = await control.boundingBox();
      if (width <= 760) await page.touchscreen.tap(bounds.x + bounds.width * .6, bounds.y + bounds.height / 2);
      else await page.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height / 2);
      assert.notEqual(await control.getAttribute('aria-valuenow'), '0', 'pointer/touch explores a real point');
    }
    for (const plot of await opening.locator('[data-portrait="trend"]').all()) {
      const svg=plot.locator('svg');assert.equal(await svg.getAttribute('viewBox'),'0 0 160 48','trend is a miniature chart beside the headline value');
      const control = plot.getByRole('slider');
      assert(await plot.evaluate(el => {
        const value=el.parentElement.firstElementChild.getBoundingClientRect(),chart=el.getBoundingClientRect();
        return chart.x<=value.x+1 && chart.right>=value.right-1 && chart.y<=value.y && chart.bottom>=value.bottom;
      }),'wide trend sits behind its overlaid headline');
      assert.equal((await svg.boundingBox()).height,48,'wide background sparkline keeps a compact height');
      const before = await plot.locator('output').textContent();
      await control.focus(); await page.keyboard.press('Home');
      assert.notEqual(await plot.locator('output').textContent(), before);
      await page.keyboard.press('End');
      assert.equal(await plot.locator('output').textContent(), before);
      await control.scrollIntoViewIfNeeded();
      const bounds=await control.boundingBox();
      if(width<=760) await page.touchscreen.tap(bounds.x+bounds.width*.5,bounds.y+bounds.height/2);
      else await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height/2);
      const selected=Number(await control.getAttribute('aria-valuenow'));
      assert(selected>0 && selected<Number(await control.getAttribute('aria-valuemax')),'miniature pointer/touch uses its own coordinate scale');
    }
    assert(await opening.getByRole('img', { name: /owner-occupied.*rented/ }).isVisible());
    assert(!text.includes('/mo / month'), 'rent unit appears only once');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
    const box = await opening.boundingBox();
    assert(box.y < 650, 'market starts near the opening, not after the cost model');
    const nav = page.getByRole('navigation', { name: 'Place sections' });
    if (width <= 760) await nav.getByRole('combobox').selectOption('place-market');
    else await nav.getByRole('link', { name: 'Market at a glance', exact: true }).click();
    assert.equal(new URL(page.url()).hash, '#place-market');
    if(width<=760) await nav.getByRole('combobox').selectOption('quiet-cost');
    else await nav.getByRole('link',{name:'Costs',exact:true}).click();
    assert.equal(new URL(page.url()).hash, '#quiet-cost');
    const cost = page.locator('.place-cost-overview');
    assert(await cost.isVisible());
    // The prototype must not change the existing budget model or hide its controls.
    const before = await cost.locator('.cost-figure').first().innerText();
    const numbers = cost.locator('.cost-use-numbers');
    if (!(await numbers.evaluate(el => el.open))) await numbers.locator(':scope > summary').click();
    const assumptions = cost.locator('.cost-yours');
    if (!(await assumptions.evaluate(el => el.open))) await assumptions.locator(':scope > summary').click();
    await cost.getByLabel('Purchase price', { exact: true }).fill('500000');
    assert.notEqual(await cost.locator('.cost-figure').first().innerText(), before);
    await cost.getByRole('button', { name: 'Use the published figures', exact: true }).click();
    assert.equal(await cost.locator('.cost-figure').first().innerText(), before);
    assert.equal(await opening.getByRole('navigation',{name:'From the market to your budget'}).count(),0);
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
  await page.goto(`${origin}/nj/princeton`, { waitUntil: 'networkidle' });
  const peer = page.locator('[data-portrait="peers"]').first();
  await peer.getByRole('slider').focus(); await page.keyboard.press('End');
  const href = await peer.getByRole('link', { name: /Compare/ }).getAttribute('href');
  await peer.getByRole('link', { name: /Compare/ }).click();
  await page.getByRole('heading', { name: 'Compare places', exact: true }).waitFor();
  assert.equal(new URL(page.url()).search, new URL(href, origin).search);
  await page.locator('.compare-table thead a').nth(1).waitFor();
  assert.equal(await page.locator('.compare-table thead a').count(), 2, 'both selected place packets loaded');
  await page.goBack(); await page.locator('#place-market').waitFor();
  console.log('Selected-peer comparison link and back navigation passed');
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto(`${origin}/nj/princeton`);
  assert(await staticPage.locator('[data-market-metric="zhvi_sfr"] > h3').isVisible());
  assert.equal(await staticPage.locator('#place-market svg').count(), 4, 'real plotted evidence remains in server-rendered HTML');
  assert(await staticPage.getByRole('img', { name: /owner-occupied.*rented/ }).isVisible());
  await noScript.close();
  console.log('No-script primary figures and four server-rendered charts passed (interactions require JavaScript)');
} finally { await browser.close(); }
