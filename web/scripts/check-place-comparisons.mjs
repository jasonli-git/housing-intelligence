import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const origin=process.env.SITE_URL??'http://localhost:3002';
const browser=await chromium.launch();
try {
  for(const width of [320,390,768,1440]) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(`${origin}/nj/princeton`,{waitUntil:'networkidle'});
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const ranks=page.locator('section[aria-labelledby="place-comparisons-heading"]');
    const alternatives=page.locator('section[aria-labelledby="similar-places-heading"]');
    const spacing=await page.evaluate(()=>{
      const selectors=['nav[aria-label="Place sections"]','#place-market','#quiet-cost > section','#place-understand','#place-explore > section'];
      const boxes=selectors.map(s=>document.querySelector(s).getBoundingClientRect());
      return {expected:parseFloat(getComputedStyle(document.querySelector('#quiet-cost')).marginTop),gaps:boxes.slice(1).map((box,i)=>box.top-boxes[i].bottom)};
    });
    // The first gap (navigator to market) is deliberately tighter; the four sections share one.
    assert(spacing.gaps.slice(1).every(gap=>Math.abs(gap-spacing.expected)<1),'one consistent main-section gap');
    assert(spacing.gaps[0]>0&&spacing.gaps[0]<spacing.expected,'a tighter opening before the market');
    const headingFonts=await page.evaluate(()=>['#place-market-heading','#place-about-heading'].map(selector=>{
      const style=getComputedStyle(document.querySelector(selector));
      return [style.fontFamily,style.fontSize,style.fontWeight,style.lineHeight];
    }));
    assert.deepEqual(headingFonts[0],headingFonts[1],'About this place matches the market heading');
    assert.equal(await page.locator('#place-about-frame section[aria-labelledby="place-comparisons-heading"]').count(),1);
    assert.equal(await page.locator('#place-about-frame #place-story-gallery').count(),1);
    assert.equal(await page.locator('#place-story-gallery #community-schools-heading').count(),1,'schools are a local story');
    const profile=page.locator('#place-housing-profile');
    assert.equal(await profile.locator('[data-profile-primary] article').count(),3);
    assert.equal(await profile.locator('[data-profile-more]').count(),1);
    assert.equal(await page.locator('#place-about-frame #place-housing-profile').count(),0,'profile is outside the About card');
    assert(await profile.evaluate(e=>e.parentElement===document.querySelector('#place-about-frame').parentElement),'profile and About card are siblings');
    assert(await profile.evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('#place-comparisons-heading'))&Node.DOCUMENT_POSITION_FOLLOWING)));
    if(width>1000) assert((await profile.boundingBox()).x<(await ranks.boundingBox()).x,'profile sits left of ranked measures');
    await profile.getByText('More about the housing here',{exact:false}).click();
    assert(await profile.locator('[data-profile-more] article').count()>0);
    await profile.getByText('More about the housing here',{exact:false}).click();
    assert.equal(await ranks.locator('details').count(),0);
    assert.equal(await page.locator('.standouts-disclosure').count(),0);
    assert.equal(await page.locator('.place-overview-context').count(),0,'duplicate cost sidebar removed');
    assert.equal(await ranks.locator('a a').count(),0,'revision links are not nested in measure links');
    for(const notice of await ranks.locator('.figure-updated a').all()) assert.equal(await notice.getAttribute('href'),'/changes');
    assert.equal(await ranks.locator('li').count(),1,'only the standout: the property tax bill');
    assert.equal(await ranks.getByRole('button',{name:'Next ranked measures'}).count(),0,'a single standout is a plain row, not a carousel');
    assert((await ranks.locator('ul').boundingBox()).height<230);
    assert(await ranks.evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('#place-story-gallery'))&Node.DOCUMENT_POSITION_FOLLOWING)));
    // The rail lists only standout measures; carousel motion needs two or more.
    if(await ranks.locator('ul a[data-comparison-measure]').count()>2){
    await ranks.hover();
    const next=ranks.getByRole('button',{name:'Next ranked measures'});
    assert.equal(await next.evaluate(e=>e.className),await page.getByRole('button',{name:'Next local stories'}).evaluate(e=>e.className),'shared frosted-glass arrow styling');
    await next.click();
    await page.waitForFunction(()=>!document.querySelector('[aria-label="Previous ranked measures"]').disabled);
    await ranks.getByRole('button',{name:'Previous ranked measures'}).click();
    const links=ranks.locator('ul a[data-comparison-measure]');
    await links.first().focus();await page.keyboard.press('End');
    assert(await links.last().evaluate(e=>e===document.activeElement));
    await page.waitForFunction(()=>document.querySelector('[aria-label="Next ranked measures"]').disabled);
    await page.keyboard.press('Home');
    assert(await links.first().evaluate(e=>e===document.activeElement));
    }
    // The deployed alternatives section (SimilarPlaces), restored for the pilot.
    assert.equal(await alternatives.evaluate(e=>e.classList.contains('similar-places')),true,'deployed alternatives component');
    assert.equal(await alternatives.locator('table').count(),1);
    for(const notice of await ranks.locator('.figure-updated').all()) assert(await notice.evaluate(el=>!!el.closest('[data-comparison-card]')),'revision notice is inside its card');
    assert((await alternatives.innerText()).includes('not schools'));
    const alternativesFont=await page.locator('#similar-places-heading').evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight];});
    assert.deepEqual(alternativesFont,headingFonts[1],'Alternatives matches About this place');
    assert((await alternatives.innerText()).includes('Matched on'));
    await alternatives.getByRole('link',{name:/Compare these side by side/}).click();
    await page.getByRole('heading',{name:'Compare places',exact:true}).waitFor();
    await page.goBack({waitUntil:'networkidle'});
    await ranks.waitFor();
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    // Audit settled colors, not the theme/color transition after history restoration.
    await page.waitForFunction(()=>!document.getAnimations().some(a=>a.constructor.name==='CSSTransition'&&a.playState==='running'));
    assert.deepEqual((await new AxeBuilder({page}).include('#place-housing-profile').include('section[aria-labelledby="place-comparisons-heading"]').include('section[aria-labelledby="similar-places-heading"]').analyze()).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(width===390||width===1440){
      await ranks.screenshot({path:`/tmp/comparisons-final-${width}-${theme}.png`});
      await alternatives.screenshot({path:`/tmp/alternatives-final-${width}-${theme}.png`});
    }
    console.log(`${width}/${theme}: visible ranking rail, deployed alternatives, details, comparison/back, overflow and axe passed`);
    await context.close();
  }
  const page=await browser.newPage();
  await page.goto(`${origin}/nj/hoboken`,{waitUntil:'networkidle'});
  assert.equal(await page.locator('#place-comparisons-heading').count(),1,'Hoboken has the ranking rail');
  assert.equal(await page.locator('.standouts-disclosure').count(),0,'no old rankings disclosure');
  assert(await page.locator('#place-explore .similar-places').count()>0);
  console.log('Hoboken has the market-first rankings and alternatives');
} finally { await browser.close(); }
