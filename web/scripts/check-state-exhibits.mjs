import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
  for(const width of [320,390,1280]) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto('http://localhost:3002/states/new-jersey',{waitUntil:'networkidle'});
    const gallery=page.locator('.state-market-exhibits');
    assert.equal(await gallery.locator(':scope > .learning-exhibit').count(),6);
    for(const heading of ['What did buyers borrow?','Where does the workday lead?','How connected is the state?']) assert(await gallery.getByRole('heading',{name:heading}).isVisible());
    assert.equal(await page.locator('#state-detailed-data .mortgage-lending').count(),0);
    assert.equal(await page.locator('#state-detailed-data .state-help-details').count(),0);
    assert.equal(await page.locator('.state-next-step a[href="/help"]').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const result=await new AxeBuilder({page}).include('.state-market-exhibits').analyze();
    assert.deepEqual(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    await gallery.screenshot({path:`/tmp/state-exhibits-${width}-${theme}.png`});
    for (const kind of ['lending','work']) {
      const details=gallery.locator(`[data-exhibit-style="${kind}"] .exhibit-content > section > details`);
      await details.locator(':scope > summary').click();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await details.locator(':scope > summary').click();
    }
    console.log(width,theme,'passed');
    await context.close();
  }
} finally {await browser.close();}
