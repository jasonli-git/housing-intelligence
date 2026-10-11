import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch();
try {
  for(const width of [320,390,1280]) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto('http://localhost:3002/guide?place=224',{waitUntil:'networkidle'});
    await page.locator('.guide-contents button').nth(1).click();
    const stage=page.locator('.two-paths');
    await stage.waitFor({state:'visible',timeout:30000});
    const slider=stage.getByRole('slider',{name:/Explore year/});
    await slider.fill('5');
    assert.equal(await stage.locator('.paths-scrub b').textContent(),'5');
    await slider.focus();await page.keyboard.press('ArrowRight');
    assert.equal(await stage.locator('.paths-scrub b').textContent(),'6');
    const previous=await stage.locator('.paths-own-key').textContent();
    await stage.getByLabel('Try a purchase price',{exact:true}).fill('500000');
    assert.notEqual(await stage.locator('.paths-own-key').textContent(),previous);
    await stage.getByRole('combobox',{name:/Try a down payment/}).selectOption('3.5');
    assert((await stage.locator('.paths-readouts article').nth(1).textContent()).includes('$17,500'));
    const growth=page.getByLabel('Home prices, % a year',{exact:true});
    await growth.fill('3');await growth.blur();
    await stage.getByRole('button',{name:'Try no growth'}).click();
    assert.equal(await growth.inputValue(),'0');
    assert((await stage.locator('.paths-head').textContent()).includes('No growth assumed'));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
    const a11y=await new AxeBuilder({page}).include('.two-paths').analyze();
    assert.deepEqual(a11y.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    await stage.screenshot({path:`/tmp/two-paths-${width}-${theme}.png`});
    console.log(`${width} ${theme}: passed`);
    await context.close();
  }
} finally {await browser.close();}
