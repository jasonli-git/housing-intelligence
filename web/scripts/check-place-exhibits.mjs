import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
 for(const path of ['/nj/camden-county','/nj/princeton','/nj/zip-07030']) for(const width of [390,1280]) for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto(`http://localhost:3002${path}`,{waitUntil:'networkidle'});
  const gallery=page.locator('.exhibit-gallery');
  const order=await gallery.locator('[data-exhibit]').evaluateAll(es=>es.map(e=>e.dataset.exhibit));
  if(order.includes('Annual building')) assert.equal(order.indexOf('Annual building'),order.indexOf('Building & demolition')+1);
  if(order.includes('Arrivals & departures')) assert(order.indexOf('Arrivals & departures')<order.indexOf('Building & demolition'));
  if(width>900 && path.includes('county')) {
    const building=await gallery.locator('[data-exhibit="Building & demolition"]').boundingBox();
    const annual=await gallery.locator('[data-exhibit="Annual building"]').boundingBox();
    assert(Math.abs(building.y-annual.y)<2);
    assert(annual.x>building.x);
  }
  assert(await gallery.getByRole('heading',{name:'What did buyers borrow?'}).isVisible());
  assert(await gallery.getByRole('heading',{name:'Where does the workday lead?'}).isVisible());
  assert.equal(await page.locator('#region-detailed-data .mortgage-lending').count(),0);
  assert.equal(await page.locator('#region-detailed-data .getting-around').count(),0);
  assert.equal(await page.locator('#region-detailed-data .local-evidence-charts, #region-detailed-data .trends').count(),0);
  assert(await gallery.locator('[data-exhibit="Flood context"]').count()>0);
  if(path.includes('county')) assert(await page.locator('#region-detailed-data').getByRole('heading',{name:'How this place ranks at a glance',includeHidden:true}).count()>0);
  assert.equal(await gallery.locator('[data-exhibit-style="network"]').count(),path.includes('county')?1:0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.locator('.trend-measure-control select').count(),0);
  assert.equal(await page.locator('.trend-side-exhibits, #trends-exhibits .trends').count(),0);
  assert.equal(await page.getByRole('heading',{name:'Explore each measure',includeHidden:true}).count(),0);
  assert(await page.locator('#region-detailed-data .historical-value-tables table').count()>0);
  assert.equal(await page.locator('#trends-exhibits .learning-exhibit').count(),0);
  if(width>900 && await page.locator('#trends-exhibits > .indexed-comparison').count()) {
    const chart=await page.locator('#trends-exhibits > .indexed-comparison').boundingBox();
    const section=await page.locator('#trends-exhibits').boundingBox();
    assert(chart.width>=section.width-2);
  }
  const more=page.locator('.water-more-systems');
  if(await more.count()) {
    assert.equal(await page.locator('.ground-water > .scroll-x .water-systems tbody tr').count(),2);
    await more.locator(':scope > summary').click();
    assert(await more.locator('table').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await more.locator(':scope > summary').click();
  }
  const a=await new AxeBuilder({page}).include('.exhibit-gallery').analyze();
  assert.deepEqual(a.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  await gallery.screenshot({path:`/tmp/place-exhibits-${path.split('/').pop()}-${width}-${theme}.png`});
  console.log(path,width,theme,'passed');await context.close();
 }
} finally{await browser.close();}
