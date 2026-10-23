/** Record/check protected chrome styles while redesigning only the stories main. */
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const file = "/private/tmp/stories-protected-chrome.json";
const browser = await chromium.launch();
const snapshots = {};
try {
  for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("http://localhost:3002/stories");
    await page.evaluate((theme) => document.documentElement.dataset.theme = theme, theme);
    await page.evaluate(() => document.fonts.ready);
    snapshots[`${width}-${theme}`] = await page.evaluate(() => {
      const styles = (e) => {
        const c = getComputedStyle(e), r = e.getBoundingClientRect();
        return { tag: e.tagName, cls: e.className, x: r.x, width: r.width, height: r.height,
          color: c.color, background: c.backgroundColor, backgroundImage: c.backgroundImage,
          font: c.font, padding: c.padding, margin: c.margin, border: c.border, display: c.display };
      };
      return { background: getComputedStyle(document.body).backgroundColor,
        chrome: [...document.querySelectorAll(".bar, .site-meta-row, .foot, .bar *, .site-meta-row *, .foot *")].map(styles) };
    });
    await context.close();
  }
} finally { await browser.close(); }
// Moving the footer vertically can change SVG bounding-box float rounding by
// <0.001px. Compare geometry to 0.01px, retaining exact computed CSS strings.
const normalize = (value) => JSON.parse(JSON.stringify(value, (_, v) => typeof v === "number" ? Math.round(v * 100) / 100 : v));
if (process.argv.includes("--record")) {
  await writeFile(file, JSON.stringify(normalize(snapshots), null, 2));
  console.log("Recorded protected chrome/background baseline");
} else {
  assert.deepEqual(normalize(snapshots), normalize(JSON.parse(await readFile(file, "utf8"))));
  console.log("Protected navigation, status row, footer and background styles unchanged in both themes at desktop/mobile");
}
