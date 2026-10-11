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
      if(url.pathname.endsWith('/affordable-housing/overview')) {
        url.pathname=url.pathname.replace('/overview','');
        url.searchParams.set('overview','true');
      }
      const response=await page.request.get(url.toString());
      await route.fulfill({response});
    });
    await page.goto(origin+'/help',{waitUntil:'networkidle'});
    assert(await page.getByRole('heading',{name:'Find housing help.',exact:true}).isVisible(),'Housing help is a standalone tool');
    assert.equal(await page.locator('.assistance-routes a').count(),3,'Official assistance routes remain visible');
    assert(await page.getByText('Coverage: New Jersey. More states are not available yet.',{exact:true}).isVisible(),'Housing help coverage is explicit');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Housing help has no horizontal overflow');
    for(const path of ['/nj/somerset-county','/nj/princeton','/regions/2842']) {
      await page.goto(origin+path,{waitUntil:'networkidle'});
      assert.equal(await page.locator('.home-action-checks').count(),0,'No long duplicate property checklist');
      assert.equal(await page.locator('.cost-yours').count(),1,'Interactive cost inputs restored');
      assert.equal(await page.locator('.quiet-tool-group').count(),1,'Buying views restored');
      assert.equal(await page.locator('.local-housing-help details').count(),0,'Place help links stay compact');
      assert(await page.locator('.migration-flows a').evaluateAll(els=>els.every(el=>el.classList.contains('destination-county'))),'Migration destinations carry the county colour class');
      await page.locator('.mortgage-rate-details summary').click();
      assert(await page.locator('.rate-scenarios').isVisible());
      assert(await page.locator('.mortgage-rate-details .reader-details-body').evaluate(el=>getComputedStyle(el).overflowX==='auto'),'Rate table has accessible overflow');
      assert(await page.locator('.mortgage-rate-details .rate-scenarios').evaluate(el=>{
        const table=el.getBoundingClientRect(), body=el.closest('.reader-details-body').getBoundingClientRect();
        return table.left>=body.left-1 && table.right<=body.right+1;
      }),'Rate table fits its disclosure on desktop and mobile');
      assert(await page.locator('.place-guide-entry a').isVisible(),'Place-aware guide entry is exposed');
      assert(await page.locator('#local-price-history, .local-market, .who-is-moving, .similar-places, .county-place-directory').evaluateAll(els=>els.every(el=>parseFloat(getComputedStyle(el).paddingLeft)>=16 && parseFloat(getComputedStyle(el).paddingRight)>=16)),'Visible context retains comfortable text insets');
      assert.equal(await page.locator('#local-property-evidence').evaluate(el=>el.tagName),'SECTION','Evidence has no second property accordion');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Place has no horizontal overflow');
      console.log(`${width} ${theme} ${path}: ${await page.locator('main details').count()} disclosures remaining`);
    }
    await page.goto(origin+'/nj/somerset-county',{waitUntil:'networkidle'});
    await page.locator('.cost-yours summary').click();
    await page.getByLabel('Purchase price',{exact:true}).fill('360000');
    await page.getByRole('link',{name:'Continue in the buyer’s guide →',exact:true}).click();
    await page.locator('.guide-answer[data-ready="true"]').first().waitFor({timeout:30000});
    assert.equal(await page.getByLabel('Purchase price',{exact:true}).inputValue(),'360000','Explicit home transfer reaches guide');
    await page.goto(origin+'/guide?place=224',{waitUntil:'networkidle'});
    await page.locator('.guide-answer[data-ready="true"]').first().waitFor({timeout:30000});
    assert.equal(await page.getByLabel('Purchase price',{exact:true}).inputValue(),'','Another place does not inherit listing price');
    await page.goto(origin+'/guide?place=12',{waitUntil:'networkidle'});
    await page.locator('.guide-answer[data-ready="true"]').first().waitFor({timeout:30000});
    assert.equal(await page.locator('.guide-contents a').count(),4);
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
    assert.equal(await page.locator('.guide-housing-help .assistance-routes a').count(),3,'Help available in guide too');
    await page.locator('.guide-housing-help > details > summary').click();
    assert(await page.locator('.guide-housing-help .housing-assistance').isVisible(),'Programme detail is discoverable in guide');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Guide has no horizontal overflow');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`/tmp/place-guide-focus-${width}-${theme}.png`,fullPage:true});
    await page.close();
  }
} finally { await browser.close(); }
