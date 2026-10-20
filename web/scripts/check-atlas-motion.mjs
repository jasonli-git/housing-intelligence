import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
  for(const width of [390,768,1280]) for(const theme of ['light','dark']) {
    const height=width<600?844:width>=1200?800:1100;
    const context=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'no-preference'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3002/atlas');
    await page.locator('[data-state="NJ"]').waitFor();await page.waitForTimeout(450);
    const radius=()=>page.locator('.atlas-map-geography').getAttribute('transform').then(t=>Number(/scale\(([\d.]+)\)/.exec(t)[1]));
    const start=await radius();await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    await page.waitForTimeout(100);const middle=await radius();assert(middle>start&&middle<start*1.25,'Zoom should have a genuine intermediate frame');
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    await page.waitForTimeout(450);assert(Math.abs(await radius()-370*Math.pow(1.25,3))<.1,'Repeated zoom must settle at the newest target');
    await page.getByRole('button',{name:'Counties',exact:true}).click();await page.waitForTimeout(450);
    const scroll=await page.evaluate(()=>window.scrollY);
    await page.getByRole('button',{name:'Browse all measures',exact:true}).click();
    await page.waitForTimeout(250);
    const picker=page.locator('.atlas-measure-picker');const bounds=await picker.boundingBox();
    assert(bounds.y>=0&&bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,'Catalogue stays within viewport');
    assert.equal(await page.evaluate(()=>window.scrollY),scroll,'Opening the catalogue should not scroll the page');
    assert(await picker.locator('header').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Catalogue header must be visible and unobscured');
    assert(await page.getByLabel('Search measures',{exact:true}).evaluate(n=>document.activeElement===n));
    await page.getByLabel('Search measures',{exact:true}).fill('nothing matches this');
    assert((await picker.textContent()).includes('No matching measures'));
    await page.keyboard.press('Escape');assert.equal(await picker.count(),0);
    assert(await page.getByRole('button',{name:'Browse all measures',exact:true}).evaluate(n=>document.activeElement===n));
    await page.getByRole('button',{name:'Browse all measures',exact:true}).click();await page.waitForTimeout(250);
    const audit=await new AxeBuilder({page}).include('.housing-atlas-page').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    await page.screenshot({path:`/tmp/atlas-studio-picker-${width}-${theme}.png`});
    await page.getByRole('button',{name:'Close measures',exact:true}).click();
    if(width<=900)await page.getByRole('button',{name:'Compare counties',exact:true}).click();
    await page.getByRole('button',{name:'Select Somerset County',exact:true}).click();await page.waitForTimeout(450);
    if(width<=900)await page.getByRole('button',{name:'Close table',exact:true}).click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
    await page.screenshot({path:`/tmp/atlas-studio-${width}-${theme}.png`});
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
    await page.getByRole('button',{name:'United States',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForTimeout(50);
    assert(Math.abs(await radius()-462.5)<.1,'Reduced motion must snap directly to the new camera');
    console.log(`PASS ${width} ${theme}: retargetable motion, reduced motion, catalogue bounds, focus, empty search, axe, reflow`);
    await context.close();
  }
} finally {await browser.close();}
