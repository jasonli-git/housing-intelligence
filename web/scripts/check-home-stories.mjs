/** Local homepage sampler checks; no publisher access or warehouse writes. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.SITE_URL ?? "http://localhost:3002";
const browser = await chromium.launch();
try {
  for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      assert.equal((await page.goto(base)).status(), 200);
      await page.evaluate((theme) => document.documentElement.dataset.theme = theme, theme);
      const section = page.locator(".home-stories");
      await section.scrollIntoViewIfNeeded();
      const cards = section.locator(".library-card");
      assert.deepEqual(await cards.evaluateAll((links) => links.map((a) => a.getAttribute("href"))), [
        "/stories/the-wawa-line", "/stories/twin-towns", "/stories/the-flood-claims-calendar",
      ]);
      assert.equal(await section.locator("button").count(), 0);
      assert.equal(await section.locator('img[src*="stories-index"]').count(), 0);
      assert.equal((await section.locator(".home-stories-all").innerText()).replace(/\s+/g, " "), "Browse all 37 →");
      assert(await page.evaluate(() => {
        const section = document.querySelector(".home-stories"), backdrop = document.querySelector(".national-backdrop"), tools = document.querySelector(".home-tools");
        return Boolean(backdrop.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(section.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING);
      }));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no document overflow");
      const geometry = await section.locator(".home-story-track").evaluate((track) => ({
        scrolls: track.scrollWidth > track.clientWidth + 1,
        rows: new Set(Array.from(track.children).map((li) => Math.round(li.getBoundingClientRect().top))).size,
      }));
      assert.equal(geometry.rows, 1);
      assert.equal(geometry.scrolls, width <= 600);
      if (width <= 600) {
        await cards.first().focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        assert(await cards.last().evaluate((link) => document.activeElement === link));
        assert(await section.locator(".home-story-track").evaluate((track) => track.scrollLeft > 0), "keyboard reveals last card");
        await section.locator(".home-story-track").evaluate((track) => { track.scrollLeft = 0; });
      }
      await section.locator("img").evaluateAll(async (images) => {
        images.forEach((img) => { img.loading = "eager"; });
        await Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })));
      });
      assert(await section.locator("img").evaluateAll((images) => images.every((img) => img.naturalWidth > 0)), "real chart captures load");
      const axe = await new AxeBuilder({ page }).include(".home-stories").analyze();
      assert.deepEqual(axe.violations.map((v) => v.id), []);
      await section.screenshot({ path: `/tmp/home-stories-${width}-${theme}.png` });
      await cards.first().click();
      await page.waitForURL("**/stories/the-wawa-line");
      assert.equal(errors.length, 0, errors.join("\n"));
      console.log(`${width}px/${theme}: layout, focus, images, direct navigation and sampler axe passed`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
