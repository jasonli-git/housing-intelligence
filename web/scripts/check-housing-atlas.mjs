import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
  for(const width of [390,900,1280]) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:1100},colorScheme:theme,reducedMotion:'reduce'});
    const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3002/atlas');
    await page.locator('path[data-county="12"]').waitFor();
    assert.equal(await page.locator('.atlas-map-geography path').count(),21);
    if(width<=900) await page.getByRole('button',{name:'Show table',exact:true}).click();
    assert.equal(await page.locator('.atlas-table-wrap tbody tr').count(),21);
    if(width>900) { const divider=page.getByRole('separator',{name:'Resize comparison panel'});await divider.focus();await divider.press('ArrowLeft');assert.equal(await divider.getAttribute('aria-valuenow'),'390');await divider.press('ArrowRight'); }
    await page.getByRole('button',{name:'Select Somerset County',exact:true}).click();
    assert.equal(await page.locator('path[data-county="12"]').getAttribute('data-selected'),'true');
    assert.equal(await page.locator('.atlas-selected h3').textContent(),'Somerset County');
    const path=page.locator('path[data-county="5"]');await path.focus();await path.press('Enter');
    assert.equal(await page.locator('.atlas-selected h3').textContent(),'Atlantic County');
    assert.equal(await page.locator('[data-county-row="5"]').getAttribute('data-selected'),'true');
    const map=page.locator('.atlas-county-map');await map.focus();const before=await page.locator('.atlas-map-geography').getAttribute('transform');const scroll=await page.evaluate(()=>scrollY);await map.press('ArrowRight');assert.notEqual(await page.locator('.atlas-map-geography').getAttribute('transform'),before);assert.equal(await page.evaluate(()=>scrollY),scroll);
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    assert.notEqual(await page.locator('.atlas-map-geography').getAttribute('transform'),before);
    await page.getByRole('button',{name:'Reset',exact:true}).click();assert.equal(await page.locator('.atlas-map-geography').getAttribute('transform'),'translate(0 0) scale(1)');
    const hit=await path.evaluate(node=>{const r=node.getBoundingClientRect();for(const a of [.2,.4,.6,.8])for(const b of [.2,.4,.6,.8]){const x=r.x+r.width*a,y=r.y+r.height*b;if(document.elementFromPoint(x,y)===node)return {x,y};}return null;});
    assert(hit,'A visible county must have a real pointer hit area');await page.mouse.click(hit.x,hit.y);assert.equal(await page.locator('.atlas-selected h3').textContent(),'Atlantic County');
    await page.getByRole('button',{name:'Reset',exact:true}).click();
    const bounds=await map.boundingBox();await page.mouse.move(bounds.x+bounds.width*.6,bounds.y+bounds.height*.4);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.6+35,bounds.y+bounds.height*.4+18);await page.mouse.up();assert.notEqual(await page.locator('.atlas-map-geography').getAttribute('transform'),'translate(0 0) scale(1)');
    await page.getByLabel('Measure',{exact:true}).selectOption('acs_renter_cost_burden');
    const selectable=await page.getByLabel('View',{exact:true}).locator('option:not([disabled])').evaluateAll(nodes=>nodes.map(n=>n.value).filter(v=>v!=='latest'));
    assert(selectable.length>0);await page.getByLabel('View',{exact:true}).selectOption(selectable[0]);
    const figure=await page.locator('[data-county-row="5"] td').evaluate(n=>n.firstChild.textContent);
    assert.equal(await page.locator('.atlas-selected strong').textContent(),figure);
    assert((await page.locator('.atlas-reading').textContent()).includes('Percentage change'));
    await page.locator('.atlas-notes summary').click();
    const audit=await new AxeBuilder({page}).include('.housing-atlas-page').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
    await page.screenshot({path:`/tmp/housing-atlas-${width}-${theme}.png`});
    await page.locator('.atlas-selected a').click();await page.waitForURL('**/nj/atlantic-county');
    console.log(`PASS ${width} ${theme}: geometry, linked selection, controls, measure/change sync, source details, axe, county link`);await context.close();
  }
  const context=await browser.newContext({viewport:{width:1280,height:1000}});const page=await context.newPage();
  await page.route('**/atlas/counties.json',route=>route.abort());await page.goto('http://localhost:3002/atlas');await page.getByText('Map unavailable. All county figures remain in the table.').waitFor();assert.equal(await page.locator('.atlas-table-wrap tbody tr').count(),21);await page.getByRole('button',{name:'Select Somerset County'}).click();assert.equal(await page.locator('.atlas-selected h3').textContent(),'Somerset County');console.log('PASS missing-geometry fallback: table remains usable');await context.close();
} finally {await browser.close();}
