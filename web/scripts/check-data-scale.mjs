import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const metrics=await(await fetch('http://localhost:8000/metrics')).json();
const freshness=await(await fetch('http://localhost:8000/freshness')).json();
const totals=await Promise.all(['county','municipality','zip'].map(async level=>(await(await fetch(`http://localhost:8000/regions?has_data=true&state=NJ&level=${level}&limit=1`)).json()).total));
const expected=[new Set(freshness.sources.filter(s=>s.period_observed_start||s.period_observed_end).map(s=>s.source_id)).size,metrics.reduce((sum,m)=>sum+m.observations,0),totals.reduce((sum,n)=>sum+n,0)];
const browser=await chromium.launch();
try {
 for(const width of [320,390,1280]) for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto('http://localhost:3002/',{waitUntil:'networkidle'});
  const scale=page.locator('.data-scale');
  assert.deepEqual(await scale.locator('.scale-value').allTextContents(),expected.map(n=>n.toLocaleString('en-US')));
  assert.equal(await scale.locator('.scale-streams path').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  await scale.locator('summary').click();assert(await scale.locator('nav').isVisible());
  const a=await new AxeBuilder({page}).include('.data-scale').analyze();
  assert.deepEqual(a.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await scale.locator('summary').click();await scale.screenshot({path:`/tmp/data-scale-${width}-${theme}.png`});
  console.log(width,theme,expected,'passed');await context.close();
 }
}finally{await browser.close();}
