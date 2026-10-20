// Every glossary word shown on a page carries its definition the first time it appears
// (ARCHITECTURE #389). Reads the phrases from `lib/terms.ts` and the rendered pages from a
// running site: `TERMS_ORIGIN=http://localhost:3000 node scripts/check-terms.mjs`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.TERMS_ORIGIN ?? 'http://localhost:3002';
const pages = (process.env.TERMS_PAGES ?? '/,/states/new-jersey,/nj/mercer-county,/nj/princeton,/nj/zip-08540,/nj/mercer-county/report,/afford,/guide,/tax,/help,/atlas,/freshness,/changes,/sources').split(',');

// The glossary words and their phrases, read from the dictionary's source.
const source = readFileSync(new URL('../lib/terms.ts', import.meta.url), 'utf8');
const glossary = [...source.matchAll(/^  "([\w-]+)": \{\n(?:(?!^  \}).*\n)*?    phrases: \[([^\]]*)\]/gm)]
  .map(([, key, list]) => ({ key, phrases: [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]) }))
  .filter((term) => term.phrases.length);
assert(glossary.length >= 5, 'glossary words read from lib/terms.ts');

const browser = await chromium.launch();
const misses = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  for (const path of pages) {
    await page.goto(origin + path, { waitUntil: 'networkidle' });
    const found = await page.evaluate((glossary) => {
      const main = document.querySelector('main');
      if (!main) return [];
      const out = [];
      for (const { key, phrases } of glossary) {
        for (const phrase of phrases) {
          const pattern = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
          const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
          let first = null;
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const el = node.parentElement;
            // A link cannot hold a focusable term, and a publisher's own words or a source's
            // name is quoted, not explained: both are skipped, and the next use must carry it.
            if (!el || el.closest('.tip, .floating-tip, script, style, [hidden], [aria-hidden="true"], a, [data-terms="off"]')) continue;
            if (!el.getClientRects().length && !el.closest('details')) continue;
            if (pattern.test(node.textContent)) { first = el; break; }
          }
          if (first && !first.closest('.gl .term')) out.push(`${key} ("${phrase}"): "${first.textContent.trim().slice(0, 70)}"`);
        }
      }
      return out;
    }, glossary);
    for (const miss of found) misses.push(`${path}: ${miss}`);
  }
} finally {
  await browser.close();
}
if (misses.length) {
  console.error(`${misses.length} glossary word(s) shown without their definition at first use:\n` + misses.join('\n'));
  process.exit(1);
}
console.log(`check-terms: every glossary word marked at first use on ${pages.length} pages`);
