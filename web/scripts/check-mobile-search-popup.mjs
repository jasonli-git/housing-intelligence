import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
 for(const width of [320,390,600,768,1024,1280]) for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto('http://localhost:3002/',{waitUntil:'networkidle'});
  const input=page.locator('.coverage-search-panel input');await input.fill('a');
  const list=page.getByRole('listbox');await list.waitFor();
  assert.equal(await list.evaluate(e=>getComputedStyle(e).opacity),'1');
  const r=await list.boundingBox();
  // Exclude rounded corners/shadow: opaque interior must not depend on what's behind it.
  const clip={x:r.x+8,y:r.y+8,width:r.width-16,height:r.height-16};
  const before=await page.screenshot({clip});
  await page.screenshot({path:`/tmp/search-popup-${width}-${theme}.png`});
  const hide=await page.addStyleTag({content:'.coverage-map-content,.coverage-scale-slot,.national-backdrop {visibility:hidden !important}'});
  const after=await page.screenshot({clip});
  assert(before.equals(after),'Popup pixels changed when background art/counts were hidden');
  await hide.evaluate(e=>e.remove());
  const a=await new AxeBuilder({page}).include('.coverage-search-panel').analyze();
  assert.deepEqual(a.violations.map(v=>v.id),[]);
  await page.getByRole('option').first().click();
  await page.waitForURL(/\/nj\//);
  console.log(width,theme,'opaque, unobstructed, selectable');await context.close();
 }
}finally{await browser.close();}
