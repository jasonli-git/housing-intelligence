import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
 for(const width of [320,390,768,1280]) for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto('http://localhost:3002/',{waitUntil:'networkidle'});
  const input=page.locator('.coverage-search-panel input');
  assert((await input.boundingBox()).y<500,'Search should be on the first mobile screen');
  assert(await page.getByText('Housing costs. Local context. Clear sources.').isVisible());
  assert(await page.locator('.landing-coverage-link').isVisible());
  assert.equal(await page.locator('.coverage-scale-slot').count(),0);
  assert.equal(await page.locator('.nation-portrait').count(),0);
  await input.fill('Princeton');await page.getByRole('option').first().waitFor();
  assert(await page.getByRole('option').count()>0);await input.press('Escape');
  await page.locator('.coverage-map').waitFor({state:'attached'});
  await page.locator('.coverage-map').evaluate(e=>window.__openingMap=e);
  await page.locator('.coverage-explore-button').click();
  await page.locator('.coverage-map').waitFor({state:'visible'});
  await page.locator('.coverage-zoom button').nth(1).click();
  assert(await page.locator('.coverage-map-note').isVisible());
  assert(await page.locator('.coverage-map').evaluate(e=>e===window.__openingMap),'Exploration must retain the same SVG');
  await page.locator('.coverage-search-stage').screenshot({path:`/tmp/search-first-map-${width}-${theme}.png`,animations:'disabled'});
  await page.locator('.coverage-zoom button').nth(2).click();
  await page.locator('.coverage-search-return').click();assert(await input.isVisible());
  await page.locator('.entry-free-assurance summary').click();
  assert(await page.getByText('No fees, subscriptions or advertisements. Free to use.').isVisible());
  await page.locator('.entry-free-assurance summary').click();
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await page.locator('.coverage-atlas-traces path').first().evaluate(e=>getComputedStyle(e).animationName),'atlas-travel');
  assert.equal(await page.locator('.coverage-availability-glow circle').first().evaluate(e=>getComputedStyle(e).animationName),'coverage-blue-breathe');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.coverage-availability-glow circle').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.locator('.licence summary').click();assert(await page.locator('.licence-text').isVisible());await page.locator('.licence summary').click();
  const a=await new AxeBuilder({page}).include('.search-first-home').analyze();
  assert.deepEqual(a.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await input.fill('');await input.press('Escape');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`/tmp/search-first-${width}-${theme}.png`});
  console.log(width,theme,'passed');await context.close();
 }
} finally {await browser.close();}
