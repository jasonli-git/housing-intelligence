import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin=process.env.FOCUS_ORIGIN ?? 'http://localhost:3002';
const browser=await chromium.launch();
try {
  for(const width of [320,390,760,1280]) for(const theme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/',{waitUntil:'networkidle'});
    assert.equal(await page.locator('.home-tools a').count(),4,'Home presents all four tools');
    assert(await page.locator('.home-tools a[href="/help"]').isVisible(),'Housing help has a home tool card');
    assert.equal(await page.locator('.bar-help-route[href="/help"]').count(),2,'Housing help is in desktop and dropdown navigation');
    assert.equal(await page.locator('.bar-budget[href="/afford?county=all"]').count(),2,'Home affordability link is enabled in both menus');
    assert(await page.locator('.bar-budget .bar-budget-long').evaluateAll(els=>els.every(el=>el.textContent==='Budget explorer')),'Home uses the shared Budget explorer menu label');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Home tool cards fit the viewport');
    await page.goto(origin+'/states/new-jersey',{waitUntil:'networkidle'});
    assert(await page.locator('.state-next-step a[href="/guide"]').isVisible(),'NJ has the buyer-guide next step');
    assert(await page.locator('.state-next-step a[href="/help"]').isVisible(),'NJ has the housing-help next step');
    assert.equal(await page.locator('.state-help-links').count(),0,'NJ does not duplicate help application cards');
    assert.equal(await page.locator('#state-detailed-data .state-help-details').count(),1,'Historical programme evidence remains available');
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
    assert.equal(await page.locator('.housing-assistance').getAttribute('data-tool'),'true');
    assert.equal(await page.locator('.housing-help-page .assistance-facts').count(),0,'Municipal reporting does not compete with application routes');
    await page.locator('.assistance-inventory > summary').click();
    await page.locator('.assistance-properties li').first().waitFor();
    assert.equal(await page.locator('.assistance-properties li').count(),10,'Historical inventory loads from the same-origin static snapshot');
    await page.screenshot({path:`/tmp/help-${width}-${theme}.png`,fullPage:true});
    await page.goto(origin+'/afford?county=all',{waitUntil:'networkidle'});
    assert.equal(await page.locator('.budget-assumptions').count(),0,'Empty budget starts with essential controls only');
    assert(await page.locator('.budget-page > .page-head').evaluate(el=>getComputedStyle(el).borderTopWidth==='0px'),'Old red header line removed');
    await page.getByLabel(/Yearly household income · before tax/).fill('100000');
    assert(await page.locator('.budget-assumptions').isVisible(),'Assumptions are available after entering income');
    assert(await page.locator('.budget-comparison').isVisible(),'Income reveals comparison results');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Budget tool has no horizontal overflow');
    await page.screenshot({path:`/tmp/fit-${width}-${theme}.png`,fullPage:true});
    for(const path of ['/nj/somerset-county','/nj/princeton','/regions/2842']) {
      await page.goto(origin+path,{waitUntil:'networkidle'});
      assert.equal(await page.locator('.home-action-checks').count(),0,'No long duplicate property checklist');
      assert.equal(await page.locator('.cost-yours').count(),1,'Interactive cost inputs restored');
      assert.equal(await page.locator('.quiet-tool-group').count(),1,'Buying views restored');
      assert.equal(await page.locator('.planning-preview-grid > .planning-preview').count(),2,'Both buying-plan destinations are visible preview tiles');
      assert(await page.locator('.planning-preview-value').isVisible(),'Upfront estimate is visible before opening');
      await page.locator('.planning-preview').first().locator('summary').click();
      assert(await page.locator('.planning-preview').first().evaluate(el=>Math.abs(el.getBoundingClientRect().width-el.parentElement.getBoundingClientRect().width)<2),'Expanded planning tile uses the full width');
      assert(await page.locator('.planning-preview[open] .cost-lines dd').evaluateAll(els=>els.every(el=>{
        const frame=el.closest('.planning-preview').getBoundingClientRect();
        return el.getBoundingClientRect().right<=frame.right && el.scrollWidth<=el.clientWidth+1;
      })),'Expanded cash figures fit without clipping');
      await page.locator('.planning-preview').first().locator('summary').click();
      assert.equal(await page.locator('.local-housing-help details').count(),0,'Place help links stay compact');
      assert.equal(await page.locator('.local-help-links').count(),0,'Official help cards live on the help tool, not place pages');
      assert.equal(await page.locator('.bar-help-route[href="/help"]').count(),2,'Housing help remains in shared navigation');
      await page.locator('.place-evidence-group').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
      assert(await page.locator('.learning-exhibit').evaluateAll(els=>els.every(el=>{
        const card=el.getBoundingClientRect(), gallery=el.closest('.exhibit-gallery').getBoundingClientRect();
        return card.left>=gallery.left-1 && card.right<=gallery.right+1;
      })),'Paired and full-width factual exhibits fit the gallery');
      assert(await page.locator('.migration-flows a').evaluateAll(els=>els.every(el=>el.classList.contains('destination-county'))),'Migration destinations carry the county colour class');
      await page.locator('.mortgage-rate-details summary').click();
      assert(await page.locator('.rate-scenarios').isVisible());
      assert(await page.locator('.mortgage-rate-details .reader-details-body').evaluate(el=>getComputedStyle(el).overflowX==='auto'),'Rate table has accessible overflow');
      assert(await page.locator('.mortgage-rate-details .rate-scenarios').evaluate(el=>{
        const table=el.getBoundingClientRect(), body=el.closest('.reader-details-body').getBoundingClientRect();
        return table.left>=body.left-1 && table.right<=body.right+1;
      }),'Rate table fits its disclosure on desktop and mobile');
      assert.equal(await page.locator('.place-next-destinations, .place-guide-entry, .local-housing-help').count(),0,'Duplicate guide and housing-help cards are removed');
      assert(await page.locator('.quiet-tool-group a[href^="/guide?place="]').isVisible(),'Place-aware guide remains in Make it yours');
      assert(await page.locator('#local-price-history, .who-is-moving, .similar-places, .county-place-directory').evaluateAll(els=>els.every(el=>{
        const frame=el.closest('.learning-exhibit')??el;
        return parseFloat(getComputedStyle(frame).paddingLeft)>=16 && parseFloat(getComputedStyle(frame).paddingRight)>=16;
      })),'Visible context retains comfortable text insets');
      assert(await page.locator('.budget-basics').getByLabel('Yearly household income before tax',{exact:true}).isVisible(),'Make it yours income is not hidden');
      assert(await page.getByLabel('Rent you’d pay instead, a month',{exact:true}).isVisible(),'Make it yours rent is not hidden');
      if(await page.locator('.history-interactive input').count()) {
        await page.locator('.history-interactive input').focus();
        await page.locator('.history-interactive input').press('Home');
        assert(await page.locator('.history-interactive input').getAttribute('aria-valuetext'),'History slider names the selected year');
      }
      await page.getByRole('button',{name:'Pause artwork',exact:true}).click();
      assert.equal(await page.locator('.exhibit-gallery').getAttribute('data-motion'),'paused');
      assert.equal(await page.locator('#local-property-evidence').evaluate(el=>el.tagName),'SECTION','Evidence has no second property accordion');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Place has no horizontal overflow');
      if(path==='/nj/somerset-county') await page.locator('.local-understand-group').screenshot({path:`/tmp/exhibits-${width}-${theme}.png`});
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
    assert.equal(await page.locator('.guide-question-tagline').count(),0,'Repeated question tagline is removed');
    await page.getByRole('button',{name:'03 Before an offer',exact:true}).click();
    assert.equal(await page.locator('.guide-check-index a').count(),10,'All ten offer checks have a compact preview');
    assert(await page.locator('.guide-check-index a').evaluateAll(els=>els.every(el=>document.querySelector(el.getAttribute('href')))),'Every preview links to its visible primary check');
    assert.equal(await page.getByLabel('Purchase price',{exact:true}).inputValue(),'','Another place does not inherit listing price');
    await page.goto(origin+'/guide?place=12',{waitUntil:'networkidle'});
    await page.locator('.guide-answer[data-ready="true"]').first().waitFor({timeout:30000});
    assert.equal(await page.locator('.guide-contents button').count(),3);
    assert.equal(await page.locator('.guide-slide:visible').count(),1,'Only one guide question is visible');
    assert.equal(await page.locator('.guide-step-arrows').count(),0,'No buried bottom arrow controls');
    assert(await page.locator('.guide-side-next').evaluate(el=>{
      const arrow=el.getBoundingClientRect();
      const panel=document.querySelector('.guide-slide[data-active="true"]').getBoundingClientRect();
      return arrow.height>=100 && arrow.left>=panel.right;
    }),'Large next arrow sits outside the card in its side gutter');
    await page.locator('#guide-step-selector').scrollIntoViewIfNeeded();
    const beforeStep=await page.evaluate(()=>scrollY);
    await page.getByRole('button',{name:'02 Rent or buy?',exact:true}).click();
    await page.waitForTimeout(250);
    assert(Math.abs((await page.evaluate(()=>scrollY))-beforeStep)<2,'Question shortcut does not force scrolling');
    await page.getByRole('button',{name:'01 Can I afford it?',exact:true}).click();
    await page.getByRole('button',{name:'Next: Rent or buy?',exact:true}).click();
    assert(await page.locator('#guide-panel-1').isVisible(),'Next arrow advances the question');
    await page.getByRole('button',{name:'01 Can I afford it?',exact:true}).click();
    await page.getByLabel('Yearly household income, before tax',{exact:true}).fill('120000');
    await page.locator('.guide-assumptions summary').click();
    await page.getByLabel('Purchase price',{exact:true}).fill('350000');
    await page.getByLabel('Property tax a year',{exact:true}).fill('6000');
    await page.getByLabel('HOA or condo fees a month',{exact:true}).fill('200');
    assert((await page.locator('#guide-afford-heading').locator('..').locator('..').textContent()).includes('Your purchase price of'),'Reader price not credited to a publisher');
    assert(await page.getByText('Upfront cash:',{exact:false}).isVisible());
    await page.getByRole('button',{name:'02 Rent or buy?',exact:true}).click();
    assert.equal(await page.getByLabel('Purchase price',{exact:true}).inputValue(),'350000','Changing steps preserves home figures');
    await page.getByRole('button',{name:'03 Before an offer',exact:true}).click();
    assert.equal(await page.locator('.guide-check-group').count(),3);
    assert.equal(await page.locator('.guide-check-group .guide-check').count(),10);
    assert.equal(await page.locator('.guide-check-group details').count(),0,'No hidden primary checklist actions');
    assert.equal(await page.locator('.guide-checks').locator('..').filter({has:page.locator('summary')}).count(),1,'One checklist supporting appendix');
    assert(await page.locator('.guide-help-shortcut[href="/help"]').isVisible(),'Help stays available outside the steps');
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.guide-slide:visible').count(),3,'Printing includes all three answers');
    await page.emulateMedia({media:'screen'});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Guide has no horizontal overflow');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`/tmp/place-guide-focus-${width}-${theme}.png`,fullPage:true});
    await page.goto(origin+'/guide?place=224#guide-check-water',{waitUntil:'networkidle'});
    await page.locator('#guide-check-water').waitFor({state:'visible',timeout:30000});
    assert(await page.locator('#guide-panel-2').isVisible(),'Direct check link opens the correct step');
    await page.close();
  }
} finally { await browser.close(); }
