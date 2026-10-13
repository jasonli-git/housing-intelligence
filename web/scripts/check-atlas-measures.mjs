import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
  for(const width of [390,1280]) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:1100},colorScheme:theme,reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto('http://localhost:3002/atlas?level=county&measure=acs_median_hh_income&view=latest&place=12&lon=-96&lat=30&zoom=1.4');
    await page.locator('[data-county="12"]').waitFor();
    assert.equal(await page.locator('.housing-atlas').getAttribute('data-level'),'county');
    assert.equal(await page.getByLabel('Measure',{exact:true}).inputValue(),'acs_median_hh_income');
    assert.equal(await page.getByLabel('Measure',{exact:true}).locator('option').count(),5);
    assert.equal(await page.locator('.atlas-selected h3').textContent(),'Somerset County');
    await page.getByRole('button',{name:'Browse all measures',exact:true}).click();
    await page.getByLabel('Search measures',{exact:true}).fill('gross rent');
    const results=page.locator('.atlas-measure-picker button[aria-pressed]');
    assert.equal(await results.count(),1);
    assert((await results.textContent()).includes('rent'));
    const audit=await new AxeBuilder({page}).include('.atlas-controls').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    await results.click();
    assert.equal(await page.getByLabel('Measure',{exact:true}).inputValue(),'acs_median_gross_rent');
    await page.waitForTimeout(250);
    assert(new URL(page.url()).searchParams.get('measure')==='acs_median_gross_rent');
    await page.reload();
    assert.equal(await page.getByLabel('Measure',{exact:true}).inputValue(),'acs_median_gross_rent');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`/tmp/atlas-measures-${width}-${theme}.png`});
    console.log(`PASS ${width} ${theme}: shortlist, searchable measures, URL restore, picker accessibility, reflow`);
    await context.close();
  }
} finally {await browser.close();}
