import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const browser=await chromium.launch();
try {
  for(const width of [320,390,814,1243]) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:1222},colorScheme:theme,reducedMotion:width===320?'reduce':'no-preference'});
    const page=await context.newPage();
    await page.goto('http://localhost:3002/states/new-jersey');
    const strip=page.locator('.county-strip'), track=page.locator('.county-strip-track');
    assert.equal(await strip.locator('a').count(),21);
    assert.equal(await page.locator('.cabinet-stage,.cabinet-preview').count(),0);
    assert(await strip.evaluate(n=>n.getBoundingClientRect().height<=70));
    assert(await page.evaluate(()=>document.querySelector('.county-strip').compareDocumentPosition(document.querySelector('#state-overview')) & Node.DOCUMENT_POSITION_FOLLOWING));
    await page.getByRole('button',{name:'Scroll counties right'}).click();
    await page.waitForFunction(()=>document.querySelector('.county-strip-track').scrollLeft>30);
    const first=strip.locator('a').first(), last=strip.locator('a').last();
    await first.focus(); await first.press('End'); assert(await last.evaluate(n=>n===document.activeElement));
    await last.press('Home'); assert(await first.evaluate(n=>n===document.activeElement));
    assert(await page.locator('#county-comparison').isVisible());
    assert.equal(await page.locator('#nj-explore .place-search').count(),0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const audit=await new AxeBuilder({page}).include('.county-strip').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v=>v.id),[]);
    await strip.scrollIntoViewIfNeeded();
    await page.screenshot({path:`/tmp/county-strip-${width}-${theme}.png`});
    const href=await first.getAttribute('href'); await first.click(); await page.waitForURL(new RegExp(href+'$'));
    console.log(`PASS ${width} ${theme}: 21 destinations, compact placement, scrolling, keyboard, direct comparison, axe, county navigation`);
    await context.close();
  }
} finally { await browser.close(); }
