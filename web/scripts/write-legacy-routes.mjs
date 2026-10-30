import {mkdir, readFile, writeFile} from "node:fs/promises";
import {FILE_CAP, FILE_WARN, exportFiles, fixedRoutes, legacyManifest, publishedPlaces, validateManifest} from './lib/publication.mjs';

// The old numeric addresses' manifest, which the site's Worker bundles (ARCHITECTURE
// #454). Written outside out/: it is the Worker's input, not a page. `make publish`
// moves it beside dist/site.
const root = new URL("../out/", import.meta.url);
const output = new URL("../.publication/", import.meta.url);
const registry = JSON.parse(await readFile(new URL("../lib/placeRoutes.json", import.meta.url), "utf8"));
const fixed = fixedRoutes(JSON.parse(await readFile(new URL("../lib/legacyFixedRoutes.json", import.meta.url), "utf8")));
const sitemap = await readFile(new URL("sitemap.xml", root), "utf8");
const places = publishedPlaces(registry, sitemap);
const entries = legacyManifest(places, fixed);
await validateManifest(root, entries);
// check-live reads the addresses of this build, not a registry from another checkout.
await writeFile(new URL("place-routes.json", root), `${JSON.stringify(Object.fromEntries(places.map(p => [p.id, p.route])))}\n`);
await mkdir(output, {recursive: true});
await writeFile(new URL("legacy-redirects.json", output), `${JSON.stringify({version: 2, entries}, null, 2)}\n`);
const files = (await exportFiles(root)).length;
if (files > FILE_CAP) throw new Error(`Static export has ${files} files, over the ${FILE_CAP.toLocaleString("en")}-file cap of Workers static assets.`);
if (files > FILE_WARN) console.warn(`WARNING: ${files} exported files, past ${FILE_WARN.toLocaleString("en")} of the ${FILE_CAP.toLocaleString("en")}-file cap.`);
console.log(`${entries.length} legacy redirects for the Worker; ${files} exported files (cap ${FILE_CAP.toLocaleString("en")}).`);
