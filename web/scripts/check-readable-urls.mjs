import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { chromium } from "playwright";

const origin = process.env.ROUTE_CHECK_ORIGIN ?? "http://127.0.0.1:3006";
const root = new URL("../out/", import.meta.url);
const registry = JSON.parse(await readFile(new URL("../lib/placeRoutes.json", import.meta.url), "utf8"));
const rules = (await readFile(new URL("_redirects", root), "utf8")).split("\n").filter(s => s && !s.startsWith("#")).map(s => s.trim().split(/\s+/));
assert.ok(rules.length <= 2000);
assert.equal(new Set(rules.map(r => r[0])).size, rules.length);
const redirects = new Map(rules.map(([from, to, status]) => [from, { to, status }]));
const sitemap = await readFile(new URL("sitemap.xml", root), "utf8");
const publicPaths = JSON.parse(await readFile(new URL("place-routes.json", root), "utf8"));
assert.doesNotMatch(sitemap, /\/regions\/\d+(?:<|\/|\?)/);
for (const [id, r] of Object.entries(registry)) {
  // A retained pin may have ceased carrying data: only sitemap-listed places are exported.
  const url = `/regions/${r.slug}`;
  if (!sitemap.includes(`${url}</loc>`)) continue;
  assert.equal(publicPaths[id], url);
  for (const path of [`regions/${r.slug}.html`, `regions/${id}.html`, `regions/${r.slug}/report.html`, `regions/${id}/report.html`]) await stat(new URL(path, root));
  assert.deepEqual(redirects.get(`/regions/${id}`), { to: url, status: "301" });
  if (r.level !== "zip") assert.deepEqual(redirects.get(`/regions/${id}/report`), { to: `${url}/report`, status: "301" });
}

// Cloudflare Pages' actual local server, not a hand-rolled redirect simulation.
for (const path of ["/regions/224", "/regions/12/report", "/regions/1"]) {
  const response = await fetch(`${origin}${path}?verify=1`, { redirect: "manual" });
  assert.equal(response.status, 301);
  const location = new URL(response.headers.get("location"), origin);
  assert.equal(location.pathname, redirects.get(path).to);
  assert.equal(location.search, "?verify=1");
}

const browser = await chromium.launch();
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const [path, title] of [
      ["/regions/princeton", "Princeton"],
      ["/regions/somerset-county", "Somerset"],
      ["/regions/zip-07030", "07030"],
      ["/regions/washington-township-morris-county", "Washington"],
      ["/regions/washington-township-warren-county", "Washington"],
      ["/regions/princeton/report", "Princeton"],
    ]) {
      const response = await page.goto(`${origin}${path}`);
      assert.equal(response.status(), 200);
      assert.ok((await page.locator("h1").first().innerText()).includes(title));
      assert.ok((await page.locator('link[rel="canonical"]').getAttribute("href")).endsWith(path));
      assert.deepEqual(await page.locator('a[href^="/regions/"]').evaluateAll(links => links.filter(link => /^\/regions\/\d+(?:\/report)?(?:[?#]|$)/.test(link.getAttribute("href"))).map(link => link.href)), [], "numeric navigation leaked");
    }
    await page.goto(`${origin}/regions/princeton`);
    await page.locator('a.report-action').click();
    await page.waitForURL(`${origin}/regions/princeton/report`);
    await page.goto(`${origin}/`);
    const search = page.locator('main input[role="combobox"]').first();
    await search.fill("Princeton");
    await page.getByRole("option").filter({ hasText: /^Princeton/ }).first().click();
    await page.waitForURL(`${origin}/regions/princeton`);
    await page.goto(`${origin}/regions/3283/report?verify=1#sources`);
    await page.waitForURL(`${origin}/regions/zip-07030/report?verify=1#sources`);
    assert.ok((await page.locator("h1").first().innerText()).includes("07030"));
    await context.close();
  }
  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const page = await noJS.newPage();
  const response = await page.goto(`${origin}/regions/3283/report`);
  assert.equal(response.status(), 200);
  await page.waitForURL(`${origin}/regions/zip-07030/report`);
  assert.ok((await page.locator("h1").first().innerText()).includes("07030"));
  assert.ok((await page.locator('link[rel="canonical"]').getAttribute("href")).endsWith("/regions/zip-07030/report"));
  await noJS.close();
} finally {
  await browser.close();
}
console.log(`Readable URL checks passed: exported registry, sitemap, ${rules.length} rules, host 301/query preservation, desktop/mobile report navigation and ZIP browser redirect/no-JS compatibility.`);
