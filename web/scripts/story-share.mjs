// Each visual story's share images (Director Note "Social export", 2026-11-03): the story's
// title, its takeaway, the top of its first chart, a credit line and the site's address, as
// a 1200×630 link card (lib/meta.ts points og:image at share/<slug>.jpg) and a 1080×1350
// export the story page's Share button offers (share/<slug>-4x5.jpg). Composed from the story
// as captured, in light, since feeds mostly show on white.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const SITE = 'housing.jasonli.app';

// Publishers a story's notes may name, and the credit each takes on a card. OpenStreetMap's
// licence asks for its credit wherever its data appears, and Zillow's Terms of Use (4C) for
// "Data Provided by Zillow Group" wherever its figures are shown (ARCHITECTURE #272), which a
// card shared off the site is; the rest are named as sources.
const CREDITS = [
  [/OpenStreetMap/, '© OpenStreetMap contributors'],
  // Overture's places carry no required credit on derived counts; the site names it, with
  // each provider's notice on /sources (config/sources.yml, Milestone 60).
  [/Overture Maps/, 'Overture Maps Foundation'],
  [/Zillow/, 'Data Provided by Zillow Group'],
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

// The chart is captured from the story laid out at tablet width, where two-column stories
// stack and labels stay large next to the chart: a desktop-width chart shrunk into the
// card's box left its text unreadable. Only the story's first chart is taken: in a
// two-column story, its first column.
const CAPTURE = { width: 700, height: 1000, scale: 2 };
// Cards are plain white: the page's paper tint and header glow are left behind, so the
// chart sits on the same white as the card around it.
export const PLAIN = ':root{--plate-paper:#fff!important;--surface-1:#fff!important}html,body{background:#fff!important}body::before{display:none!important}';

// The two images made from each story. `chart` is the box the chart fills. A figure, such as
// a map, a little taller than its box (up to SHRINK times) is shrunk to fit whole; anything
// taller, and any list or table, is cut at the bottom and fades into the white, as is a
// figure marked `data-share-cut`, whose text shrunk to fit would be too small to read.
const SHRINK = 1.6;
export const FORMATS = {
  // A pasted link's preview: text beside the chart.
  card: { file: (slug) => `${slug}.jpg`, width: 1200, height: 630, chart: { width: 724, height: 486 }, type: { kicker: 13, title: 40, text: 18, foot: 15, footGap: 22, fade: 90 },
    layout: 'grid-template-columns: 1fr 724px; grid-template-rows: 1fr auto; gap: 0 36px; padding: 44px 44px 28px;', copy: 'gap: 16px;' },
  // The export (Director Note, 2026-11-03): text above the chart, 4:5 for phone feeds.
  portrait: { file: (slug) => `${slug}-4x5.jpg`, width: 1080, height: 1350, chart: { width: 984, height: 930 }, type: { kicker: 15, title: 64, text: 27, foot: 19, footGap: 0, fade: 120 },
    layout: 'grid-template-rows: auto 1fr auto; gap: 28px; padding: 56px 48px 36px;', copy: 'gap: 0;',
    // A wide, short chart leaves much of its box empty: its title and takeaway grow into
    // the room, and the chart sits centred in what is left.
    short: { ratio: .85, type: { title: 84, text: 34 }, css: '.chart { display: flex; align-items: center; } .chart img { height: auto; }' } },
};

/** Captures the top of the story's first chart, no taller than the tallest box it fills, or
 *  returns null when the story shows no chart until a reader picks something. */
async function captureChart(browser, url) {
  const context = await browser.newContext({ viewport: { width: CAPTURE.width, height: CAPTURE.height }, deviceScaleFactor: CAPTURE.scale, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-US' });
  try {
    const narrow = await context.newPage();
    await narrow.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
    await narrow.evaluate(() => document.fonts.ready);
    await narrow.addStyleTag({ content: `*,*::before,*::after{animation:none!important;transition:none!important} nextjs-portal{display:none!important} ${PLAIN} [data-share-plain]:not(#_){background:none!important;box-shadow:none!important;border-color:transparent!important;backdrop-filter:none!important} [data-share-plain]:not(#_)::before,[data-share-plain]:not(#_)::after{display:none!important}` });
    // A chart the story marks with `data-share-chart`, leaving its controls behind; otherwise
    // the first block of the story tall enough to be a chart, in page order.
    const found = await narrow.evaluate(() => {
      const shot = document.querySelector('[data-story-shot]');
      const target = shot && (shot.querySelector('[data-share-chart]') ?? [...shot.querySelectorAll(':scope figure.story-figure, :scope .story-two > *, :scope > ul, :scope > .stacked, :scope > table, :scope > div:not(.story-two)')]
        .find((el) => el.getBoundingClientRect().height > 120));
      if (!target) return null;
      target.setAttribute('data-share-target', '');
      // A marked chart's neighbours (its controls and notes) are hidden, so the capture's
      // margin shows none of their edges, and the panels around it lose their tint and
      // shadow, so it sits on the card's white.
      if (target.matches('[data-share-chart]')) for (let el = target; el !== shot; el = el.parentElement) {
        for (const sibling of el.parentElement.children) if (sibling !== el) sibling.style.visibility = 'hidden';
        el.parentElement.setAttribute('data-share-plain', '');
      }
      return { figure: target.matches('figure:not([data-share-cut])') };
    });
    if (!found) return null;
    const box = await narrow.locator('[data-share-target]').boundingBox();
    const pad = 12, clipWidth = box.width + pad * 2;
    const tallest = Math.max(...Object.values(FORMATS).map((f) => f.chart.height / f.chart.width));
    const height = Math.min(box.height + pad * 2, Math.round(clipWidth * tallest * (found.figure ? SHRINK : 1)));
    const image = await narrow.screenshot({ type: 'jpeg', quality: 88, fullPage: true, clip: { x: box.x - pad, y: box.y - pad, width: clipWidth, height } });
    // How tall the whole chart is for its width, to tell which boxes cut it.
    return { image, ratio: (box.height + pad * 2) / clipWidth, figure: found.figure };
  } finally {
    await context.close();
  }
}

/** Writes share/<slug>.jpg and share/<slug>-4x5.jpg: the story's link card and its export.
 *  Returns false, writing neither, for a story with no chart to show; its page then shows no
 *  share box, and its link preview falls back to the site's own image. */
export async function captureShareCard(browser, page, { slug, outDir }) {
  const story = await readStory(page);
  const chart = await captureChart(browser, page.url());
  if (!chart) return false;
  const credits = [...new Set(CREDITS.filter(([pattern]) => pattern.test(story.notes)).map(([, credit]) => credit))];
  // Zillow's notice is a sentence of its own, so it follows the list rather than joining it.
  const notice = credits.find((c) => c.startsWith('Data Provided'));
  const names = credits.filter((c) => c !== notice);
  const creditLine = [names.length && `Data: ${names.join(' · ')}`, notice].filter(Boolean).join('. ');
  // Without a takeaway, the intro's first sentence says what the chart is.
  const text = story.takeaway || escape(story.lede.split(/(?<=\.)\s/)[0] ?? '');
  await mkdir(resolve(outDir, 'share'), { recursive: true });
  for (const format of Object.values(FORMATS)) {
    const cut = chart.ratio > (chart.figure ? SHRINK : 1) * format.chart.height / format.chart.width;
    const short = format.short && chart.ratio < format.short.ratio * format.chart.height / format.chart.width;
    const t = short ? { ...format.type, ...format.short.type } : format.type;
    const html = `<!doctype html><meta charset="utf-8"><style>
      * { box-sizing: border-box; margin: 0; }
      body { width: ${format.width}px; height: ${format.height}px; background: #fff; color: #1d1b18; font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; display: grid; ${format.layout} }
      .copy { display: flex; flex-direction: column; ${format.copy} min-height: 0; }
      .kicker { font: 600 ${t.kicker}px/1.4 ui-monospace, Menlo, monospace; letter-spacing: .1em; text-transform: uppercase; color: #6f6a62; }
      h1 { font: 400 ${t.title}px/1.05 Georgia, "Times New Roman", serif; letter-spacing: -.03em; margin: ${t.title * .25}px 0 ${t.title * .3}px; }
      p { font: 400 ${t.text}px/1.45 Georgia, "Times New Roman", serif; color: #3a3631; border-left: ${t.text > 20 ? 4 : 3}px solid #b8522f; padding-left: ${t.text * .8}px; }
      p b { color: #1d1b18; font-weight: 700; }
      .chart { position: relative; min-height: 0; overflow: hidden; }
      .chart.cut::after { content: ""; position: absolute; inset: auto 0 0; height: ${t.fade}px; background: linear-gradient(rgba(255,255,255,0), #fff); }
      /* A cut chart keeps its full width and loses only its foot: covering the box would
         crop its sides whenever a long title leaves the box shorter than planned. */
      .chart img { display: block; width: 100%; ${cut ? 'height: auto;' : 'height: 100%; object-fit: contain; object-position: top center;'} }
      footer { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 24px; padding-top: ${t.foot}px; margin-top: ${t.footGap}px; border-top: 1px solid #e6e6e6; font-size: ${t.foot}px; color: #6f6a62; }
      /* The address never breaks; a long credit line wraps instead. */
      footer b { color: #1d1b18; font-weight: 600; white-space: nowrap; }
      ${short ? format.short.css : ''}
    </style>
    <div class="copy"><span class="kicker">Visual story · New Jersey</span><h1>${escape(story.title)}</h1>${text ? `<p>${text}</p>` : ''}</div>
    <div class="chart${cut ? ' cut' : ''}"><img src="data:image/jpeg;base64,${chart.image.toString('base64')}" alt=""></div>
    <footer><span>${creditLine ? escape(creditLine) : 'Sources on the page'}</span><b>${SITE}/stories/${slug}</b></footer>`;
    const card = await browser.newPage({ viewport: { width: format.width, height: format.height }, deviceScaleFactor: 1 });
    try {
      await card.setContent(html, { waitUntil: 'load' });
      await card.screenshot({ path: resolve(outDir, 'share', format.file(slug)), type: 'jpeg', quality: 86 });
    } finally {
      await card.close();
    }
  }
  return true;
}
