import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const dist = process.env.CHECK_LIVE_DIST
  ? path.resolve(root, process.env.CHECK_LIVE_DIST)
  : path.join(root, "dist");
const siteDir = path.join(dist, "site");
const artifactsDir = path.join(dist, "artifacts");
const siteUrl = baseUrl("SITE_URL", "https://housing.jasonli.app");
const artifactUrl = baseUrl("ARTIFACT_URL", "https://housing-data.jasonli.app");
const timeout = timeoutMs(process.env.CHECK_LIVE_TIMEOUT_MS);

// Both production origins deliberately challenge script-like HTTP clients. Check them
// through a real browser, then compare their meaningful content with the publish tree:
// the complete manifest for artifacts and normalized <main> text for rendered pages.

function baseUrl(name, fallback) {
  const value = process.env[name] ?? fallback;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `${name} must be an absolute URL, received ${JSON.stringify(value)}`,
    );
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(
      `${name} must use http or https, received ${parsed.protocol}`,
    );
  }
  return parsed;
}

function timeoutMs(value) {
  if (value === undefined) return 45_000;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `CHECK_LIVE_TIMEOUT_MS must be a positive integer, received ${value}`,
    );
  }
  return parsed;
}

function liveUrl(base, route) {
  return new URL(
    route.replace(/^\/+/, ""),
    `${base.toString().replace(/\/+$/, "")}/`,
  ).toString();
}

function routeFile(route) {
  if (route === "/") return path.join(siteDir, "index.html");
  const parts = route.split("/").filter(Boolean);
  const filename = `${parts.pop()}.html`;
  return path.join(siteDir, ...parts, filename);
}

// The publish tree is served over HTTP rather than opened as a file, and that is not a
// detail. A static export references its scripts by absolute path (`/_next/static/...`),
// which under `file://` resolves to the filesystem root and never loads — so the local
// side rendered server HTML while the deployed side hydrated. That was invisible while
// no page needed JavaScript to reach its final content, and stopped being invisible on
// 2026-09-21: the region redesign sizes its housing band from the measured container, so
// the local render showed three facts against the deployed six, and `check-live` failed
// a deploy that was in fact correct. Comparing a hydrated page with an unhydrated one is
// not a comparison.
let localServer;
let localOrigin;

