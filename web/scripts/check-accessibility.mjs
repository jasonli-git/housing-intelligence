import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const origin = process.env.A11Y_ORIGIN ?? 'http://localhost:3000';
const output = process.env.A11Y_OUTPUT ?? '/tmp/hip-accessibility.json';
const paths = (process.env.A11Y_PATHS ?? '/,/states/new-jersey,/nj/atlantic-county,/nj/absecon,/nj/zip-07001,/afford?income=120000,/tax,/freshness,/changes,/nj/atlantic-county/report,/stories,/stories/twin-towns,/stories/the-starbucks-index').split(',');
const widths = (process.env.A11Y_WIDTHS ?? '1440,390').split(',').map(Number);
const themes = (process.env.A11Y_THEMES ?? 'light,dark').split(',');
const browser = await chromium.launch();
const results = [];
try {
  for (const width of widths) {
    for (const theme of themes) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
      for (const path of paths) {
        const page = await context.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        try {
        const response = await page.goto(`${origin}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
        if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
        await page.locator('main h1').first().waitFor();
        const heading = await page.locator('main h1').first().textContent();
        if (/no report|not found|unavailable/i.test(heading ?? '')) throw new Error(`Unexpected fallback page: ${heading}`);
        // Skip navigation must transfer focus, not just scroll behind the sticky bar.
        await page.keyboard.press('Tab');
        if (await page.locator('.skip-link').evaluate(node => node !== document.activeElement)) throw new Error('Skip link is not first in tab order');
        await page.keyboard.press('Enter');
        if (await page.locator('#main-content').evaluate(node => node !== document.activeElement)) throw new Error('Skip link does not focus main content');
        for (const state of ['default', 'expanded']) {
        if (state === 'expanded') {
          // The page's own disclosures; the masthead's Tools menu is a dropdown that
          // covers content by design when open, so forcing it open is not a real state.
          await page.locator('main details').evaluateAll(nodes => nodes.forEach(node => node.open = true));
          // Exercise ordinary tables/charts and source definitions, not just the hero.
          await page.locator('main').evaluate(node => node.scrollIntoView());
        }
        const scan = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
        const entry = { path, width, theme, state, errors, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), violations: scan.violations.map(({id,impact,description,helpUrl,nodes})=>({id,impact,description,helpUrl,nodes:nodes.map(({target,failureSummary})=>({target,failureSummary}))})), incomplete:scan.incomplete.map(({id,nodes})=>({id,nodes:nodes.map(({target,failureSummary})=>({target,failureSummary}))})) };
        results.push(entry);
        console.log(`${width} ${theme} ${path} ${state}: ${entry.violations.map(v=>`${v.id}(${v.nodes.length})`).join(', ') || 'no axe violations'}${entry.overflow?' OVERFLOW':''}`);
        }
        } catch (error) {
          results.push({path,width,theme,state:'error',errors:[...errors,String(error)],violations:[],incomplete:[],overflow:false});
          console.error(`${width} ${theme} ${path}: ${error}`);
        }
        await page.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(results,null,2));
}
if(results.some(r=>r.errors.length || r.violations.length || r.overflow)) process.exitCode=1;
