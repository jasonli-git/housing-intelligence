import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { chromium } from "playwright";
import {navigate} from './lib/navigate.mjs';
import {fixedRoutes,legacyManifest,publishedPlaces,validateManifest} from './lib/publication.mjs';

// Run against `wrangler dev` serving dist/ (the Worker and its assets, ARCHITECTURE #454),
// not a hand-rolled redirect simulation: `npx wrangler dev --port 8787` from the repo root.
const origin = process.env.ROUTE_CHECK_ORIGIN ?? "http://127.0.0.1:8787";
const root = new URL("../../dist/site/", import.meta.url);
const registry = JSON.parse(await readFile(new URL("../lib/placeRoutes.json", import.meta.url), "utf8"));
const {entries} = JSON.parse(await readFile(new URL("../legacy-redirects.json", root), "utf8"));
const sitemap = await readFile(new URL("sitemap.xml", root), "utf8");
const publicPaths = JSON.parse(await readFile(new URL("place-routes.json", root), "utf8"));
const fixed = fixedRoutes(JSON.parse(await readFile(new URL("../lib/legacyFixedRoutes.json", import.meta.url), "utf8")));
// The bundled manifest is exactly what this registry and sitemap imply.
assert.deepEqual(entries, legacyManifest(publishedPlaces(registry, sitemap), fixed));
await validateManifest(root, entries);
const redirects = new Map(entries.map(({ from, to }) => [from, to]));
assert.doesNotMatch(sitemap, /\/regions\/\d+(?:<|\/|\?)/);
for (const [id, r] of Object.entries(registry)) {
  // A retained pin may have ceased carrying data: only sitemap-listed places are exported.
  const url = `/${r.state}/${r.slug}`;
  if (!sitemap.includes(`${url}</loc>`)) continue;
  assert.equal(publicPaths[id], url);
  for (const path of [`${r.state}/${r.slug}.html`, `${r.state}/${r.slug}/report.html`]) await stat(new URL(path, root));
  assert.equal(redirects.get(`/regions/${id}`), url);
  assert.equal(redirects.get(`/regions/${id}/report`), `${url}/report`);
}

// Every old address through the real runtime, ZIP reports included, with its query,
// asked for as a browser navigation: Workers answers those with the 404 page without
// running the Worker unless `run_worker_first` covers the path (#454).
for (const { from, to } of entries) {
  const response = await navigate(`${origin}${from}?verify=1`);
  assert.equal(response.status, 301, from);
  const location = new URL(response.location, origin);
  assert.equal(location.pathname, to, from);
  assert.equal(location.search, "?verify=1", from);
}
// Every sitemap page answers 200 at its own address, with no redirect: Workers' HTML
// handling differs from Pages', and the export has names such as afford.html beside an
// afford/ directory.
for (const loc of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const { pathname } = new URL(loc[1]);
  const response = await fetch(`${origin}${pathname}`, { redirect: "manual" });
  assert.equal(response.status, 200, pathname);
  await response.arrayBuffer();
}
for (const path of ["/regions/999999999", "/regions/12/metrics.json", "/no-such-page"]) {
  const response = await navigate(`${origin}${path}`);
  assert.equal(response.status, 404, path);
  assert.match(response.text, /<html/i, `${path} should serve the 404 page`);
}

const browser = await chromium.launch();
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const [path, title] of [
      ["/nj/princeton", "Princeton"],
      ["/nj/somerset-county", "Somerset"],
      ["/nj/zip-07030", "07030"],
      ["/nj/washington-township-morris-county", "Washington"],
      ["/nj/washington-township-warren-county", "Washington"],
      ["/nj/princeton/report", "Princeton"],
    ]) {
      const response = await page.goto(`${origin}${path}`);
      assert.equal(response.status(), 200);
      assert.ok((await page.locator("h1").first().innerText()).includes(title));
      assert.ok((await page.locator('link[rel="canonical"]').getAttribute("href")).endsWith(path));
      assert.deepEqual(await page.locator('a[href^="/regions/"]').evaluateAll(links => links.filter(link => /^\/regions\/\d+(?:\/report)?(?:[?#]|$)/.test(link.getAttribute("href"))).map(link => link.href)), [], "numeric navigation leaked");
    }
    await page.goto(`${origin}/nj/princeton`);
    await page.locator('a.eyebrow-report:not(.place-compare)').click();
    await page.waitForURL(`${origin}/nj/princeton/report`);
    await page.goto(`${origin}/`);
    const search = page.locator('main input[role="combobox"]').first();
    await search.fill("Princeton");
    await page.getByRole("option").filter({ hasText: /^Princeton/ }).first().click();
    await page.waitForURL(`${origin}/nj/princeton`);
    await page.goto(`${origin}/regions/3283/report?verify=1#sources`);
    await page.waitForURL(`${origin}/nj/zip-07030/report?verify=1#sources`);
    assert.ok((await page.locator("h1").first().innerText()).includes("07030"));
    await context.close();
  }
  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const page = await noJS.newPage();
  await page.goto(`${origin}/regions/3283/report`);
  await page.waitForURL(`${origin}/nj/zip-07030/report`);
  assert.ok((await page.locator("h1").first().innerText()).includes("07030"));
  assert.ok((await page.locator('link[rel="canonical"]').getAttribute("href")).endsWith("/nj/zip-07030/report"));
  await noJS.close();
} finally {
  await browser.close();
}
console.log(`Readable URL checks passed: exported registry, sitemap, ${entries.length} Worker redirects with queries, 404s, desktop/mobile report navigation and no-JS redirects.`);