async function startLocalServer() {
  const types = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".txt", "text/plain; charset=utf-8"],
    [".svg", "image/svg+xml"],
    [".woff2", "font/woff2"],
    [".ico", "image/x-icon"],
    [".png", "image/png"],
  ]);
  localServer = createServer(async (request, response) => {
    const requested = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    // Resolve inside siteDir, and refuse anything that escapes it.
    const candidate = path.resolve(siteDir, `.${requested}`);
    if (candidate !== siteDir && !candidate.startsWith(siteDir + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    for (const attempt of [
      candidate,
      `${candidate}.html`,
      path.join(candidate, "index.html"),
    ]) {
      try {
        const body = await readFile(attempt);
        response.writeHead(200, {
          "content-type":
            types.get(path.extname(attempt)) ?? "application/octet-stream",
        });
        response.end(body);
        return;
      } catch {
        // try the next spelling
      }
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => localServer.listen(0, "127.0.0.1", resolve));
  localOrigin = `http://127.0.0.1:${localServer.address().port}`;
}

async function stopLocalServer() {
  if (localServer) await new Promise((resolve) => localServer.close(resolve));
  localServer = undefined;
}

function localUrl(route) {
  return `${localOrigin}${route === "/" ? "/index.html" : route}`;
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

async function marker(page) {
  const heading = normalize(
    (await page.locator("h1").first().textContent()) ?? "",
  );
  const metaNode = page.locator("p.meta").first();
  const meta = (await metaNode.count())
    ? await metaNode.evaluate((node) => {
        const copy = node.cloneNode(true);
        copy
          .querySelectorAll("[role=tooltip]")
          .forEach((tooltip) => tooltip.remove());
        return copy.textContent ?? "";
      })
    : "";
  // Text worked out from the reader's clock (`data-volatile`, e.g. "built 3 days ago")
  // is left out: it is not content the build decided, and the two sides can be read
  // either side of midnight.
  const content = normalize(
    (await page.locator("main").first().evaluate((node) => {
      const copy = node.cloneNode(true);
      copy.querySelectorAll("[data-volatile]").forEach((part) => part.remove());
      return copy.textContent ?? "";
    })) ?? "",
  );
  const contentSha256 = createHash("sha256").update(content).digest("hex");
  return { heading, meta: normalize(meta), contentSha256 };
}

// Both sides are read once the page has loaded and its network has gone quiet, which
// is when its client code has drawn what it fetches. ARCHITECTURE #203 said this and
// the code never did it: the local side read at `domcontentloaded` and the live side
// as soon as its heading appeared, so which of them had hydrated was a race. On
// 2026-09-26 the local home page had drawn its map and the live one still showed "The
// map needs JavaScript to draw", failing a deploy that was correct (#234).
async function settle(page) {
  await page.waitForLoadState("load", { timeout });
  await page.waitForLoadState("networkidle", { timeout });
}

/**
 * The local side reads its artifacts from `dist/artifacts`, as the live side reads them
 * from R2. A page that fetches artifacts — `/tax` since Milestone 38 loads the street
 * index on arrival — would otherwise ask R2 from a localhost origin the bucket's CORS
 * rule rightly refuses, and draw an error the live page never shows: the deploy of
 * 2026-10-02 was correct and failed this check on exactly that.
 */
async function serveLocalArtifacts(request) {
  const requested = decodeURIComponent(new URL(request.url()).pathname);
  const candidate = path.resolve(artifactsDir, `.${requested}`);
  if (!candidate.startsWith(artifactsDir + path.sep)) {
    return { status: 403, body: "" };
  }
  try {
    return {
      status: 200,
      body: await readFile(candidate),
      contentType: candidate.endsWith(".json") ? "application/json" : undefined,
      headers: { "access-control-allow-origin": "*" },
    };
  } catch {
    return { status: 404, body: "", headers: { "access-control-allow-origin": "*" } };
  }
}

async function localMarker(page, route) {
  const file = routeFile(route);
  await access(file);
  const pattern = `${artifactUrl.origin}/**`;
  await page.route(pattern, async (intercepted) =>
    intercepted.fulfill(await serveLocalArtifacts(intercepted.request())),
  );
  try {
    await page.goto(localUrl(route), { waitUntil: "domcontentloaded", timeout });
    await settle(page);
    return marker(page);
  } finally {
    await page.unroute(pattern);
  }
}

async function liveMarker(page, route, expected) {
  let navigationStatus;
  const rememberStatus = (response) => {
    if (
      response.frame() === page.mainFrame() &&
      response.request().isNavigationRequest()
    ) {
      navigationStatus = response.status();
    }
  };
  page.on("response", rememberStatus);
  try {
    await page.goto(liveUrl(siteUrl, route), {
      waitUntil: "domcontentloaded",
      timeout,
    });
    // The first h1's text, as `marker` reads it: an accessible-name match missed the
    // tax page's "Find a property.<br />See its tax picture." (PR #89), whose name
    // gains a space the text content does not have.
    await page.waitForFunction(
      (heading) =>
        (document.querySelector("h1")?.textContent ?? "").replace(/\s+/g, " ").trim() ===
        heading,
      expected.heading,
      { timeout },
    );
    await settle(page);
    if (navigationStatus !== 200) {
      throw new Error(
        `${route} returned HTTP ${navigationStatus ?? "unknown"}`,
      );
    }
    return marker(page);
  } finally {
    page.off("response", rememberStatus);
  }
}

function assertMarker(route, expected, actual) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(
      [
        `${route} does not match the local publish`,
        `  expected heading: ${expected.heading}`,
        `  deployed heading: ${actual.heading}`,
        `  expected marker:  ${expected.meta}`,
        `  deployed marker:  ${actual.meta}`,
        `  expected content: ${expected.contentSha256}`,
        `  deployed content: ${actual.contentSha256}`,
      ].join("\n"),
    );
  }
}

// The three shapes the cost-to-own card can take (`web/lib/costInputs.ts:homePrice`),
// pinned by region id rather than sampled. Milestone 27, replacing the municipality
// pick below: it took whichever town search.json listed first, which was Aberdeen when
// this was written up as a gap — and by the time it was fixed, Aberdeen itself had lost
// its Zillow coverage and silently become the "neither" case instead of the "Zillow"
// case it was meant to demonstrate. A sampled pick cannot be wrong in a way anyone
// notices; a named one can only go stale in a way a future check-live failure surfaces.
// Verified against the warehouse 2026-09-25 and re-checked against search.json here.
const COST_CARD_SHAPES = [
  { label: "muni-zillow", id: 194 }, // Absecon: zhvi_sfr through 2026-08-31
  { label: "muni-transaction", id: 112 }, // Frankford: no zhvi_sfr, sr1a through 2026-06-30
  { label: "muni-neither", id: 51 }, // Walpack: no zhvi_sfr, no sr1a ever
];

async function pageSamples() {
  const searchPath = path.join(siteDir, "search.json");
  const entries = JSON.parse(await readFile(searchPath, "utf8"));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  let publicPaths = {};
  try {
    publicPaths = JSON.parse(await readFile(path.join(siteDir, "place-routes.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // Old publish trees predate readable URLs and still use numeric routes.
  }
  const placePath = (entry) => publicPaths[entry.id] ?? `/regions/${entry.id}`;
  // `/` is the United States entry and New Jersey's own page its first state (PR #88).
  const samples = [
    { label: "site", route: "/" },
    { label: "state", route: "/states/new-jersey" },
  ];

  for (const level of ["county", "zip"]) {
    const entry = entries.find((candidate) => candidate.level === level);
    if (!entry) throw new Error(`${searchPath} has no ${level} entry`);
    samples.push({ label: level, route: placePath(entry) });
  }

  for (const { label, id } of COST_CARD_SHAPES) {
    const entry = byId.get(id);
    if (!entry) {
      throw new Error(
        `${searchPath} has no region ${id} (${label}) — the region was renumbered or ` +
          "removed; find its replacement in the warehouse and update COST_CARD_SHAPES",
      );
    }
    samples.push({ label, route: placePath(entry) });
  }

  const county = entries.find((entry) => entry.level === "county");
  samples.push({ label: "report", route: `${placePath(county)}/report` });
  // The two pages about the data (Milestone 27), which no region sample reaches.
  samples.push({ label: "freshness", route: "/freshness" });
  samples.push({ label: "changes", route: "/changes" });
  // Milestone 37's property-tax lookup; its per-town files are artifacts, checked with
  // the rest of the manifest.
  samples.push({ label: "tax", route: "/tax" });
  samples.push({ label: "terms", route: "/terms" });
  samples.push({ label: "privacy", route: "/privacy" });
  return samples;
}

async function checkManifest(page) {
  const manifestPath = path.join(artifactsDir, "manifest.json");
  const expected = JSON.parse(await readFile(manifestPath, "utf8"));
  let navigationStatus;
  const rememberStatus = (response) => {
    if (
      response.frame() === page.mainFrame() &&
      response.request().isNavigationRequest()
    ) {
      navigationStatus = response.status();
    }
  };
  page.on("response", rememberStatus);
  try {
    await page.goto(liveUrl(artifactUrl, "/manifest.json"), {
      waitUntil: "domcontentloaded",
      timeout,
    });
    await page.waitForFunction(
      () => {
        try {
          const parsed = JSON.parse(document.body.textContent ?? "");
          return (
            typeof parsed.generated_at === "string" &&
            Array.isArray(parsed.artifacts)
          );
        } catch {
          return false;
        }
      },
      undefined,
      { timeout },
    );
    if (navigationStatus !== 200) {
      throw new Error(
        `artifact manifest returned HTTP ${navigationStatus ?? "unknown"}`,
      );
    }
    const actual = JSON.parse(await page.locator("body").textContent());
    if (!isDeepStrictEqual(actual, expected)) {
      throw new Error(
        [
          "deployed artifact manifest does not match dist/artifacts/manifest.json",
          `  local:    ${expected.generated_at} · ${expected.artifact_count} artifacts · ${expected.total_bytes} bytes`,
          `  deployed: ${actual.generated_at} · ${actual.artifact_count} artifacts · ${actual.total_bytes} bytes`,
        ].join("\n"),
      );
    }
    console.log(
      `ok artifacts  ${expected.artifact_count} files from ${expected.generated_at} match the local manifest`,
    );
  } finally {
    page.off("response", rememberStatus);
  }
}

/**
 * A parcel file fetched from the live site's own origin, as the property-tax lookup
 * does (Milestone 37). Every other artifact is opened as a link; these are read by the
 * page's script, which the browser allows only if the bucket answers with a CORS header
 * for the site. The deploy of 2026-10-02 shipped without one and every check above
 * passed: the files existed and the page rendered, and no town would load.
 */
async function checkCrossOrigin(page) {
  const manifest = JSON.parse(await readFile(path.join(artifactsDir, "manifest.json"), "utf8"));
  const parcel = manifest.artifacts.find(
    (a) => a.path.startsWith("parcels/") && !a.path.startsWith("parcels/streets/"),
  );
  if (!parcel) return;
  await page.goto(liveUrl(siteUrl, "/tax"), { waitUntil: "domcontentloaded", timeout });
  const url = liveUrl(artifactUrl, `/${parcel.path}`).toString();
  const result = await page.evaluate(async (target) => {
    try {
      const response = await fetch(target);
      const body = await response.json();
      return { status: response.status, rows: Array.isArray(body.parcels) ? body.parcels.length : -1 };
    } catch (error) {
      return { error: String(error) };
    }
  }, url);
  if (result.error || result.status !== 200 || result.rows < 1) {
    throw new Error(
      `${parcel.path} cannot be read by the site's own pages (${result.error ?? `HTTP ${result.status}`}). ` +
        "The bucket's CORS rule may be missing: run `make r2-cors`.",
    );
  }
  console.log(`ok cors       ${parcel.path} reads from ${siteUrl.origin} · ${result.rows} parcels`);
}

/**
 * The statewide search, driven as a reader would (Milestone 38): an address from a town's
 * file typed with no town chosen must come back as a result, which takes the street
 * index's `meta.json`, its shard and the town's file, all read across origins.
 */
async function checkStatewideSearch(page) {
  const manifest = JSON.parse(await readFile(path.join(artifactsDir, "manifest.json"), "utf8"));
  if (!manifest.artifacts.some((a) => a.path === "parcels/streets/meta.json")) return;
  const town = manifest.artifacts.find(
    (a) => a.path.startsWith("parcels/") && !a.path.startsWith("parcels/streets/"),
  );
  const file = JSON.parse(await readFile(path.join(artifactsDir, town.path), "utf8"));
  const at = file.columns.indexOf("address");
  const address = file.parcels.map((row) => row[at]).find((a) => /^\d+ [A-Z]/.test(a ?? ""));
  if (!address) return;
  await page.goto(liveUrl(siteUrl, "/tax"), { waitUntil: "networkidle", timeout });
  const box = page.getByLabel("Address, or block and lot");
  await box.waitFor({ state: "visible", timeout });
  // The box is disabled until the street index's meta.json has loaded.
  await page.waitForFunction(
    () => !document.querySelector('input[aria-label="Address, or block and lot"]')?.disabled,
    null,
    { timeout },
  );
  await box.fill(address);
  const [number] = address.split(" ");
  const answer = page.locator(".tax-results button").first();
  try {
    await answer.waitFor({ state: "visible", timeout });
  } catch {
    throw new Error(`/tax found nothing for "${address}" (${file.municipality}) searched statewide.`);
  }
  const text = await answer.innerText();
  if (!text.startsWith(number)) {
    throw new Error(`/tax answered "${address}" with "${text.split("\n")[0]}".`);
  }
  console.log(`ok search     "${address}" found statewide · ${file.municipality}`);
}

async function run() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    throw new Error(
      `Chromium could not start. Run 'cd web && npx playwright install chromium'.\n${error.message}`,
    );
  }

  try {
    await startLocalServer();
    // The region carousels rotate every twelve seconds, which would make a text hash
    // depend on how long each fetch took. `prefers-reduced-motion` is the project's own
    // switch for that — `useAutoCarousel` stops advancing under it — so the check asks
    // for it rather than racing the timer. It changes motion, never content.
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(timeout);
    await checkManifest(page);
    await checkCrossOrigin(page);
    await checkStatewideSearch(page);

    for (const sample of await pageSamples()) {
      const expected = await localMarker(page, sample.route);
      const actual = await liveMarker(page, sample.route, expected);
      assertMarker(sample.route, expected, actual);
      console.log(
        `ok ${sample.label.padEnd(10)} ${sample.route} · ${actual.heading}`,
      );
    }

    console.log(
      `live OK: ${siteUrl.origin} and ${artifactUrl.origin} match ${dist}`,
    );
  } finally {
    await browser.close();
    await stopLocalServer();
  }
}

run().catch((error) => {
  console.error(`check-live failed: ${error.message}`);
  process.exitCode = 1;
});
