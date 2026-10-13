import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
  for(const width of [390,900,1280])for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:width<600?844:900},colorScheme:theme,reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3002/atlas?level=county&measure=pep_population&view=latest');
    await page.locator('[data-county="12"]').waitFor();
    assert((await page.locator('.atlas-legend').textContent()).includes('Darker = more residents'));
    if(width<=900)await page.getByRole('button',{name:'Compare counties',exact:true}).click();
    const finder=page.getByRole('searchbox',{name:'Find a county',exact:true});
    const legend=await page.locator('.atlas-legend').textContent();
    await finder.fill('somerset');assert.equal(await page.locator('.atlas-table-wrap tbody tr').count(),1);
    assert.equal(await page.locator('[data-county]').count(),21);assert.equal(await page.locator('.atlas-legend').textContent(),legend);
    await page.getByRole('button',{name:'Select Somerset County',exact:true}).click();
    await finder.fill('');await page.locator('.atlas-table-wrap').evaluate(n=>n.scrollTop=n.scrollHeight);
    const selected=await page.locator('.atlas-selected').boundingBox(),panel=await page.locator('.atlas-results').boundingBox();
    assert(selected.y>=panel.y&&selected.y+selected.height<=panel.y+panel.height,'Selected place remains visible while table scrolls');
    await page.getByRole('button',{name:'Clear selection',exact:false}).click();assert.equal(await page.locator('.atlas-selected h3').count(),0);
    await finder.fill('no such county');assert.equal(await page.locator('.atlas-table-wrap tbody tr').count(),0);assert((await page.locator('.atlas-county-finder').textContent()).includes('0 matching counties'));await finder.fill('');
    if(width<=900) {
      assert.equal(await page.locator('.atlas-legend').isVisible(),false);
      await page.getByRole('button',{name:'Close table',exact:true}).click();
      await page.waitForTimeout(100);
      const sheet=await page.locator('.atlas-results').boundingBox(),key=await page.locator('.atlas-legend').boundingBox(),zoom=await page.locator('.atlas-map-buttons').boundingBox();
      assert(key.y+key.height<sheet.y&&zoom.y+zoom.height<key.y,'Map controls and legend do not overlap the sheet');
    }
    for(const metric of ['pep_population','acs_renter_cost_burden','acs_median_hh_income']) {
      await page.getByLabel('Measure',{exact:true}).selectOption(metric);await page.waitForTimeout(80);
      const key=await page.locator('.atlas-legend').boundingBox(),zoom=await page.locator('.atlas-map-buttons').boundingBox();
      assert(zoom.y+zoom.height<key.y,'Zoom controls remain above each measure-specific legend');
    }
    await page.getByRole('button',{name:'New Jersey',exact:true}).click();assert.equal(await page.locator('.housing-atlas').getAttribute('data-level'),'states');assert.equal(await page.locator('.atlas-selected h3').textContent(),'New Jersey');
    await page.getByRole('button',{name:'United States',exact:true}).click();assert.equal(await page.locator('.atlas-selected h3').count(),0);
    await page.getByRole('button',{name:'Globe',exact:true}).click();assert.equal(await page.locator('.housing-atlas').getAttribute('data-level'),'globe');
    const audit=await new AxeBuilder({page}).include('.housing-atlas-page').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
    await page.screenshot({path:`/tmp/atlas-navigation-${width}-${theme}.png`});
    console.log(`PASS ${width} ${theme}: geography journey, county finder, unchanged map scale, anchored selection, clear control, coordinated sheet, axe`);
    await context.close();
  }
}finally{await browser.close();}
