import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import {legacyManifest, parseRedirects, publishedPlaces, validateCoverage} from './lib/publication.mjs';

// Write fallback HTML only where _redirects has no rule. Pages follows redirects
// even when an asset matches (Cloudflare Pages /configuration/redirects, Per file).
// No account settings, Worker, Functions or Bulk Redirects are activated here.
const root = new URL("../out/", import.meta.url);
const registry = JSON.parse(await readFile(new URL("../lib/placeRoutes.json", import.meta.url), "utf8"));
const sitemap = await readFile(new URL("sitemap.xml", root), "utf8");
const firstCanonical = sitemap.match(/<loc>(https?:\/\/[^<]+)<\/loc>/)?.[1];
if (!firstCanonical) throw new Error("Missing sitemap origin");
const origin = new URL(firstCanonical).origin;
const rules=parseRedirects(await readFile(new URL('_redirects',root),'utf8'));
const places=publishedPlaces(registry,sitemap);
const entries=legacyManifest(places,rules);
let count = 0;
const publicPaths = {};
for (const {id,route:path} of places) {
  publicPaths[id] = path;
  for (const report of [false, true]) {
    const target = `${path}${report ? "/report" : ""}`;
    await stat(new URL(`.${target}.html`, root));
    const file = new URL(`regions/${id}${report ? "/report" : ""}.html`, root);
    if(rules.has(`/regions/${id}${report?'/report':''}`)) {
      // Safe on a repeated post-build run as well as a clean Next export. Remove
      // only this generated alias, never a canonical page or arbitrary directory.
      try { await unlink(file); } catch(error) { if(error.code!=='ENOENT')throw error; }
      continue;
    }
    // Region pages live under /<state>/ now, so nothing else creates regions/.
    await mkdir(new URL(report ? `regions/${id}/` : "regions/", root), { recursive: true });
    // Query/hash are browser-only and preserved by JS. With JS off, refresh still
    // reaches the full report; a visible link is a fallback for restrictive browsers.
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>This place has moved — Housing</title><link rel="canonical" href="${origin}${target}"><meta name="robots" content="noindex,follow"><script>location.replace(${JSON.stringify(target)}+location.search+location.hash)</script><noscript><meta http-equiv="refresh" content="0;url=${target}"></noscript></head><body><main><h1>This place has moved</h1><p><a href="${target}">Continue to the housing ${report ? "report" : "page"}</a>.</p></main></body></html>\n`;
    await writeFile(file, html);
    count++;
  }
}
// check-live reads the addresses of this build, not a registry from another checkout.
await writeFile(new URL("place-routes.json", root), `${JSON.stringify(publicPaths)}\n`);
await validateCoverage(root,entries);
const files = (await readdir(root, { recursive: true, withFileTypes: true })).filter(f => f.isFile());
if (files.length > 20000) throw new Error(`Static export has ${files.length} files, exceeding the Pages free-plan cap.`);
console.log(`${count} legacy HTML aliases; ${files.length} exported files (under the 20,000-file cap).`);
