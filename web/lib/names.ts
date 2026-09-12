/**
 * How a region is named to a reader, and how its peers are counted.
 *
 * The warehouse stores a county as "Mercer" and a ZIP as its five digits, which is right
 * for identifiers and wrong for a heading: "Mercer" alone could be anything, and
 * "08540" reads as a number rather than a place.
 */

export function displayName(region: { name: string; level: string }): string {
  if (region.level === "county") return `${region.name} County`;
  if (region.level === "zip" && /^\d{5}$/.test(region.name)) return `ZIP ${region.name}`;
  return region.name;
}

const PLURALS: Record<string, string> = {
  state: "states",
  county: "counties",
  municipality: "municipalities",
  zip: "ZIP codes",
  tract: "tracts",
};

/** "counties", "municipalities", "ZIP codes" — the peers a rank is taken among. */
export function peerNoun(level: string): string {
  return PLURALS[level] ?? `${level} regions`;
}

const SCOPES: Record<string, string> = { NJ: "New Jersey" };

/** The place a peer group spans, e.g. "New Jersey" for `NJ`. */
export function scopeName(code: string): string {
  return SCOPES[code] ?? code;
}
