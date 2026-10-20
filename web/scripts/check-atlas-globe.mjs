import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
  for(const width of [390,900,1280]) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:1100},colorScheme:theme,reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3002/atlas');await page.locator('[data-state="NJ"]').waitFor();
    assert.equal(await page.locator('.housing-atlas').getAttribute('data-level'),'states');
    assert.equal(await page.locator('.atlas-globe-ocean').count(),0); // a flat map since #399
    assert(await page.locator('.atlas-context-land').count()>0);
    assert.equal(await page.locator('.atlas-table-wrap tbody tr').count(),52);
    assert.equal(await page.locator('.atlas-legend > div > i').count(),1);
    assert(await page.locator('.atlas-controls').evaluate(n=>getComputedStyle(n).backdropFilter!=='none'&&getComputedStyle(n).opacity==='1'));
    assert((await page.locator('.atlas-state-coverage').textContent()).includes('New Jersey only'));
    const old=await page.locator('.atlas-map-geography').getAttribute('transform');await page.locator('.atlas-county-map').focus();await page.locator('.atlas-county-map').press('ArrowRight');assert.notEqual(await page.locator('.atlas-map-geography').getAttribute('transform'),old);
    if(width<=900)await page.getByRole('button',{name:'Compare states',exact:true}).click();
    await page.getByRole('button',{name:'Select New Jersey',exact:true}).click();assert.equal(await page.locator('.housing-atlas').getAttribute('data-level'),'states');assert.equal(await page.locator('.atlas-selected h3').textContent(),'New Jersey');
    const selectionAudit=await new AxeBuilder({page}).include('.atlas-selected').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(selectionAudit.violations.map(v=>v.id),[]);
    await page.getByRole('button',{name:'Explore New Jersey counties',exact:false}).click();await page.locator('[data-county="12"]').waitFor();assert.equal(await page.locator('.housing-atlas').getAttribute('data-level'),'county');assert.equal(await page.locator('.atlas-table-wrap tbody tr').count(),21);
    await page.getByRole('button',{name:'United States',exact:true}).click();await page.getByRole('button',{name:'Select California',exact:true}).click();assert((await page.locator('.atlas-selected').textContent()).includes('not available'));assert.equal(await page.locator('.atlas-selected a').count(),0);assert.equal(await page.locator('.atlas-drill').count(),0);
    await page.getByRole('button',{name:'United States',exact:true}).click();if(width<=900)await page.getByRole('button',{name:'Close table',exact:true}).click();
    const map=await page.locator('.atlas-map-stage').boundingBox(), frame=await page.locator('.housing-atlas').boundingBox();assert(Math.abs(map.width-frame.width)<2);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const audit=await new AxeBuilder({page}).include('.housing-atlas-page').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);assert.deepEqual(errors,[]);
    await page.screenshot({path:`/tmp/atlas-globe-${width}-${theme}.png`});console.log(`PASS ${width} ${theme}: globe rotation, state coverage, NJ drilldown, unavailable-state guard, full-map layout, axe`);await context.close();
  }
} finally {await browser.close();}
