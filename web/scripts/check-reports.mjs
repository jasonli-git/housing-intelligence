import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {execFileSync} from 'node:child_process';

// Poppler's text boxes supplement visual review: no glyph may straddle the
// content boundary above the 16mm attribution footer. Requires pdftotext.
function checkPrintBoundary(path) {
  const xml = execFileSync('pdftotext', ['-bbox', path, '-'], {encoding:'utf8'});
  let pages = 0;
  for (const match of xml.matchAll(/<page\b[^>]*height="([\d.]+)"[^>]*>([\s\S]*?)<\/page>/g)) {
    pages++;
    const boundary = Number(match[1]) - 16 * 72 / 25.4;
    for (const word of match[2].matchAll(/<word\b[^>]*yMin="([\d.]+)"[^>]*yMax="([\d.]+)"[^>]*>([\s\S]*?)<\/word>/g)) {
      assert.ok(!(Number(word[1]) < boundary && Number(word[2]) > boundary), `${path} page ${pages}: ${word[3]} crosses bottom content boundary`);
    }
  }
  assert.ok(pages > 0, 'PDF contains parsed pages');
  console.log(`PASS print boundary ${path}: ${pages} pages`);
}

const browser = await chromium.launch();
try {
  for (const id of [12, 224, 2842]) for (const width of [1280, 390]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:3002/regions/${id}/report`, {waitUntil: 'networkidle'});
    const reading = await page.locator('.report .page-head > div:first-child').boundingBox();
    const actions = await page.locator('.report .actions').boundingBox();
    assert.ok(actions.y >= reading.y + reading.height, 'Toolbar is below text, not overlapping');
    assert.equal(await page.locator('.report .actions a[download]').count(), 2);
    const controls = await page.locator('.report .actions > *').all();
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = await controls[i].boundingBox(), b = await controls[j].boundingBox();
      assert.ok(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    const results = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    assert.deepEqual(results.violations.map(v => ({id:v.id, targets:v.nodes.map(n => n.target)})), []);
    if (width === 1280 && theme === 'light') {
      await page.screenshot({path:`/tmp/report-${id}-screen.png`});
      const rows = await page.locator('.report .doc tr').count();
      await page.emulateMedia({media: 'print'});
      assert.equal(await page.locator('.report .actions').isVisible(), false);
      assert.equal(await page.locator('.report .doc tr').count(), rows);
      assert.equal(await page.locator('.publisher-notice').first().isVisible(), true);
      await page.pdf({path:`/tmp/report-${id}-letter.pdf`,format:'Letter',printBackground:true});
      checkPrintBoundary(`/tmp/report-${id}-letter.pdf`);
      if (id === 12) {
        await page.pdf({path:'/tmp/report-12-a4.pdf',format:'A4',printBackground:true});
        checkPrintBoundary('/tmp/report-12-a4.pdf');
      }
    }
    console.log(`PASS report ${id} ${width}px ${theme}`);
    await context.close();
  }
} finally {await browser.close();}
