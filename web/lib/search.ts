/**
 * Finding a place by name (Milestone 17): the index `search.json` is built from, and the
 * matching the search box does over it in the browser.
 *
 * Every result carries what tells it apart — a municipality's legal type and county,
 * because New Jersey has two Boontons in Morris County, a town and a township, and a
 * list reading "Boonton, Boonton" is no answer. ZIP codes carry no county: a ZIP is
 * many-to-many with municipalities and counties, and naming one would be a guess.
 */

import type { Region } from "@/lib/api";
import { displayName, legalType } from "@/lib/names";

export type SearchEntry = { id: number; name: string; detail: string; level: string };

// The order results of equal fit are listed in: a county before a town before a ZIP.
const LEVEL_ORDER: Record<string, number> = { county: 0, municipality: 1, zip: 2 };

function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** One entry per searchable region: counties, municipalities and ZIP codes with data. */
export function searchEntries(regions: Region[]): SearchEntry[] {
  const counties = new Map(
    regions.filter((r) => r.level === "county").map((r) => [r.region_id, displayName(r)]),
  );
  return regions
    .filter((r) => r.level in LEVEL_ORDER)
    .map((r) => {
      if (r.level === "county") return { id: r.region_id, name: displayName(r), detail: "County", level: r.level };
      if (r.level === "zip") return { id: r.region_id, name: displayName(r), detail: "ZIP code", level: r.level };
      const kind = capitalised(legalType(r) ?? "municipality");
      const county = r.parent_id === null ? undefined : counties.get(r.parent_id);
      return { id: r.region_id, name: r.name, detail: county ? `${kind} in ${county}` : kind, level: r.level };
    })
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.name.localeCompare(b.name));
}

function normalised(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The entries a query finds, best first: names that start with it, then names with a
 * word that does, then names containing it. Within each, counties lead, then shorter
 * names, so "Mercer" puts Mercer County above Mercerville.
 */
export function matchEntries(entries: SearchEntry[], query: string, limit = 8): SearchEntry[] {
  const q = normalised(query);
  if (!q) return [];
  const scored: [number, SearchEntry][] = [];
  for (const entry of entries) {
    const name = normalised(entry.name);
    const fit = name.startsWith(q)
      ? 0
      : name.split(" ").some((word) => word.startsWith(q))
        ? 1
        : name.includes(q)
          ? 2
          : -1;
    if (fit >= 0) scored.push([fit, entry]);
  }
  return scored
    .sort(
      ([fa, a], [fb, b]) =>
        fa - fb ||
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
        a.name.length - b.name.length ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map(([, entry]) => entry);
}
