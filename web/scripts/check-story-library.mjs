/** Local responsive library checks. Does not require a warehouse or publisher access. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.SITE_URL ?? "http://localhost:3002";
const browser = await chromium.launch();
try {
  for (const width of [1440, 768, 390]) {
    for (const theme of ["dark", "light"]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      assert.equal((await page.goto(`${base}/stories`)).status(), 200);
      await page.evaluate((theme) => document.documentElement.dataset.theme = theme, theme);
      await page.getByRole("heading", { name: "Visual stories", exact: true }).waitFor();
      await page.locator(".library-feature img:visible").evaluate((img) => img.decode());
      const captureHrefs = await page.$$eval('.library-card[href^="/stories/"]', (links) => [...new Set(links.map((a) => a.getAttribute('href')))]);
      assert.equal(captureHrefs.length, 37, "screenshot discovery covers all stories once");
      assert.equal(await page.locator(".library-rail").count(), 6);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `page overflow ${width}/${theme}`);
      const jersey = page.getByRole("region", { name: "Only in New Jersey" });
      const track = jersey.locator(".library-track");
      await jersey.getByRole("button", { name: "Next stories in Only in New Jersey" }).click();
      await page.waitForFunction(() => document.querySelector("#jersey-track").scrollLeft > 0);
      await jersey.getByRole("link").first().focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(await jersey.getByRole("link").nth(1).evaluate((el) => el === document.activeElement), true);
      await page.keyboard.press("End");
      assert.equal(await jersey.getByRole("link").last().evaluate((el) => el === document.activeElement), true);
      assert(await track.evaluate((el) => el.scrollWidth > el.clientWidth));
      await page.getByRole("button", { name: "All stories 37", exact: true }).click();
      assert.equal(await page.locator(".library-grid > li").count(), 37);
      assert(await page.locator(".library-grid").boundingBox(), "homepage montage grid remains capturable");
      await page.getByRole("searchbox", { name: "Search stories" }).fill("Wawa");
      assert.equal(await page.locator(".library-grid > li").count(), 1);
      await page.getByRole("searchbox").fill("nothingmatches123");
      await page.getByRole("button", { name: "Show all stories" }).click();
      assert.equal(await page.locator(".library-grid > li").count(), 37);
      const directoryAudit = await new AxeBuilder({ page }).include("#main-content").analyze();
      assert.deepEqual(directoryAudit.violations.map((v) => `${v.id}: ${v.description}`), []);
      await page.getByRole("button", { name: "Discover", exact: true }).click();
      await jersey.getByRole("button", { name: /View all/ }).click();
      assert.equal(await page.getByRole("combobox", { name: "Collection" }).inputValue(), "jersey");
      assert.equal(await page.locator(".library-grid > li").count(), 9);
      const heading = await page.getByRole("heading", { name: "Only in New Jersey", exact: true }).boundingBox();
      assert(heading.y >= 0 && heading.y < 600, "View all must bring directory into view");
      await page.getByRole("button", { name: "Discover", exact: true }).click();
      await page.evaluate(() => scrollTo(0, 0));
      const curatedAudit = await new AxeBuilder({ page }).include("#main-content").analyze();
      assert.deepEqual(curatedAudit.violations.map((v) => `${v.id}: ${v.description}`), []);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `/private/tmp/stories-library-${width}-${theme}.png`, fullPage: true });
      console.log(`${width}px ${theme}: rails, keyboard, directory, search, overflow and axe passed`);
      await context.close();
    }
  }
} finally { await browser.close(); }
