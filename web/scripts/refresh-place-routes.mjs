import { readFile, writeFile } from "node:fs/promises";
import { allocatePlaceSlugs } from "../lib/placeSlugs.ts";

// Explicit, reviewable registry update, not a build side effect. Pinned slugs never rename.
const root = new URL("../", import.meta.url);
const registry = new URL("lib/placeRoutes.json", root);
const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const regions = [];
for (let offset = 0; ; offset += 1000) {
  const response = await fetch(`${origin}/regions?has_data=true&limit=1000&offset=${offset}`);
  if (!response.ok) throw new Error(`Region enumeration failed: ${response.status}`);
  const page = await response.json();
  regions.push(...page.items);
  if (regions.length >= page.total) break;
  if (!page.items.length) throw new Error("Incomplete region enumeration");
}
// States and the nation have pages of their own (`/states/...`, `/`), not place addresses.
const local = regions.filter(r => r.level !== "state" && r.level !== "nation");
const pinned = JSON.parse(await readFile(registry, "utf8"));
for (const r of local) {
  const old = pinned[r.region_id];
  if (old && typeof old === "object" && (old.geoid !== r.geoid || old.level !== r.level)) {
    throw new Error(`Region ${r.region_id} changed geographic identity; do not reassign its old public URL.`);
  }
}
const routes = allocatePlaceSlugs(local, Object.fromEntries(Object.entries(pinned).map(([id, record]) => [id, typeof record === "string" ? record : record.slug])));
const identities = { ...pinned };
for (const r of local) identities[r.region_id] = { slug: routes[r.region_id], state: r.state_code.toLowerCase(), geoid: r.geoid, level: r.level };
await writeFile(registry, `${JSON.stringify(identities, null, 2)}\n`);
// The old numeric addresses follow from this registry at build time (write-legacy-routes).
console.log(`${local.length} readable routes.`);
