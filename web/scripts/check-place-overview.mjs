import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.PLACE_PREVIEW_ORIGIN ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  for (const path of (process.env.PLACE_PATHS ?? '/nj/princeton,/nj/mercer-county,/nj/zip-07030,/nj/zip-08510,/nj/zip-07311').split(',')) {
    for (const width of [1440, 768, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', colorScheme: width === 768 ? 'dark' : 'light' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
      const nav = page.getByRole('navigation', { name: 'Place sections' });
      const cost = page.locator('.place-cost-overview');
      assert.equal(await page.locator('.place-next-destinations, .place-guide-entry, .local-housing-help').count(), 0);
      assert(await page.getByRole('heading', { name: 'About this place', exact: true }).isVisible());
      const hasCosts = await cost.count() > 0;
      assert.equal(hasCosts, !path.endsWith("zip-07311"));
      assert(await page.getByRole('link', { name: /^Compare .* with other places$/ }).getAttribute('href').then(s => s.startsWith('/compare?places=')));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} ${width} overflow`);
      if (hasCosts) {
      const heading = await cost.locator(':scope > .section-head h2').boundingBox();
      // The numbered kicker sits above the title; the costs follow the market section.
      assert(heading.height < 140, 'Cost heading should remain compact');
      assert(await cost.locator('.cost-fine-print').isVisible());
      // The down payment is one of the reader's own numbers, behind "Use your numbers".
      await cost.locator('.cost-use-numbers > summary').click();
      const down = cost.locator('.cost-use-numbers select').first();
      const before = await cost.locator('.cost-figure').first().innerText();
      await down.selectOption('10');
      assert.notEqual(await cost.locator('.cost-figure').first().innerText(), before);
      } else {
        assert(await page.locator('.cost-missing').isVisible());
        assert(await page.getByRole('region', { name: 'Housing profile' }).isVisible());
      }
      await page.getByRole('heading', { name: 'About this place', exact: true }).evaluate(node => node.scrollIntoView({ block: 'start' }));
      const navBox = await nav.boundingBox();
      const barBox = await page.locator('.bar').boundingBox();
      assert(Math.abs(navBox.y - barBox.height) < 2, `Navigator should stay under masthead: ${navBox.y}, ${barBox.height}`);
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).include('main').include('nav[aria-label="Place sections"]').analyze();
      assert.deepEqual(scan.violations.map(v => ({id:v.id, targets:v.nodes.map(n=>n.target)})), []);
      assert.deepEqual(errors, []);
      console.log(`${path} ${width}: overview, inputs, sticky nav, overflow and axe passed`);
      await context.close();
    }
  }
} finally { await browser.close(); }
