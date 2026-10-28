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
    assert.equal(await ranks.locator('details').count(),0);
    assert.equal(await page.locator('.standouts-disclosure').count(),0);
    assert.equal(await ranks.locator('li').count(),5);
    assert((await ranks.locator('ul').boundingBox()).height<180);
    assert(await ranks.evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('#place-story-gallery'))&Node.DOCUMENT_POSITION_FOLLOWING)));
    await ranks.locator('a').last().focus();
    assert(await ranks.locator('a').last().evaluate(e=>e===document.activeElement));
    assert.equal(await alternatives.locator('ul > li').count(),3);
    assert.equal(await alternatives.locator('table').count(),0);
    assert((await alternatives.innerText()).includes('not schools or safety'));
    assert.equal(await page.locator('#similar-places-heading').evaluate(e=>getComputedStyle(e).fontSize),'18px');
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
