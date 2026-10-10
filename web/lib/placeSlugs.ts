import type { Region } from "./api";

/** Pure allocation; existing public addresses are reserved forever, even after renames. */
export function allocatePlaceSlugs(regions: Region[], existing: Record<string, string> = {}): Record<string, string> {
  const slug = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const base = (r: Region) => r.level === "zip" ? `zip-${r.name}` : r.level === "county" ? `${slug(r.name)}-county` : slug(r.name);
  const result = { ...existing };
  const used = new Set(Object.values(existing));
  if (used.size !== Object.keys(existing).length) throw new Error("Duplicate pinned place slugs");
  const byId = new Map(regions.map(r => [r.region_id, r]));
  const counts = new Map<string, number>();
  for (const r of regions) counts.set(base(r), (counts.get(base(r)) ?? 0) + 1);
  for (const r of [...regions].sort((a, b) => a.region_id - b.region_id)) {
    if (result[r.region_id]) continue;
    let candidate = base(r);
    if ((counts.get(candidate) ?? 0) > 1 || used.has(candidate)) {
      const parent = r.parent_id === null ? undefined : byId.get(r.parent_id);
      candidate = r.level === "municipality"
        ? `${slug(r.name_lsad ?? r.name)}-${parent?.level === "county" ? `${slug(parent.name)}-county` : slug(r.state_code)}`
        : `${candidate}-${slug(r.state_code)}`;
    }
    if (!candidate || /^\d+$/.test(candidate) || used.has(candidate)) candidate = `${candidate || r.level}-${slug(r.geoid)}`;
    if (used.has(candidate)) throw new Error(`Unresolved place slug collision: ${candidate}`);
    result[r.region_id] = candidate;
    used.add(candidate);
  }
  return result;
}
