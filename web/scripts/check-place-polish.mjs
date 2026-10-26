import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.PLACE_PREVIEW_ORIGIN ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  for (const path of (process.env.PLACE_PATHS ?? '/nj/princeton,/nj/mercer-county,/nj/zip-08510').split(',')) {
    for (const width of (process.env.PLACE_WIDTHS ?? '1440,900,768,390,320').split(',').map(Number)) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: width === 768 ? 'dark' : 'light', reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
      const gallery = page.locator('.exhibit-gallery');
      await gallery.locator('.place-evidence-group').evaluateAll(nodes => nodes.forEach(n => n.open = true));
      const frame = await gallery.boundingBox();
      // Tall evidence receives a complete row instead of leaving a blank half-row.
      for (const kind of ['Income & housing pressure', 'Arrivals & departures', 'Building & demolition', 'Ground & water']) {
        const exhibit = gallery.locator(`[data-exhibit="${kind}"]`);
        if (!await exhibit.count()) continue;
        const box = await exhibit.boundingBox();
        assert(Math.abs(box.width - frame.width) < 2, `${kind} should occupy a full row`);
      }
      const compact = gallery.locator('.place-exhibit-pair').last().locator(':scope > .learning-exhibit');
      if (await compact.count() === 2) {
        const a = await compact.nth(0).boundingBox(), b = await compact.nth(1).boundingBox();
        if (width > 900) {
          assert(Math.abs(a.y - b.y) < 2 && b.x > a.x, 'Compact comparisons share a row');
          assert(Math.abs(a.height - b.height) < 2, 'Paired cards have aligned frames');
        } else assert(b.y >= a.y + a.height, 'Compact comparisons follow reading order on small screens');
      }
      const cards = gallery.locator('.learning-exhibit');
      const surfaces = await cards.evaluateAll(nodes => nodes.map(n => ({ background: getComputedStyle(n).backgroundImage, radius: getComputedStyle(n).borderRadius })));
      assert(surfaces.every(s => s.background === 'none' && s.radius === '12px'));
      const question = gallery.locator('#state-loans-exhibit');
      assert(await question.evaluate(n => parseFloat(getComputedStyle(n).fontSize)) > await page.locator('#field-notes').evaluate(n => parseFloat(getComputedStyle(n).fontSize)));
      const inputs = page.locator('.budget-inputs input, .budget-inputs select');
      const boxes = await inputs.evaluateAll(nodes => nodes.map(n => { const r=n.getBoundingClientRect(); return {y:r.y, height:r.height, width:r.width}; }));
      assert.equal(boxes.length, 4);
      assert(boxes.every(b => b.height >= 44 && b.width > 0));
      if (width > 760) { assert(Math.abs(boxes[0].y - boxes[1].y) < 2, 'First pair aligns'); assert(Math.abs(boxes[2].y - boxes[3].y) < 2, 'Second pair aligns'); }
      await page.locator('.budget-basics').getByLabel('Yearly household income before tax', { exact: true }).fill('100000');
      assert(await page.locator('.budget-basics h4').innerText().then(t => t.includes('Owning uses')));
      await page.locator('.budget-basics').getByLabel('Rent you’d pay instead, a month', { exact: true }).fill('2200');
      assert(await page.locator('.cost-cards > .cost-card').nth(1).innerText().then(t => t.includes('$2,200')));
      const loanSummary = gallery.locator('[data-exhibit="Buyer financing"] > .exhibit-content > section > details > summary');
      await loanSummary.focus();
      await page.keyboard.press('Enter');
      assert(await loanSummary.evaluate(n => n.parentElement.open), 'Native disclosure works with keyboard');
      assert.equal(await loanSummary.evaluate(n => getComputedStyle(n, '::after').content), '""', 'One consistent chevron replaces mixed plus indicators');
      assert(await loanSummary.evaluate(n => n.getBoundingClientRect().height >= 44));
      await page.keyboard.press('Enter');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} ${width} overflow`);
      await page.locator('main').evaluate(n => n.scrollIntoView({ block: 'start' }));
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).include('main').analyze();
      assert.deepEqual(scan.violations.map(v => ({id:v.id,targets:v.nodes.map(n=>n.target)})), []);
      assert.deepEqual(errors, []);
      console.log(`${path} ${width}: grid, hierarchy, panel surfaces, inputs, disclosures, overflow and WCAG passed`);
      await context.close();
    }
  }
} finally { await browser.close(); }
