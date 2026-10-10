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
const redirectFile = new URL("public/_redirects", root);
const marker = "# Generated place redirects; update with npm run routes:refresh.";
const original = (await readFile(redirectFile, "utf8")).split(marker)[0].trimEnd();
const path = (r) => `/${r.state_code.toLowerCase()}/${routes[r.region_id]}`;
const nation = regions.filter(r => r.level === "nation").flatMap(r => [`/regions/${r.region_id} / 301`, `/regions/${r.region_id}/report / 301`]);
const rules = [...nation, ...local.flatMap(r => [
  `/regions/${r.region_id} ${path(r)} 301`,
  ...(r.level === "zip" ? [] : [`/regions/${r.region_id}/report ${path(r)}/report 301`]),
])];
const originalRules = original.split("\n").filter(line => line.trim() && !line.trim().startsWith("#")).length;
if (rules.length + originalRules > 2000) throw new Error("Cloudflare static redirect limit exceeded; revise the compatibility strategy before updating.");
const identities = { ...pinned };
for (const r of local) identities[r.region_id] = { slug: routes[r.region_id], state: r.state_code.toLowerCase(), geoid: r.geoid, level: r.level };
await writeFile(registry, `${JSON.stringify(identities, null, 2)}\n`);
await writeFile(redirectFile, `${original}\n\n${marker}\n${rules.join("\n")}\n`);
console.log(`${local.length} readable routes; ${rules.length + originalRules} static redirects. ZIP reports retain browser redirects and canonical aliases.`);
