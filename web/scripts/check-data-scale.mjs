import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const metrics=await(await fetch('http://localhost:8000/metrics')).json();
const catalogue=await(await fetch('http://localhost:8000/sources')).json();
const totals=await Promise.all(['county','municipality','zip'].map(async level=>(await(await fetch(`http://localhost:8000/regions?has_data=true&state=NJ&level=${level}&limit=1`)).json()).total));
const properties=existsSync('.property-scale.json')?JSON.parse(readFileSync('.property-scale.json','utf8')):null;
const sources=new Set(catalogue.filter(s=>s.source_id!=='hip_derived').map(s=>s.source_id)).size;
const expected=properties?[properties.parcels,properties.transactions,sources,totals.reduce((sum,n)=>sum+n,0)]:[sources,metrics.reduce((sum,m)=>sum+m.observations,0),totals.reduce((sum,n)=>sum+n,0)];
const browser=await chromium.launch();
try {
 for(const width of [320,390,1280]) for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto('http://localhost:3002/',{waitUntil:'networkidle'});
  const scale=page.locator('.data-scale');
  const signature=page.locator('.scale-signature');
  const bounds=await signature.boundingBox();
  assert(bounds && bounds.height<=60,'Map-edge signature should remain compact');
  assert(await page.locator('.coverage-entry').evaluate(e=>e.contains(document.querySelector('.scale-signature')) && e.contains(document.querySelector('.data-scale'))));
  assert(await page.locator('.coverage-search-stage').evaluate(e=>e.contains(document.querySelector('.scale-map-edge'))));
  assert((await page.locator('.scale-map-edge').boundingBox()).y < (await page.locator('.coverage-state-preview').boundingBox()).y);
  assert((await page.locator('.scale-map-edge').boundingBox()).height<110,'Closed map-edge strip should stay shallow');
  assert.equal(await page.locator('.foot-sources summary').innerText().then(t=>/All \d+ datasets/.test(t)),false);
  assert(await page.locator('.foot-sources summary').innerText().then(t=>t.includes('Census')));
  assert.equal(await signature.locator('.scale-streams path').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  const searchY=()=>page.locator('.coverage-search-panel input').evaluate(e=>e.getBoundingClientRect().top+window.scrollY);
  const inputY=await searchY();
  await scale.locator('summary').click();assert(await scale.locator('nav').isVisible());
  assert.equal(await searchY(),inputY,'Definitions must not move search');
  assert.deepEqual(await scale.locator('.scale-value').allTextContents(),expected.map(n=>n.toLocaleString('en-US')));
  const a=await new AxeBuilder({page}).include('.data-scale').include('.scale-signature').analyze();
  assert.deepEqual(a.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await scale.locator('summary').click();await scale.screenshot({path:`/tmp/data-scale-${width}-${theme}.png`});
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`/tmp/scale-landing-${width}-${theme}.png`});
  console.log(width,theme,expected,'passed');await context.close();
 }
}finally{await browser.close();}
