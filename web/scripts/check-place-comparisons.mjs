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
    assert(spacing.gaps.every(gap=>Math.abs(gap-spacing.expected)<1),'one consistent main-section gap');
    const headingFonts=await page.evaluate(()=>['#place-market-heading','#place-understand > h2'].map(selector=>{
      const style=getComputedStyle(document.querySelector(selector));
      return [style.fontFamily,style.fontSize,style.fontWeight,style.lineHeight];
    }));
    assert.deepEqual(headingFonts[0],headingFonts[1],'About this place matches the market heading');
    assert.equal(await ranks.locator('details').count(),0);
    assert.equal(await page.locator('.standouts-disclosure').count(),0);
    assert.equal(await ranks.locator('li').count(),5);
    assert((await ranks.locator('ul').boundingBox()).height<180);
    assert(await ranks.evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('#place-story-gallery'))&Node.DOCUMENT_POSITION_FOLLOWING)));
    await ranks.hover();
    const next=ranks.getByRole('button',{name:'Next ranked measures'});
    assert.equal(await next.evaluate(e=>e.className),await page.getByRole('button',{name:'Next local stories'}).evaluate(e=>e.className),'shared frosted-glass arrow styling');
    await next.click();
    await page.waitForFunction(()=>!document.querySelector('[aria-label="Previous ranked measures"]').disabled);
    await ranks.getByRole('button',{name:'Previous ranked measures'}).click();
    const links=ranks.locator('ul a');
    await links.first().focus();await page.keyboard.press('End');
    assert(await links.last().evaluate(e=>e===document.activeElement));
    await page.waitForFunction(()=>document.querySelector('[aria-label="Next ranked measures"]').disabled);
    await page.keyboard.press('Home');
    assert(await links.first().evaluate(e=>e===document.activeElement));
    assert.equal(await alternatives.locator('ul > li').count(),3);
    assert.equal(await alternatives.locator('table').count(),0);
    assert((await alternatives.innerText()).includes('not schools or safety'));
    const alternativesFont=await page.locator('#similar-places-heading').evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight];});
    assert.deepEqual(alternativesFont,headingFonts[1],'Alternatives matches About this place');
    await alternatives.locator('summary').click();
    assert((await alternatives.innerText()).includes('Other matches:'));
    await alternatives.locator('summary').click();
    await alternatives.getByRole('link',{name:'Compare places →'}).click();
    await page.getByRole('heading',{name:'Compare places',exact:true}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('places').split(',').length,4);
    await page.goBack({waitUntil:'networkidle'});
    await ranks.waitFor();
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    // Audit settled colors, not the theme/color transition after history restoration.
    await page.waitForFunction(()=>!document.getAnimations().some(a=>a.constructor.name==='CSSTransition'&&a.playState==='running'));
    assert.deepEqual((await new AxeBuilder({page}).include('section[aria-labelledby="place-comparisons-heading"]').include('section[aria-labelledby="similar-places-heading"]').analyze()).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(width===390||width===1440){
      await ranks.screenshot({path:`/tmp/comparisons-final-${width}-${theme}.png`});
      await alternatives.screenshot({path:`/tmp/alternatives-final-${width}-${theme}.png`});
    }
    console.log(`${width}/${theme}: visible ranking rail, compact alternatives, details, comparison/back, overflow and axe passed`);
    await context.close();
  }
  const page=await browser.newPage();
  await page.goto(`${origin}/nj/hoboken`,{waitUntil:'networkidle'});
  assert.equal(await page.locator('#place-comparisons-heading').count(),0);
  assert(await page.locator('.standouts-disclosure').count()>0);
  assert(await page.locator('.similar-places').count()>0);
  console.log('Nonpilot Hoboken retains its original rankings/alternatives treatment');
} finally { await browser.close(); }
