import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin=process.env.ART_ORIGIN ?? 'http://localhost:3000';
const browser=await chromium.launch();
try {
  for (const width of [1280,390,320]) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    await page.goto(`${origin}/regions/12`,{waitUntil:'networkidle'});
    const portrait=page.locator('.vacancy-portrait');
    await portrait.getByRole('button',{name:'Earlier estimate'}).click();
    assert.equal(await portrait.getByRole('button',{name:'Earlier estimate'}).getAttribute('aria-pressed'),'true');
    const earlier=await portrait.locator('[data-empty="true"]').count();
    await portrait.getByRole('button',{name:'Latest estimate'}).click();
    assert.notEqual(await portrait.locator('[data-empty="true"]').count(),earlier);
    assert.equal(await page.locator('.stock-flow').count(),0,'Somerset inconsistent reported totals remain disconnected');
    const dots=page.locator('.constellation-field button');
    assert.equal(await dots.count(),21);
    const boxes=await dots.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
      const a=boxes[i],b=boxes[j];
      assert(!(a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y),'County tap targets do not overlap');
    }
    await dots.last().focus();
    assert.equal(await dots.last().getAttribute('aria-pressed'),'true');
    await dots.first().click();
    assert.equal(await dots.first().getAttribute('aria-pressed'),'true');
    const cost=page.locator('.cost-composition');
    await cost.getByRole('button',{name:/Principal/}).click();
    assert.match(await cost.locator('.portrait-note').first().innerText(),/Principal.*% of the included total/);
    await cost.getByRole('button',{name:'Show included total'}).click();
    assert.equal(await cost.locator('button[aria-pressed="true"]').count(),0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.goto(`${origin}/regions/205`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('.stock-flow').count(),1,'Reconciled reported stock is visualized');
    assert.equal(await page.locator('.stock-equation strong').allTextContents().then(values=>values.join(',')),'20,14,6');
    await page.goto(`${origin}/regions/23`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('.stock-equation strong').last().innerText(),'-1','Negative net change retains its sign');
    console.log(`PASS data portrait interactions ${width}px`);
    await page.close();
  }
  // Manual choice wins over the one-time automatic transition.
  const page=await browser.newPage({reducedMotion:'no-preference'});
  await page.goto(`${origin}/regions/12`,{waitUntil:'networkidle'});
  const earlier=page.locator('.vacancy-portrait').getByRole('button',{name:'Earlier estimate'});
  await earlier.click();
  await page.waitForTimeout(1400);
  assert.equal(await earlier.getAttribute('aria-pressed'),'true');
  console.log('PASS manual vacancy selection cancels autoplay');
} finally {await browser.close();}
