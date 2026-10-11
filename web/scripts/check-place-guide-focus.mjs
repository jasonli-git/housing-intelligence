import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin=process.env.FOCUS_ORIGIN ?? 'http://localhost:3002';
const browser=await chromium.launch();
try {
  for(const width of [320,390,1280]) for(const theme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    // The static guide expects publisher artifacts. Bridge those requests to the
    // real local API for this diagnostic only; no synthetic records are used.
    await page.route(/^https?:\/\/[^/]+\/regions\/\d+\/.*\.json$/,async route=>{
      const url=new URL(new URL(route.request().url()).pathname,'http://localhost:8000');
      url.pathname=url.pathname.replace('/packet/5y.json','/packet').replace(/\.json$/,'');
      if(url.pathname.endsWith('/packet')) url.searchParams.set('window','5y');
      const response=await page.request.get(url.toString());
      await route.fulfill({response});
    });
    for(const path of ['/nj/somerset-county','/nj/princeton','/regions/2842']) {
      await page.goto(origin+path,{waitUntil:'networkidle'});
      assert.equal(await page.locator('.quiet-tool-group,.cost-yours,.home-action-checks').count(),0,'No duplicate planning/checklist panels');
      assert(await page.locator('.place-guide-entry a').isVisible(),'Place-aware guide entry is exposed');
      assert.equal(await page.locator('#local-property-evidence').evaluate(el=>el.tagName),'SECTION','Evidence has no second property accordion');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Place has no horizontal overflow');
      console.log(`${width} ${theme} ${path}: ${await page.locator('main details').count()} disclosures remaining`);
    }
    await page.goto(origin+'/guide?place=12',{waitUntil:'networkidle'});
    await page.locator('.guide-answer[data-ready="true"]').first().waitFor({timeout:30000});
    assert.equal(await page.locator('.guide-contents a').count(),3);
    await page.getByLabel('Yearly household income, before tax',{exact:true}).fill('120000');
    await page.locator('.guide-assumptions summary').click();
    await page.getByLabel('Purchase price',{exact:true}).fill('350000');
    await page.getByLabel('Property tax a year',{exact:true}).fill('6000');
    await page.getByLabel('HOA or condo fees a month',{exact:true}).fill('200');
    assert((await page.locator('#guide-afford-heading').locator('..').locator('..').textContent()).includes('Your purchase price of'),'Reader price not credited to a publisher');
    assert(await page.getByText('Upfront cash:',{exact:false}).isVisible());
    assert.equal(await page.locator('.guide-check-group').count(),3);
    assert.equal(await page.locator('.guide-check-group .guide-check').count(),10);
    assert.equal(await page.locator('.guide-check-group details').count(),0,'No hidden primary checklist actions');
    assert.equal(await page.locator('.guide-checks').locator('..').filter({has:page.locator('summary')}).count(),1,'One checklist supporting appendix');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Guide has no horizontal overflow');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`/tmp/place-guide-focus-${width}-${theme}.png`,fullPage:true});
    await page.close();
  }
} finally { await browser.close(); }
