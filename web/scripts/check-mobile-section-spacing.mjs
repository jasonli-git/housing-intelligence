import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.SPACING_ORIGIN ?? "http://127.0.0.1:3002";
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 600, 1280]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      await context.addInitScript(t => localStorage.setItem("housing-theme", t), theme);
      const page = await context.newPage();
      await page.goto(origin);
      await page.locator("main h1").waitFor();
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      await page.evaluate(() => document.fonts.ready);
      const box = await page.evaluate(() => {
        const rect = s => document.querySelector(s).getBoundingClientRect().toJSON();
        return { search: rect(".coverage-search-panel input"), mode: rect(".coverage-mode-switch"), stage: rect(".coverage-search-stage"), header: getComputedStyle(document.querySelector(".nation-head")).paddingTop };
      });
      assert.ok(box.search.top > box.mode.bottom, "Search overlaps the mode buttons");
      if (width === 390 && theme === "dark") await page.screenshot({ path: "/tmp/mobile-spacing-home-after.png" });
      if (width <= 600) {
        assert.ok(await page.locator(".bar-inner").evaluate(e => e.getBoundingClientRect().height < 65), "Home menu reserves a second row");
        await page.locator(".bar-tool-menu > summary").click();
        assert.ok(await page.locator(".bar-tool-menu .bar-controls").isVisible());
        await page.locator(".bar-tool-menu > summary").click();
        assert.ok(box.stage.height <= 300, "Search mode still reserves hidden map controls");
        assert.ok(box.search.top - box.mode.bottom < 100, "Search remains too far below the mode controls");
        assert.equal(parseFloat(box.header), 12.8);
      } else {
        assert.equal(parseFloat(box.header), 36.8, "Desktop header spacing changed");
      }
      await page.getByRole("button", { name: "Explore map", exact: true }).click();
      await page.locator(".coverage-map-stage").scrollIntoViewIfNeeded();
      await page.locator(".coverage-map").waitFor();
      assert.ok(await page.locator(".coverage-region-bar").isVisible());
      assert.ok(await page.locator(".coverage-map-foot").isVisible());
      assert.ok(await page.locator(".coverage-map").evaluate(e => e.getBoundingClientRect().height >= 300));
      await page.getByRole("button", { name: "Search places", exact: true }).click();
      assert.ok(await page.locator(".coverage-search-panel input").isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      for (const path of ["/nj/somerset-county", "/nj/princeton", "/nj/zip-07030"]) {
        await page.goto(`${origin}${path}`);
        const market = page.locator('details[data-treatment="market"]');
        if (!(await market.count())) continue; // ZIPs may have no construction/sales.
        await market.locator(":scope > summary").click();
        const padding = await market.locator(":scope > .quiet-disclosure-body").evaluate(e => {
          const c = getComputedStyle(e); return [parseFloat(c.paddingLeft), parseFloat(c.paddingRight)];
        });
        assert.deepEqual(padding, width <= 600 ? [16, 16] : [0, 0]);
        if (width === 390 && theme === "dark" && path.includes("somerset")) {
          await market.scrollIntoViewIfNeeded();
          await market.locator(":scope > summary").evaluate(e => e.scrollIntoView({ block: "start" }));
          await page.screenshot({ path: "/tmp/mobile-spacing-market-after.png" });
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      console.log(`${width}px ${theme}: search spacing, map mode, market inset and overflow passed`);
      await context.close();
    }
  }
} finally { await browser.close(); }
