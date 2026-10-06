// Local-only responsive and interaction checks; no publisher requests or writes.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const origin = process.env.PLACE_ORIGIN ?? "http://localhost:3000";
const browser = await chromium.launch();
const errors = [];
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ colorScheme: theme, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/", "/states/new-jersey", "/afford?income=100000", "/regions/12", "/regions/194", "/regions/2842", "/tax", "/freshness", "/changes"]) {
        const response = await page.goto(origin + route, { waitUntil: "networkidle" });
        assert(response.ok(), route);
        await page.locator("main h1").waitFor();
        await page.locator("main details").evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + " reflow " + width);
        if (route === "/states/new-jersey") {
          assert.equal(await page.locator(".globe-stage").count(), 0);
          assert.equal(await page.locator(".place-county-grid a").count(), 21);
          assert.equal(await page.locator("#county-comparison tbody tr").count(), 21);
          await page.locator(".place-discovery input").fill("Princeton");
          await page.locator(".place-discovery").getByRole("option").first().waitFor();
          await page.locator(".place-discovery input").fill("");
        }
        if (route.startsWith("/afford")) {
          assert.equal(await page.locator(".globe-stage").count(), 0);
          assert.equal(await page.getByRole("button", { name: "Map", exact: true }).count(), 0);
          assert(await page.locator(".budget-comparison tbody tr").count() > 0);
        }
        if (route === "/regions/2842") assert.equal(await page.locator(".quiet-profile").count(), 1);
        if (width === 390) {
          const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          assert.deepEqual(results.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], route + " " + theme);
        }
        console.log("PASS", route, width, theme);
      }
    }
    await page.goto(origin + "/states/new-jersey", { waitUntil: "networkidle" });
    assert.equal(await page.locator(".state-place-artwork").count(), 2);
    assert(await page.locator(".state-place-artwork").evaluateAll(nodes => nodes.every(node => node.getAttribute("aria-hidden") === "true" && getComputedStyle(node).pointerEvents === "none")));
    assert(await page.locator(".state-artwork-trace path").evaluateAll(nodes => nodes.every(node => getComputedStyle(node).animationName === "none")), "Reduced motion keeps artwork static");
    await page.emulateMedia({ media: "print" });
    assert(await page.locator(".state-place-artwork").evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display === "none")));
    await page.emulateMedia({ media: "screen" });
    await page.locator(".section-jump").selectOption("#county-comparison");
    assert(await page.locator("#county-comparison").evaluate(node => node.open));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(origin + "/states/new-jersey", { waitUntil: "networkidle" });
    await page.screenshot({ path: "/tmp/place-first-nj-" + theme + ".png", fullPage: false });
    await page.goto(origin + "/regions/2842", { waitUntil: "networkidle" });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({ path: "/tmp/place-first-zip-" + theme + ".png", fullPage: false });
    await context.close();
  }
  assert.deepEqual(errors, [], "No browser runtime errors");
} finally { await browser.close(); }
