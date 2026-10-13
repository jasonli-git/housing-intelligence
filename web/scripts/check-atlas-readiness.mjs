import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
 for(const width of [390,900,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:844},colorScheme:theme});
  const page=await context.newPage();const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:4});
  const started=performance.now();await page.goto('http://localhost:3002/atlas?level=states&measure=pep_population');
  await page.locator('[data-state="NJ"]').waitFor();
  const readyMs=Math.round(performance.now()-started);
  assert((await page.locator('.atlas-control-footer .atlas-coverage').textContent()).includes('other states: outlines'));
  assert(!requests.some(url=>url.endsWith('/atlas/counties.json')),'County boundaries deferred on state view');
  const map=page.locator('.atlas-county-map');const box=await map.boundingBox();
  const before=await page.locator('.atlas-map-geography').getAttribute('data-rotation');
  await page.mouse.move(box.x+box.width*.45,box.y+box.height*.6);await page.mouse.down();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.6,{steps:5});await page.mouse.up();
  assert.notEqual(await page.locator('.atlas-map-geography').getAttribute('data-rotation'),before,'Direct map dragging changes the view');
  if(width<=900)await page.getByRole('button',{name:'Compare states',exact:true}).click();
  await page.getByRole('button',{name:'Select Pennsylvania',exact:true}).click();
  assert((await page.locator('.atlas-outline-status').textContent()).includes('Boundary only'));
  if(width<=900)await page.getByRole('button',{name:'Close table',exact:true}).click();
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  await page.waitForTimeout(500);
  const params=new URL(page.url()).searchParams;assert.equal(params.get('zoom'),'1');assert.equal(params.get('lon'),'-96');
  await page.getByRole('button',{name:'Counties',exact:true}).click();await page.locator('[data-county="12"]').waitFor();
  assert(requests.some(url=>url.endsWith('/atlas/counties.json')));
  if(width<=900)await page.getByRole('button',{name:'Compare counties',exact:true}).click();
  await page.getByRole('searchbox',{name:'Find a county',exact:true}).fill('somerset');
  assert.equal(await page.locator('.atlas-table-wrap tbody tr').count(),1);
  // Reduced viewport exercises reflow, not a physical device's software keyboard.
  if(width===390){await page.setViewportSize({width,height:540});assert(await page.getByRole('searchbox',{name:'Find a county',exact:true}).isVisible());}
  const audit=await new AxeBuilder({page}).include('.housing-atlas').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').reduce((total,r)=>total+r.decodedBodySize,0));
  console.log(`PASS ${width} ${theme}: coverage, deferred geometry, reset, finder, reflow, axe; local cold-context readiness ${readyMs}ms at 4x CPU; decoded JS ${resources} bytes`);
  await context.close();
 }
}finally{await browser.close();}
