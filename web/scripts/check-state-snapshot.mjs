import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
 for(const width of [320,390,1280]) for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto('http://localhost:3002/states/new-jersey',{waitUntil:'networkidle'});
  const snapshot=page.locator('#state-overview');
  assert.equal(await snapshot.locator('.state-facts article').count(),3);
  assert(await snapshot.getByText('Median sold-home price',{exact:true}).isVisible());
  const scope=snapshot.locator('.state-snapshot-limits');
  await scope.locator('summary').click();assert(await scope.locator('div').isVisible());
  const a=await new AxeBuilder({page}).include('#state-overview').analyze();
  assert.deepEqual(a.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  await scope.locator('summary').click();
  for(const button of await snapshot.locator('.mosaic-views button,.mosaic-legend button').all()) assert((await button.boundingBox()).height>=44);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await snapshot.screenshot({path:`/tmp/state-snapshot-${width}-${theme}.png`});
  console.log(width,theme,Math.round((await snapshot.boundingBox()).height),'px passed');
  await page.emulateMedia({media:'print'});assert((await scope.locator('p').first().boundingBox()).height>0);
  await context.close();
 }
} finally {await browser.close();}
