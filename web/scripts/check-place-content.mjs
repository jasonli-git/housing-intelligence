import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.PLACE_PREVIEW_ORIGIN ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  for (const path of (process.env.PLACE_PATHS ?? '/nj/princeton,/nj/mercer-county,/nj/zip-08510').split(',')) {
    for (const width of (process.env.PLACE_WIDTHS ?? '1440,768,390,320').split(',').map(Number)) {
      const context = await browser.newContext({viewport:{width,height:1000},colorScheme:width===768?'dark':'light',reducedMotion:'reduce'});
      const page = await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin+path,{waitUntil:'networkidle'});
      assert.equal(await page.locator('.place-evidence-group').count(),2);
      assert(await page.locator('.place-evidence-group').evaluateAll(nodes=>nodes.every(n=>!n.open)));
      assert(await page.locator('#state-work-exhibit').isVisible());
      const sales=page.locator('#sales-heading');
      if(await sales.count()) {
        assert.equal(await sales.innerText(),'Recent sale prices');
        assert(await page.getByText('Sold homes only; changes can reflect which homes sold.',{exact:true}).isVisible());
        const choices=page.locator('.sale-exhibit .exhibit-choice button');
        if(await choices.count()>1) {
          const before=await page.locator('.sale-exhibit .exhibit-readout strong').innerText();
          await choices.last().click();
          assert.notEqual(await page.locator('.sale-exhibit .exhibit-readout strong').innerText(),before);
        }
        await page.getByText('View sale details',{exact:true}).click();
        assert(await page.getByText(/Only arm’s-length sales the state accepts/).isVisible());
        await page.getByText('View sale details',{exact:true}).click();
      }
      const words=(await page.locator('main').innerText()).trim().split(/\s+/).length;
      const scan=async state=>{
        await page.locator('main').evaluate(n=>n.scrollIntoView({block:'start'}));
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).include('main').analyze();
        assert.deepEqual(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${path} ${width} ${state}`);
      };
      await scan('default');
      const more=page.locator('#more-market-evidence');
      await more.locator(':scope > summary').focus();
      await page.keyboard.press('Enter');
      assert(await more.evaluate(n=>n.open));
      assert(await page.locator('#state-loans-exhibit').isVisible());
      const migration=more.locator('.who-is-moving');
      if(await migration.count()) {
        assert(await migration.locator('.migration-exhibit').isVisible());
        const details=migration.locator(':scope > .reader-details');
        assert(!await details.evaluate(n=>n.open));
        await details.locator(':scope > summary').click();
        assert(await details.getByRole('link',{name:/IRS’s migration data/}).isVisible());
        assert(await migration.getByText(/county-to-county migration data/).isVisible());
      }
      const nav=page.getByRole('navigation',{name:'Place sections'});
      await nav.getByRole('link',{name:'Living there',exact:true}).click();
      assert(await page.locator('#about-living-there').evaluate(n=>n.open));
      assert(await page.locator('#about-living-there > summary').evaluate(n=>n===document.activeElement));
      await scan('expanded');
      // Existing deep links must reveal the new enclosing disclosures after reload.
      await page.goto(origin+path+'#local-price-history',{waitUntil:'networkidle'});
      if(await page.locator('#local-price-history').count()) {
        assert(await more.evaluate(n=>n.open));
        assert(await page.locator('#local-price-history').isVisible());
      }
      await page.goto(origin+path+'#ground-water-heading',{waitUntil:'networkidle'});
      assert(await page.locator('#about-living-there').evaluate(n=>n.open));
      assert(await page.locator('#ground-water-heading').isVisible());
      if(width===1440) {
        await page.goto(origin+path,{waitUntil:'networkidle'});
        await page.emulateMedia({media:'print'});
        assert(await page.locator('#ground-water-heading').isVisible(),'Closed supporting evidence remains printable');
      }
      assert.deepEqual(errors,[]);
      console.log(`${path} ${width}: ${words} default words; primary evidence, disclosures, controls, deep links, WCAG and overflow passed`);
      await context.close();
    }
  }
} finally { await browser.close(); }
