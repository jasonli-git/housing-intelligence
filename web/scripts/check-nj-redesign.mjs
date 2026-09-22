// Local, read-only browser checks. Attribute reads are work counts, NOT frame timings.
// Use a visible production build with ?perf for the owner's standing performance gate.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true });
const origin = process.env.CHECK_URL ?? "http://localhost:3000";
const label = process.env.CHECK_LABEL ?? "after";
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, colorScheme: "light" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator(".globe-detail path[d]:not([d=''])").first().waitFor();
  await page.waitForTimeout(4500);
  await page.evaluate(() => {
    window.pathReads = 0;
    const get = Element.prototype.getAttribute;
    Element.prototype.getAttribute = function (name) {
      if (this.matches(".globe-detail path, .globe-ground path")) window.pathReads++;
      return get.call(this, name);
    };
  });
  await page.locator(".ranks tbody tr").first().hover();
  await page.waitForTimeout(900);
  console.log(JSON.stringify({ label, pathAttributeReadsDuringRise: await page.evaluate(() => window.pathReads) }));
  if (label !== "before") assert.ok(await page.evaluate(() => window.pathReads < 500), "Probe-only frames must not repaint the entire scene");
  if (label !== "before") {
    await page.locator(".ranks tbody tr").nth(1).hover();
    const rising = page.locator(".globe-sharp .top");
    await rising.waitFor({ state: "attached" });
    await page.waitForTimeout(25);
    const earlyY = await rising.evaluate((node) => node.getBBox().y);
    await page.waitForTimeout(160);
    const laterY = await rising.evaluate((node) => node.getBBox().y);
    assert.ok(laterY < earlyY, "A newly hovered region should make one progressive rise from the map");
  }
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `/tmp/nj-${label}-desktop.png`, fullPage: true });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(300);
    const size = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
    console.log(JSON.stringify(size));
    assert.ok(size.documentWidth <= width, `Horizontal overflow at ${width}px`);
    if (width === 375) await page.screenshot({ path: `/tmp/nj-${label}-mobile.png`, fullPage: true });
  }
  if (label !== "before") {
    const ticker = page.locator(".state-ticker");
    const track = ticker.locator(".state-ticker-track");
    assert.ok((await ticker.boundingBox()).height <= 100, "State profile should stay compact");
    assert.ok(await page.locator(".globe-world-land[d]:not([d=''])").count() > 0, "World land should be drawn behind the US");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(0, 0);
    const startTransform = await track.evaluate((node) => getComputedStyle(node).transform);
    await page.waitForTimeout(500);
    assert.notEqual(await track.evaluate((node) => getComputedStyle(node).transform), startTransform, "Ticker should travel continuously");
    await ticker.hover();
    await page.waitForTimeout(100);
    const pausedTransform = await track.evaluate((node) => getComputedStyle(node).transform);
    await page.waitForTimeout(300);
    assert.equal(await track.evaluate((node) => getComputedStyle(node).transform), pausedTransform, "Hover pauses ticker");
    await ticker.getByRole("button", { name: "Pause statewide ticker" }).click();
    assert.equal(await track.evaluate((node) => getComputedStyle(node).animationName), "none");
    const play = ticker.getByRole("button", { name: "Play statewide ticker" });
    await play.waitFor();
    assert.ok(await play.locator("svg").isVisible(), "Play icon must remain visible after pausing");
    await play.click();
    await page.waitForTimeout(40);
    const resumedTransform = await track.evaluate((node) => getComputedStyle(node).transform);
    await page.waitForTimeout(220);
    assert.notEqual(await track.evaluate((node) => getComputedStyle(node).transform), resumedTransform, "Play should resume immediately while the pointer and focus remain on the ticker");
    await page.setViewportSize({ width: 375, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const band = ticker;
    const facts = band.locator(".state-ticker-group").first();
    assert.equal(await page.locator(".population-summary").count(), 1);
    await facts.getByText("House price index", { exact: true }).focus();
    const tip = page.locator(".floating-tip");
    await tip.waitFor();
    const box = await tip.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 375 && box.y >= 0 && box.y + box.height <= 900, "Definition must fit the viewport");
    await page.keyboard.press("Escape");
    await facts.getByText("House price index, all transactions", { exact: true }).waitFor();
    await facts.getByText("Typical sale price, recent transactions", { exact: true }).waitFor();
    const fits = await facts.locator("li").first().evaluate((node) => {
      const frame = node.closest(".state-ticker").getBoundingClientRect();
      return [...node.children].every((child) => child.getBoundingClientRect().bottom <= frame.bottom);
    });
    assert.ok(fits, "Profile copy must not be clipped");
    assert.equal(await page.locator(".nj-head .title-computed").count(), 1, "State title carries the computed-data badge");
    await page.locator(".nj-head .title-computed .term").focus();
    const computedTip = page.locator(".nj-head .title-computed .tip");
    const computedBox = await computedTip.boundingBox();
    assert.ok(computedBox && computedBox.x >= 0 && computedBox.x + computedBox.width <= 375, "Computed-data definition must fit the mobile viewport");
    await page.keyboard.press("Escape");
    await page.getByRole("combobox", { name: "Quick view", exact: true }).selectOption("zori_all");
    await page.getByRole("heading", { name: "Observed rent index, all homes", exact: true }).waitFor();
    const controlsBox = await page.locator(".explorer-controls").boundingBox();
    const onMapBox = await page.locator(".measure-eyebrow").boundingBox();
    const explorerBox = await page.locator(".explorer").boundingBox();
    assert.ok(controlsBox && onMapBox && explorerBox && controlsBox.y > onMapBox.y && controlsBox.y + controlsBox.height <= explorerBox.y, "The one-row controls should sit between the measure introduction and map card");
    await page.getByRole("button", { name: "Show the crosshair", exact: true }).click();
    assert.equal(await page.locator(".globe-crosshair circle").getAttribute("r"), "5.5", "Map reticle should use the smaller precise target");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.getByRole("heading", { name: "Municipalities", exact: true }).waitFor();
    const map = await page.locator(".globe-still").boundingBox();
    assert.ok(map);
    await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
    await page.mouse.down();
    await page.mouse.move(map.x + map.width / 2 + 45, map.y + map.height / 2 + 25, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    assert.equal(await page.locator(".globe-slide").evaluate((node) => node.style.transform), "", "Released drag must be committed");
    await page.getByRole("button", { name: "New Jersey", exact: true }).click();
    await page.getByRole("heading", { name: "County comparison", exact: true }).waitFor();
    // Click the visible raised county through the map's gesture overlay.
    const top = await page.locator(".globe-sharp .top").evaluate((node) => {
      const box = node.getBBox();
      const matrix = node.getScreenCTM();
      for (let x = box.x; x < box.x + box.width; x += 2) {
        for (let y = box.y; y < box.y + box.height; y += 2) {
          const p = new DOMPoint(x, y);
          if (node.isPointInFill(p)) { const screen = p.matrixTransform(matrix); return { x: screen.x, y: screen.y }; }
        }
      }
      return null;
    });
    assert.ok(top);
    await page.mouse.click(top.x, top.y);
    await page.getByRole("heading", { name: "Municipalities", exact: true }).waitFor();
    await page.getByRole("button", { name: "New Jersey", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    const lineBefore = await page.locator(".nj-head").evaluate((node) => getComputedStyle(node).borderTopColor);
    const modeSwitch = page.getByRole("switch", { name: "Affordability" });
    await modeSwitch.click();
    await page.locator(".nj-afford-mode").waitFor();
    assert.equal(await page.locator(".mode-panel").evaluate((node) => getComputedStyle(node).animationName), "none", "Reduced motion disables the mode transition");
    assert.equal(await page.locator(".nj-mode .explorer").count(), 1, "Both modes use one map-and-table footprint");
    await page.getByRole("heading", { name: "What does this mean for you?", exact: true }).waitFor();
    await page.getByText("Counties within reach", { exact: true }).waitFor();
    await page.getByText("Other counties", { exact: true }).waitFor();
    assert.notEqual(await page.locator(".nj-head").evaluate((node) => getComputedStyle(node).borderTopColor), lineBefore, "Affordability mode changes the state rule");
    await page.screenshot({ path: `/tmp/nj-${label}-afford.png`, fullPage: true });
    await modeSwitch.click();
    await page.getByRole("heading", { name: "County comparison", exact: true }).waitFor();
    await page.getByRole("radio", { name: "Dark theme", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.screenshot({ path: `/tmp/nj-${label}-dark.png`, fullPage: true });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`${origin}/regions/12`, { waitUntil: "networkidle" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.locator(".page-title-row .title-computed").count(), 1, "County title carries the computed-data badge");
    const countyTicker = page.locator(".region-profile-ticker");
    await countyTicker.waitFor();
    assert.ok(await countyTicker.getByRole("button", { name: "Pause housing here ticker" }).isVisible());
    const countySwitch = page.getByRole("switch", { name: "Affordability" });
    await countySwitch.click();
    await page.locator(".region-afford-mode").waitFor();
    assert.notEqual(await page.locator(".region-afford-mode .mode-panel").evaluate((node) => getComputedStyle(node).animationName), "none", "County mode should transition");
    await page.locator(".county-afford-intro h2").waitFor();
    await page.locator(".check-place").getByRole("link", { name: "Somerset County", exact: true }).waitFor();
    await page.getByText("Other municipalities", { exact: true }).waitFor();
    await page.getByRole("columnheader", { name: "Municipality", exact: true }).waitFor();
    assert.equal(await page.locator(".region-standard-content").evaluate((node) => getComputedStyle(node).display), "none");
    await countySwitch.click();
    await page.locator(".region-standard-content .cost").waitFor();
    await page.goto(`${origin}/regions/415`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".page-title-row .title-computed").count(), 1, "Municipality title carries the computed-data badge");
    await page.goto(`${origin}/regions/2842`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".page-title-row .title-computed").count(), 1, "ZIP title carries the computed-data badge");
    const zipSwitch = page.getByRole("switch", { name: "Affordability" });
    await zipSwitch.waitFor();
    assert.equal(await zipSwitch.getAttribute("aria-disabled"), "true", "ZIP affordability switch should be visibly unavailable");
    const zipUrl = page.url();
    await zipSwitch.evaluate((node) => node.click());
    assert.equal(page.url(), zipUrl, "Unavailable ZIP affordability switch must not navigate");
    for (const route of ["/regions/12", "/regions/2842", "/afford"]) {
      await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
      await page.setViewportSize({ width: 375, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Regression overflow on ${route}`);
    }
    console.log("PASS: instant ticker resume, shared title badges, compact one-row selectors, precise reticle, world land, state and county affordability modes, county preselection, disabled ZIP mode, grouped local reach, transitions, color switch, tooltip bounds, municipality zoom, county tap, drag commit, reset, dark mode, and responsive regression routes");
  }
  console.log(JSON.stringify({ errors }));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
