/** Local collection-gateway checks; no publisher access or warehouse writes. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.SITE_URL ?? "http://localhost:3002";
const browser = await chromium.launch();
try {
  for (const width of [1440, 768, 390, 320]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    assert.equal((await page.goto(base)).status(), 200);
    await page.evaluate((theme) => document.documentElement.dataset.theme = theme, theme);
    await page.evaluate(() => document.fonts.ready);
    const section = page.getByRole("region", { name: "Visual stories", exact: true });
    await section.scrollIntoViewIfNeeded();
    const link = section.getByRole("link");
    assert.equal(await section.locator("a").count(), 1);
    assert.equal(await link.getAttribute("href"), "/stories");
    assert.equal(await section.locator("h2").count(), 1);
    assert.equal(await section.getByText('Explore collection').count(), 0);
    assert(await section.locator('h2').evaluate((h, min) => parseFloat(getComputedStyle(h).fontSize) >= min, width <= 600 ? 40 : 38));
    assert.equal(await section.locator("ul, button, .library-card, .home-stories-all").count(), 0);
    assert.equal(await section.locator('img[src*="stories-index"]').count(), 0);
    const count = Number((await section.locator(".home-stories-count strong").innerText()).match(/^\d+/)?.[0]);
    assert(count > 0);
    assert((await section.locator(".home-stories-count").innerText()).includes("New Jersey"));
    assert.equal(await section.locator(".home-stories-gallery[aria-hidden=true]").count(), 1);
    assert.equal(await section.locator(".gallery-fragment").count(), 3);
    await section.locator("img").evaluateAll(async (images) => {
      await Promise.all(images.map(async (img) => { img.loading = "eager"; await img.decode(); }));
    });
    assert.equal(await section.locator("img:visible").count(), 3);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no document overflow");
    const geometry = await link.evaluate((link) => {
      const box = link.getBoundingClientRect();
      const copy = link.querySelector(".home-stories-copy").getBoundingClientRect();
      return { height: box.height, copyFits: copy.top >= box.top && copy.bottom <= box.bottom && copy.right <= box.right };
    });
    assert(geometry.height <= (width <= 600 ? 320 : 240), "compact gateway");
    assert(geometry.copyFits, "copy remains within card");
    if (width > 600) assert(await link.evaluate((e) => { const a = e.getBoundingClientRect(), b = e.querySelector('.home-stories-copy').getBoundingClientRect(); return Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 1; }), 'left-aligned copy vertically centred');
    assert(await section.evaluate((e) => { const metrics = document.querySelector('.national-strip'), coverage = document.querySelector('.coverage-entry'); return e.getBoundingClientRect().top - metrics.getBoundingClientRect().bottom <= 18 && metrics.getBoundingClientRect().top - coverage.getBoundingClientRect().bottom <= 17; }), 'tighter section gaps');
    assert(await page.evaluate(() => {
      const gateway = document.querySelector(".home-stories"), backdrop = document.querySelector(".national-strip"), tools = document.querySelector(".home-tools");
      return Boolean(backdrop.compareDocumentPosition(gateway) & Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(gateway.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING);
    }));
    assert.equal(await page.locator(".home-tools-rail").count(), 1);
    await page.keyboard.press("Tab");
    await link.focus();
    assert(await link.evaluate((el) => el.matches(":focus-visible")));
    await link.evaluate((el) => el.blur());
    await page.mouse.move(0, 0);
    const axe = await new AxeBuilder({ page }).include(".home-stories").analyze();
    assert.deepEqual(axe.violations.map((v) => v.id), []);
    await section.screenshot({ path: `/tmp/home-stories-${width}-${theme}.png` });
    // Artwork is decorative, but clicking anywhere on it opens the collection too.
    const bounds = await link.boundingBox();
    await link.click({ position: { x: bounds.width - 40, y: width <= 600 ? bounds.height - 40 : bounds.height / 2 } });
    await page.waitForURL("**/stories");
    await page.getByRole("button", { name: `All stories ${count}`, exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`${width}px/${theme}: one gateway, real fragments, scope/count, focus, compact layout, artwork click-through and axe passed`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(base);
  const link = page.locator(".home-stories-gateway");
  await link.scrollIntoViewIfNeeded();
  const state = () => link.locator(".gallery-fragment").evaluateAll((fragments) => fragments.map((el) => ({ translate: getComputedStyle(el).translate, transition: getComputedStyle(el).transitionDuration, animation: getComputedStyle(el).animationName })));
  await page.mouse.move(0, 0);
  const rest = await state();
  assert(rest.every((s) => s.animation === "none"), "no autoplay animation");
  await link.hover();
  await page.waitForTimeout(360);
  const hover = await state();
  assert.notDeepEqual(hover.map((s) => s.translate), rest.map((s) => s.translate));
  await page.mouse.move(0, 0);
  await page.keyboard.press("Tab");
  await link.focus();
  await page.waitForTimeout(360);
  assert.deepEqual((await state()).map((s) => s.translate), hover.map((s) => s.translate), "focus/hover parity");
  await link.evaluate((el) => el.blur());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await link.hover();
  assert((await state()).every((s) => s.translate === "none" && s.transition === "0s"));
  await context.close();
  console.log("Gateway hover/focus motion, no autoplay and reduced-motion checks passed");
} finally { await browser.close(); }
