// Local, read-only browser checks. Attribute reads are work counts, NOT frame timings.
// Use a visible production build with ?perf for the owner's standing performance gate.
import { chromium } from "playwright";
import assert from "node:assert/strict";

async function assertBadgeBelowTitle(page, scope) {
  const title = await page.locator(`${scope} .page-title`).boundingBox();
  const badge = await page.locator(`${scope} .title-computed`).boundingBox();
  assert.ok(
    title && badge && badge.y >= title.y + title.height - 1,
    "Computed-data badge should sit below the page title",
  );
}

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
    window.groundReads = 0;
    const get = Element.prototype.getAttribute;
    Element.prototype.getAttribute = function (name) {
      if (this.matches(".globe-detail path, .globe-ground path")) window.pathReads++;
      if (this.matches(".globe-ground path")) window.groundReads++;
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
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.groundReads = 0; });
    await page.getByRole("combobox", { name: "Quick view", exact: true }).selectOption("zori_all");
    await page.waitForTimeout(35);
    const raisedAfterMeasure = await page.locator(".globe-sharp .top").evaluate((node) => node.getBBox().y);
    const flatAfterMeasure = await page.locator(".globe-detail .on").evaluate((node) => node.getBBox().y);
    assert.ok(
      raisedAfterMeasure < flatAfterMeasure - 1,
      "Changing measure over the same county must not reset its lift to the surface",
    );
    assert.equal(
      await page.evaluate(() => window.groundReads),
      0,
      "Changing measure must not inspect or repaint the ground/world layer",
    );
    await page.getByRole("combobox", { name: "Quick view", exact: true }).selectOption("zhvi_sfr");
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
    await page.locator(".nj-head .title-computed .term").focus();
    const desktopComputedTip = await page.locator(".nj-head .title-computed .tip").boundingBox();
    assert.ok(
      desktopComputedTip && desktopComputedTip.x >= 0 && desktopComputedTip.x + desktopComputedTip.width <= 1440,
      "Computed-data definition must fit the desktop viewport",
    );
    await page.keyboard.press("Escape");
    await page.locator(".nj-head .title-computed .term").evaluate((node) => node.blur());
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
    const tickerPadding = await facts.locator("li").first().evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        top: Number.parseFloat(style.paddingTop),
        bottom: Number.parseFloat(style.paddingBottom),
      };
    });
    assert.ok(tickerPadding.top > tickerPadding.bottom, "Profile figures should sit lower within the same-height ticker");
    const fits = await facts.locator("li").first().evaluate((node) => {
      const frame = node.closest(".state-ticker").getBoundingClientRect();
      return [...node.children].every((child) => child.getBoundingClientRect().bottom <= frame.bottom);
    });
    assert.ok(fits, "Profile copy must not be clipped");
    assert.equal(await page.locator(".nj-head .title-computed").count(), 1, "State title carries the computed-data badge");
    await assertBadgeBelowTitle(page, ".nj-head .page-title-row");
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
    const jumpOut = page.getByRole("button", { name: /Jump out of .+ County/ });
    await jumpOut.waitFor();
    await jumpOut.click();
    await page.getByRole("heading", { name: "County comparison", exact: true }).waitFor();
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
    assert.equal(await modeSwitch.getAttribute("href"), "/afford", "State affordability control keeps a real fallback link");
    await modeSwitch.click();
    await page.locator(".nj-afford-mode").waitFor();
    assert.equal(await page.locator(".mode-panel").evaluate((node) => getComputedStyle(node).animationName), "none", "Reduced motion disables the mode transition");
    assert.equal(await page.locator(".nj-mode .explorer").count(), 1, "Both modes use one map-and-table footprint");
    await page.getByRole("heading", { name: "What does this mean for you?", exact: true }).waitFor();
    await page.getByText("Counties within reach", { exact: true }).waitFor();
    await page.getByText("Other counties", { exact: true }).waitFor();
    const secondaryRow = page.locator(".afford-secondary td").first();
    await secondaryRow.waitFor();
    assert.ok(
      await secondaryRow.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize) < 14),
      "Other counties should be slightly smaller than the primary affordability rows",
    );
    assert.notEqual(await page.locator(".nj-head").evaluate((node) => getComputedStyle(node).borderTopColor), lineBefore, "Affordability mode changes the state rule");
    await page.screenshot({ path: `/tmp/nj-${label}-afford.png`, fullPage: true });
    await modeSwitch.click();
    await page.getByRole("heading", { name: "County comparison", exact: true }).waitFor();
    await page.getByRole("radio", { name: "Dark theme", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.screenshot({ path: `/tmp/nj-${label}-dark.png`, fullPage: true });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`${origin}/?mode=afford`, { waitUntil: "domcontentloaded" });
    assert.equal(
      await page.locator("html").getAttribute("data-housing-mode"),
      "afford",
      "The pre-paint marker must recognize a directly loaded affordability URL",
    );
    await page.locator(".nj-afford-mode").waitFor();
    await page.goto(`${origin}/regions/12`, { waitUntil: "networkidle" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.locator(".page-title-row .title-computed").count(), 1, "County title carries the computed-data badge");
    await assertBadgeBelowTitle(page, ".page-title-row");
    await page.locator(".page-title-row .title-computed .term").focus();
    const countyComputedTip = await page.locator(".page-title-row .title-computed .tip").boundingBox();
    assert.ok(
      countyComputedTip && countyComputedTip.x >= 0 && countyComputedTip.x + countyComputedTip.width <= 1440,
      "County computed-data definition must fit the viewport",
    );
    await page.keyboard.press("Escape");
    await page.locator(".page-title-row .title-computed .term").evaluate((node) => node.blur());
    const countyHead = await page.locator(".page-head").boundingBox();
    const countyPopulation = await page.locator(".population-summary").boundingBox();
    assert.ok(
      countyHead && countyPopulation && Math.abs(countyPopulation.x + countyPopulation.width - (countyHead.x + countyHead.width)) <= 2,
      "County population card should align to the page header's right edge",
    );
    const reportAction = page.getByRole("link", { name: /Open full report/ });
    await reportAction.waitFor();
    assert.ok(await reportAction.locator("svg").isVisible(), "The full-report action should carry a document icon");
    assert.ok(
      await page.locator("body").evaluate((node) =>
        !node.textContent?.includes("Computed from the figures shown by fixed rules; not a quote, and not written by AI."),
      ),
      "Cost breakdowns should not repeat the removed computed-data disclaimer",
    );
    await page.getByText("Calculated estimate · not a lender quote", { exact: true }).waitFor();
    const sources = page.locator(".foot-sources");
    const notice = page.locator(".foot-notice");
    await sources.waitFor();
    await notice.waitFor();
    assert.ok(
      await sources.evaluate((node) => Number.parseFloat(getComputedStyle(node).borderRadius) >= 16),
      "Sources should use the refreshed disclosure card",
    );
    await sources.locator(":scope > summary").click();
    await sources.locator(".inst").first().waitFor();
    assert.ok(await sources.evaluate((node) => node.open), "Sources disclosure should still expand");
    await sources.locator(":scope > summary").click();
    assert.ok(!(await sources.evaluate((node) => node.open)), "Sources disclosure should still collapse");
    const countyTicker = page.locator(".region-profile-ticker");
    await countyTicker.waitFor();
    assert.ok(await countyTicker.getByRole("button", { name: "Pause housing here ticker" }).isVisible());
    const focusedMetric = countyTicker.locator(".state-ticker-group:not([aria-hidden='true']) .term").last();
    await focusedMetric.focus();
    await page.waitForTimeout(80);
    assert.equal(await countyTicker.getAttribute("data-stopped"), "true", "Keyboard focus exposes the static ticker strip");
    const focusedMetricBox = await focusedMetric.boundingBox();
    const tickerWindowBox = await countyTicker.locator(".state-ticker-window").boundingBox();
    assert.ok(
      focusedMetricBox && tickerWindowBox &&
        focusedMetricBox.x >= tickerWindowBox.x &&
        focusedMetricBox.x + focusedMetricBox.width <= tickerWindowBox.x + tickerWindowBox.width + 1,
      "The keyboard-focused metric must be scrolled into the visible ticker window",
    );
    await focusedMetric.evaluate((node) => node.blur());
    const countyRank = countyTicker.locator(".profile-rank").first();
    await countyRank.waitFor();
    assert.equal(await countyRank.locator("em").textContent(), "counties", "County profile ranks must name their denominator");
    const countySwitch = page.getByRole("switch", { name: "Affordability" });
    assert.equal(await countySwitch.getAttribute("href"), "/afford?place=12", "County fallback link preserves its selected place");
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
    await page.goto(`${origin}/regions/12?mode=afford`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("html").getAttribute("data-housing-mode"), "afford");
    await page.locator(".region-afford-mode").waitFor();
    await page.goto(`${origin}/regions/15`, { waitUntil: "networkidle" });
    const cardsFit = await page.locator(".region-standout-card").evaluateAll((cards) =>
      cards.every((card) => card.scrollWidth <= card.clientWidth + 1),
    );
    assert.ok(cardsFit, "Stand-out metrics must stay inside their cards");
    const more = page.locator("details.more");
    if (!(await more.evaluate((node) => node.open))) await more.locator(":scope > summary").click();
    await page.locator(".rank-plot").first().waitFor();
    assert.equal(await page.locator(".rank-plot").count(), 2, "The expander should add change and current-value rank plots");
    assert.ok(await page.locator(".rank-plot-dot").count() > 20, "Rank plots should visualize the table's ranked measures");
    await page.goto(`${origin}/regions/415`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".page-title-row .title-computed").count(), 1, "Municipality title carries the computed-data badge");
    await assertBadgeBelowTitle(page, ".page-title-row");
    const localTicker = page.locator(".region-profile-ticker");
    await localTicker.waitFor();
    assert.ok(await localTicker.getByRole("button", { name: "Pause housing here ticker" }).isVisible(), "Municipality profile should use the shared state-style ticker");
    const localRank = localTicker.locator(".profile-rank").first();
    await localRank.waitFor();
    assert.equal(await localRank.locator("em").textContent(), "municipalities", "Municipality profile ranks must name their denominator");
    assert.ok(
      await localTicker.locator(".state-ticker-group li").first().evaluate((node) => {
        const style = getComputedStyle(node);
        return Number.parseFloat(style.paddingTop) > Number.parseFloat(style.paddingBottom);
      }),
      "Local profile figures should use the same lower visual balance",
    );
    const municipalityMode = page.getByRole("switch", { name: "Affordability" });
    assert.equal(await municipalityMode.evaluate((node) => node.tagName), "A", "Municipality affordability control must be a link");
    assert.equal(await municipalityMode.getAttribute("href"), "/afford");
    await page.goto(`${origin}/regions/12/report`, { waitUntil: "networkidle" });
    const reportMode = page.getByRole("switch", { name: "Affordability" });
    assert.equal(await reportMode.evaluate((node) => node.tagName), "A", "Report affordability control must be a link");
    assert.equal(await reportMode.getAttribute("href"), "/afford");
    await page.getByText("Calculated estimate · not a lender quote", { exact: true }).waitFor();
    await page.goto(`${origin}/regions/2842`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".page-title-row .title-computed").count(), 1, "ZIP title carries the computed-data badge");
    await assertBadgeBelowTitle(page, ".page-title-row");
    const zipSwitch = page.getByRole("switch", { name: "Affordability" });
    await zipSwitch.waitFor();
    assert.equal(await zipSwitch.getAttribute("aria-disabled"), "true", "ZIP affordability switch should be visibly unavailable");
    const zipUrl = page.url();
    await zipSwitch.evaluate((node) => node.click());
    assert.equal(page.url(), zipUrl, "Unavailable ZIP affordability switch must not navigate");
    await page.goto(`${origin}/afford`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".globe-world-land").count(), 0, "Classic affordability map must not paint atlas-only world land");
    for (const route of ["/regions/12", "/regions/2842", "/afford"]) {
      await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
      await page.setViewportSize({ width: 375, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Regression overflow on ${route}`);
    }
    console.log("PASS: link-safe typed affordability controls, direct-mode pre-paint gating, continuous measure-change lift, isolated ground rendering, keyboard-visible profile facts, concise cost quote disclosure, instant ticker resume, stacked shared title badges, bounded computed-data definitions, edge-aligned county population, full-report action, streamlined cost copy, modern functional source footer, shared local profile tickers with named rank cohorts, balanced profile banners, contained stand-out cards, two added rank plots, compact one-row selectors, precise reticle, atlas-only world land, state and county affordability modes, compact other-county rows, county preselection, disabled ZIP mode, grouped local reach, transitions, color switch, municipality zoom and jump-out, county tap, drag commit, reset, dark mode, and responsive regression routes");
  }
  console.log(JSON.stringify({ errors }));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
