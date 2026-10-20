import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
 for(const width of [390,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3002/atlas?level=county&measure=pep_population&view=latest');
  if(width<=900)await page.getByRole('button',{name:'Compare counties',exact:true}).click();
  await page.getByRole('button',{name:'Select Somerset County',exact:true}).click();await page.getByRole('button',{name:'Pin for comparison',exact:true}).click();
  await page.getByRole('button',{name:'Select Mercer County',exact:true}).click();
  assert.equal(await page.locator('.atlas-comparison-pair>div').count(),2);assert((await page.locator('.atlas-comparison').textContent()).includes('Descriptive difference'));
  await page.waitForTimeout(200);assert.equal(new URL(page.url()).searchParams.get('pin'),'12');
  await page.reload();await page.locator('.atlas-comparison-pair>div').nth(1).waitFor({state:'attached'});assert.equal(await page.locator('.atlas-comparison-pair>div').count(),2);
  if(width<=900)await page.getByRole('button',{name:'Compare counties',exact:true}).click();
  let audit=await new AxeBuilder({page}).include('.housing-atlas').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  await page.screenshot({path:`/tmp/atlas-two-place-${width}-${theme}.png`});
  await page.getByRole('button',{name:'Clear pinned place'}).click();assert.equal(await page.locator('.atlas-comparison').count(),0);
  for(const path of ['/nj/somerset-county','/nj/princeton','/states/new-jersey']){
   await page.goto(`http://localhost:3002${path}`);const chart=page.locator('.income-pressure');assert.equal(await chart.count(),1);
   assert((await chart.textContent()).includes('2018–2022'));assert.equal(await chart.locator('.income-pressure-bars>div').count(),5);
   await chart.getByRole('button',{name:'Owners',exact:true}).click();assert.equal(await chart.getByRole('button',{name:'Owners',exact:true}).getAttribute('aria-pressed'),'true');
   await chart.locator('summary').click();assert((await chart.textContent()).includes('not this page’s median household income'));
   if(path.includes('/states/'))assert((await chart.textContent()).includes('all 21 counties'));
   audit=await new AxeBuilder({page}).include('.income-pressure').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await chart.screenshot({path:`/tmp/income-pressure-${path.split('/').pop()}-${width}-${theme}.png`});
  }
  await page.goto('http://localhost:3002/nj/zip-07030');assert.equal(await page.locator('.income-pressure').count(),0);assert.deepEqual(errors,[]);
  console.log(`PASS ${width} ${theme}: pin, compare, restore, clear, county/town/state pressure, tenure toggle, definitions, ZIP guard, axe`);await context.close();
 }
}finally{await browser.close();}
