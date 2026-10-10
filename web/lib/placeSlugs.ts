import type { Region } from "./api";

/**
 * Pure allocation of the slug within a place's state; existing addresses are reserved
 * forever, even after renames. Collisions are only within a state, since the state is
 * part of the address (`/nj/essex-county`, never `/regions/essex-county-nj`).
 */
export function allocatePlaceSlugs(regions: Region[], existing: Record<string, string> = {}): Record<string, string> {
  const slug = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const base = (r: Region) => r.level === "zip" ? `zip-${r.name}` : r.level === "county" ? `${slug(r.name)}-county` : slug(r.name);
  const key = (r: Region, s: string) => `${r.state_code.toLowerCase()}/${s}`;
  const byId = new Map(regions.map(r => [r.region_id, r]));
  const stateOf = (id: string) => byId.get(Number(id))?.state_code.toLowerCase() ?? "";
  const result = { ...existing };
  const used = new Set(Object.entries(existing).map(([id, s]) => `${stateOf(id)}/${s}`));
  if (new Set(Object.values(existing).map((s, i) => `${stateOf(Object.keys(existing)[i])}/${s}`)).size !== Object.keys(existing).length) {
    throw new Error("Duplicate pinned place slugs");
  }
  const counts = new Map<string, number>();
  for (const r of regions) counts.set(key(r, base(r)), (counts.get(key(r, base(r))) ?? 0) + 1);
  for (const r of [...regions].sort((a, b) => a.region_id - b.region_id)) {
    if (result[r.region_id]) continue;
    let candidate = base(r);
    if ((counts.get(key(r, candidate)) ?? 0) > 1 || used.has(key(r, candidate))) {
      const parent = r.parent_id === null ? undefined : byId.get(r.parent_id);
      candidate = r.level === "municipality" && parent?.level === "county"
        ? `${slug(r.name_lsad ?? r.name)}-${slug(parent.name)}-county`
        : `${candidate}-${slug(r.geoid)}`;
    }
    if (!candidate || /^\d+$/.test(candidate) || used.has(key(r, candidate))) candidate = `${candidate || r.level}-${slug(r.geoid)}`;
    if (used.has(key(r, candidate))) throw new Error(`Unresolved place slug collision: ${candidate}`);
    result[r.region_id] = candidate;
    used.add(key(r, candidate));
  }
  return result;
}
