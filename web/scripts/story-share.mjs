// Each visual story's link preview (Director Note "Social export", 2026-11-03): a 1200×630
// card of the story's title, its takeaway, the top of its chart, a credit line and the
// site's address, so a pasted link shows the story rather than the site's generic card.
// Composed from the story page as captured, in light, since feeds mostly show on white.
// lib/meta.ts points each story's og:image at screenshots/share/<slug>.jpg.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export const SHARE = { width: 1200, height: 630 };
const SITE = 'housing.jasonli.app';

// Publishers a story's notes may name, and the credit each takes on a card. OpenStreetMap's
// licence asks for its credit wherever its data appears; the rest are named as sources.
const CREDITS = [
  [/OpenStreetMap/, '© OpenStreetMap contributors'],
  [/Zillow/, 'Zillow'],
  [/Census Bureau|American Community Survey|TIGER/, 'US Census Bureau'],
  [/Wikidata/, 'Wikidata'],
  [/FEMA/, 'FEMA'],
  [/NJDEP|Department of Environmental Protection/, 'NJDEP'],
  [/\bFCC\b/, 'FCC'],
  [/\bCDC\b/, 'CDC'],
  [/\bHUD\b/, 'HUD'],
  [/HMDA|CFPB/, 'CFPB (HMDA)'],
  [/Federal Reserve|FRED/, 'Federal Reserve'],
  [/\bEPA\b/, 'EPA'],
  [/Division of Taxation|Director’s Ratio|Director's Ratio/, 'NJ Division of Taxation'],
];

const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Reads what the card needs from a story page already loaded in `page`. */
export async function readStory(page) {
  return page.evaluate(() => {
    const takeaway = document.querySelector('.story-takeaway');
    return {
      title: document.querySelector('h1.page-title')?.textContent?.trim() ?? '',
      // The takeaway without its "The takeaway" label or React's comment markers; its lead
      // clause stays bold.
      takeaway: takeaway ? [...takeaway.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE || (n instanceof HTMLElement && n.tagName !== 'SPAN')).map((n) => n instanceof HTMLElement && n.tagName === 'B' ? `<b>${n.textContent}</b>` : n.textContent?.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])).join('') : '',
      lede: document.querySelector('.story-lede')?.textContent?.trim() ?? '',
      notes: document.querySelector('#story-sources')?.textContent ?? '',
    };
  });
}

/** Writes share/<slug>.jpg: the story's card, its chart cropped from the page's top. */
export async function captureShareCard(browser, page, { slug, outDir }) {
  const story = await readStory(page);
  const box = await page.locator('[data-story-shot]').boundingBox();
  if (!box) throw new Error(`${slug}: no [data-story-shot]`);
  const pad = 16;
  // The chart's top, as wide as it is and no taller than the card's chart area allows.
  const height = Math.min(box.height + pad * 2, Math.round((box.width + pad * 2) * 0.82));
  const chart = await page.screenshot({ type: 'jpeg', quality: 88, fullPage: true, clip: { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height } });
  const credits = [...new Set(CREDITS.filter(([pattern]) => pattern.test(story.notes)).map(([, credit]) => credit))];
  // Without a takeaway, the intro's first sentence says what the chart is.
  const text = story.takeaway || escape(story.lede.split(/(?<=\.)\s/)[0] ?? '');
  const html = `<!doctype html><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: ${SHARE.width}px; height: ${SHARE.height}px; background: #f7f4ee; color: #1d1b18; font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; display: grid; grid-template-columns: 430px 1fr; grid-template-rows: 1fr auto; gap: 0 40px; padding: 48px 48px 30px; }
    .copy { display: flex; flex-direction: column; gap: 18px; min-height: 0; }
    .kicker { font: 600 13px/1.4 ui-monospace, Menlo, monospace; letter-spacing: .1em; text-transform: uppercase; color: #6f6a62; }
    h1 { font: 400 50px/1.04 Georgia, "Times New Roman", serif; letter-spacing: -.03em; }
    p { font: 400 21px/1.42 Georgia, "Times New Roman", serif; color: #3a3631; border-left: 3px solid #b8522f; padding-left: 16px; }
    p b { color: #1d1b18; font-weight: 700; }
    .chart { min-height: 0; border-radius: 14px; overflow: hidden; border: 1px solid #e2ddd3; background: #fff; }
    .chart img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top center; }
    footer { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 24px; padding-top: 18px; margin-top: 22px; border-top: 1px solid #e2ddd3; font-size: 15px; color: #6f6a62; }
    footer b { color: #1d1b18; font-weight: 600; }
  </style>
  <div class="copy"><span class="kicker">Visual story · New Jersey</span><h1>${escape(story.title)}</h1>${text ? `<p>${text}</p>` : ''}</div>
  <div class="chart"><img src="data:image/jpeg;base64,${chart.toString('base64')}" alt=""></div>
  <footer><span>${credits.length ? `Data: ${escape(credits.join(' · '))}` : 'Sources on the page'}</span><b>${SITE}/stories/${slug}</b></footer>`;
  const card = await browser.newPage({ viewport: SHARE, deviceScaleFactor: 1 });
  try {
    await card.setContent(html, { waitUntil: 'load' });
    await mkdir(resolve(outDir, 'share'), { recursive: true });
    await card.screenshot({ path: resolve(outDir, 'share', `${slug}.jpg`), type: 'jpeg', quality: 85 });
  } finally {
    await card.close();
  }
}
