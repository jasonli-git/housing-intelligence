import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {
 for(const width of [390,1280]) for(const theme of ['light','dark']) for(const motion of ['reduce','no-preference']) {
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:motion,hasTouch:width<600});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.__themeSnapshots=[];
    window.__snapshotCalls=0;
    const original=document.startViewTransition?.bind(document);
    if(original) document.startViewTransition=update=>{
      window.__snapshotCalls++;
      const t=original(update);
      t.ready.then(()=>{
        if(document.documentElement.hasAttribute('data-theme-reveal')) window.__themeSnapshots.push(
          [...document.querySelectorAll('.coverage-focused-entry,.coverage-map,.national-strip')].map(e=>getComputedStyle(e).viewTransitionName)
        );
      }).catch(()=>{});
      return t;
    };
  });
  await page.goto('http://localhost:3002/',{waitUntil:'networkidle'});
  const button=page.locator('.theme-toggle');
  const initialMapColor=await page.locator('.coverage-explore-inline').evaluate(e=>getComputedStyle(e).backgroundColor);
  await button.click();
  if(motion==='no-preference') {
    await page.waitForFunction(()=>window.__themeSnapshots.length>0);
    assert(await page.evaluate(()=>window.__themeSnapshots.every(names=>names.every(name=>name==='none'))),'Map fragments must be included in the single page reveal');
  }
  const start=Date.now();
  const bounds=await button.boundingBox();
  await button.evaluate(e=>{window.__themeClicks=0;e.addEventListener('click',()=>window.__themeClicks++);});
  for(let i=0;i<5;i++) {
    if(width<600) await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    else await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  }
  assert.equal(await page.evaluate(()=>window.__themeClicks),5,'Every rapid tap must reach the real selector');
  assert(Date.now()-start<1200,'Rapid taps should not wait for each 520ms reveal');
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-theme-reveal'));
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme??'system'),'system');
  assert.equal(await page.evaluate(()=>localStorage.getItem('housing-theme')),null);
  assert.equal(await page.locator('.coverage-explore-inline').evaluate(e=>getComputedStyle(e).backgroundColor),initialMapColor,'Controls must settle immediately, not tween through stale grey colors');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.paletteUpdate),undefined);
  assert.equal(await page.evaluate(()=>window.__snapshotCalls>0),motion==='no-preference');
  assert.equal(await button.getAttribute('aria-label'),`Switch to the ${theme==='dark'?'light':'dark'} theme`);
  assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--theme-radius')),'');
  assert.deepEqual(errors,[]);
  await page.waitForFunction(()=>!document.querySelector('.theme-palette-bloom'));
  await page.screenshot({path:`/tmp/theme-interrupt-${width}-${theme}-${motion}.png`});
  console.log(width,theme,motion,'every rapid tap delivered; latest palette persisted');await context.close();
 }
 // The shared control must remain interruptible with no snapshot API on tool pages.
 const context=await browser.newContext({viewport:{width:390,height:900},colorScheme:'dark'});
 const page=await context.newPage();await page.addInitScript(()=>{document.startViewTransition=undefined;});
 await page.goto('http://localhost:3002/guide',{waitUntil:'networkidle'});
 for(let i=0;i<7;i++) await page.locator('.theme-toggle').click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
 console.log('tool page / no View Transition API fallback passed');await context.close();
}finally{await browser.close();}
