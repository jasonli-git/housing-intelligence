import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
 for(const path of ['/nj/camden-county','/nj/princeton','/nj/zip-07030']) for(const width of [390,1280]) for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto(`http://localhost:3002${path}`,{waitUntil:'networkidle'});
  const gallery=page.locator('.exhibit-gallery');
  assert(await gallery.getByRole('heading',{name:'What did buyers borrow?'}).isVisible());
  assert(await gallery.getByRole('heading',{name:'Where does the workday lead?'}).isVisible());
  assert.equal(await page.locator('#region-detailed-data .mortgage-lending').count(),0);
  assert.equal(await page.locator('#region-detailed-data .getting-around').count(),0);
  assert.equal(await page.locator('#region-detailed-data .local-evidence-charts, #region-detailed-data .trends').count(),0);
  assert(await gallery.locator('[data-exhibit="Flood context"]').count()>0);
  if(path.includes('county')) assert(await page.locator('#region-detailed-data').getByRole('heading',{name:'How this place ranks at a glance',includeHidden:true}).count()>0);
  assert.equal(await gallery.locator('[data-exhibit-style="network"]').count(),path.includes('county')?1:0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const a=await new AxeBuilder({page}).include('.exhibit-gallery').analyze();
  assert.deepEqual(a.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  await gallery.screenshot({path:`/tmp/place-exhibits-${path.split('/').pop()}-${width}-${theme}.png`});
  console.log(path,width,theme,'passed');await context.close();
 }
} finally{await browser.close();}
