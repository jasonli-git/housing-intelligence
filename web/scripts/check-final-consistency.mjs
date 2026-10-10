import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.A11Y_ORIGIN ?? 'http://localhost:3002';
const paths = ['/', '/states/new-jersey', '/regions/12', '/regions/224', '/regions/2842', '/afford?county=all', '/guide', '/tax', '/freshness', '/changes', '/404.html'];
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({viewport:{width:390,height:900},colorScheme:theme,reducedMotion:'reduce'});
    for (const path of paths) {
      const page = await context.newPage();
      await page.goto(origin+path,{waitUntil:'networkidle'});
      await page.locator('main h1').first().waitFor();
      const menu = page.locator('.bar-tool-menu');
      await menu.locator('summary').focus();
      await page.keyboard.press('Enter');
      assert.equal(await menu.evaluate(n=>n.open),true, `${path}: keyboard-opened tools`);
      const links = menu.locator('a');
      const hrefs=await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
      assert.deepEqual(hrefs.filter(h=>h!=='/afford?county=all'), ['/guide','/tax']);
      if (!hrefs.includes('/afford?county=all')) {
        if (await menu.locator('.bar-budget').count()) assert.equal(await menu.locator('.bar-budget:disabled').count(),1,`${path}: unavailable budget tool is disabled`);
        else assert.ok(['/', '/404.html', '/freshness', '/changes'].includes(path),`${path}: budget tool deliberately omitted on utility/entry pages`);
      }
      await links.first().focus();
      assert.equal(await links.first().evaluate(n=>n===document.activeElement),true);
      await menu.locator('summary').focus();
      await page.keyboard.press('Enter');
      const term = page.locator('main .term').first();
      if (await term.count()) {
        await term.scrollIntoViewIfNeeded();
        await term.focus();
        const tip = page.locator('.floating-tip');
        await tip.waitFor();
        const box = await tip.boundingBox();
        assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=391 && box.y+box.height<=901,`${path}: definition stays in viewport`);
        await page.keyboard.press('Escape');
        await tip.waitFor({state:'detached'});
        assert.equal(await term.evaluate(n=>n===document.activeElement),true);
      }
      if (path==='/404.html') {
        assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
        assert.equal(await page.getByRole('combobox',{name:'Search by state, town, county or ZIP code'}).count(),1);
        const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        assert.deepEqual(scan.violations.map(v=>v.id),[]);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      console.log(`PASS consistency ${path} ${theme}: mobile tools, definition bounds/Escape where present, reflow`);
      await page.close();
    }
    await context.close();
  }
} finally {await browser.close();}
