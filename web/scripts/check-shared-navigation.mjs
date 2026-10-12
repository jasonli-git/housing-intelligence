import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
  for(const width of [390,814,1243]) for(const route of ['/states/new-jersey','/guide','/tax','/nj/somerset-county']) {
    const context=await browser.newContext({viewport:{width,height:1222},colorScheme:'dark',reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(`http://localhost:3002${route}`);
    assert.equal(await page.locator('.site-meta-row.shared-meta').count(),1);
    assert.equal(await page.locator('.site-status').getAttribute('href'),'/freshness');
    assert.equal(await page.locator('.site-status').evaluate(n=>getComputedStyle(n).borderTopWidth),'0px');
    assert.equal(await page.locator('.licence-label').evaluate(n=>getComputedStyle(n).textTransform),'none');
    await page.locator('.licence summary').click();
    assert(await page.locator('.licence details').evaluate(n=>n.open));
    await page.locator('.licence summary').click();
    if(width>1000) {
      const bounds=await page.evaluate(()=>['.bar-desktop-tools','.bar-tools > .place-search','.theme-toggle'].map(s=>{const r=document.querySelector(s).getBoundingClientRect(); return {left:r.left,right:r.right};}));
      assert(bounds[0].right<=bounds[1].left && bounds[1].right<=bounds[2].left);
    } else {
      assert(await page.locator('.bar-tool-menu > summary').isVisible());
    }
    if(route==='/states/new-jersey') {
      assert.equal(await page.locator('#nj-explore .place-search,.state-discovery-modes').count(),0);
      assert.equal(await page.locator('#county-comparison').count(),0);
      assert.equal(await page.locator('.state-title-navigation select option').filter({hasText:'Compare counties'}).count(),0);
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const audit=await new AxeBuilder({page}).include('.site-meta-row').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v=>v.id),[]);
    if(route==='/states/new-jersey') await page.screenshot({path:`/tmp/nj-direct-comparison-${width}.png`,fullPage:true});
    console.log(`PASS ${width} ${route}: menu, notices, reflow, accessibility${route.includes('states')?', comparison retired and jump list updated':''}`);
    await context.close();
  }
} finally {await browser.close();}
