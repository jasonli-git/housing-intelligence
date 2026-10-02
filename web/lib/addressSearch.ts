/**
 * Find any property in New Jersey from one typed address (Milestone 38, ARCHITECTURE
 * #294). The street index — `parcels/streets/<two letters>.json` — says which towns have
 * a street and the house numbers on it there, so the page reads one small file and then
 * only the town that holds the address.
 *
 * Normalising is `hip.addresses`'s rule, with its table read from `meta.json` rather than
 * copied here, so the browser and the index can never disagree on what "Ct" means.
 */

export type StreetWords = Record<string, string[]>;

/** `parcels/streets/meta.json`. */
export type StreetMeta = {
  shards: string[];
  /** Town geoid → [name, county, the state's district code]. */
  towns: Record<string, [string, string, string]>;
  /** ZIP → the towns it reaches, most of its residential addresses first. */
  zips: Record<string, string[]>;
  words: StreetWords;
};

/** One street index file: street → town geoid → house numbers. */
export type StreetShard = Record<string, Record<string, string[]>>;

export type Normaliser = {
  words: (text: string) => string[];
  /** Every spelling of a standard word, the word itself included. */
  spellings: (standard: string) => string[];
};

export function normaliser(table: StreetWords): Normaliser {
  const canonical = new Map<string, string>();
  for (const [standard, variants] of Object.entries(table)) {
    for (const variant of variants) canonical.set(variant, standard);
  }
  return {
    words: (text) =>
      text
        .toUpperCase()
        .replace(/'/g, "")
        .replace(/[^A-Z0-9 ]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => canonical.get(word) ?? word),
    spellings: (standard) => table[standard] ?? [standard],
  };
}

const NUMBER = /^(\d+[A-Z]?(?:-\d+[A-Z]?)?)(?:\s+1\/2)?(?:\s+(.*))?$/;
/** A unit after the street, cut off so a condominium is found under its building: `hip.addresses._UNIT`. */
const UNIT = /(?:\s*#|\s*,?\s*\b(?:UNIT|APT|APARTMENT|SUITE|STE|BLDG|BUILDING)\b|SUITE\b|\s+-BLDG\b|\s+[CU]-\d|\s+C0\d).*$/;

export type Address = { number: string | null; street: string };

/** An assessor's address as a house number and a normalised street, as `hip.addresses.parse`. */
export function parseAddress(address: string, n: Normaliser): Address {
  const upper = address.toUpperCase().replace(/\s+/g, " ").trim().replace(UNIT, "");
  const match = NUMBER.exec(upper);
  if (match && match[2]) return { number: match[1], street: n.words(match[2]).join(" ") };
  return { number: null, street: n.words(upper).join(" ") };
}

export function shardOf(street: string): string {
  return street.replace(/[^A-Z0-9]/g, "").slice(0, 2);
}

/** What a reader typed, taken apart: "100 Community Dr, Skillman NJ 08558". */
export type Query = {
  number: string | null;
  /** The street part's words, normalised; the last may be half-typed. */
  street: string[];
  /** The last street word as typed, for matching a spelling still being written. */
  partial: string;
  /** Whatever followed a comma, or the street, normalised: usually a town. */
  hint: string[];
  zip: string | null;
};

export function parseQuery(text: string, n: Normaliser): Query | null {
  let rest = text.trim().toUpperCase();
  const zip = /\b(\d{5})(?:-\d{4})?\s*$/.exec(rest);
  if (zip) rest = rest.slice(0, zip.index).trim();
  rest = rest.replace(/,?\s*(?:NJ|NEW JERSEY)\.?\s*$/, "").trim();
  const [first, ...after] = rest.split(",");
  const head = first.trim().replace(UNIT, "");
  const number = /^(\d+[A-Z]?(?:-\d+[A-Z]?)?)\s+(.*)$/.exec(head);
  const streetText = number ? number[2] : head;
  const street = n.words(streetText);
  if (street.length === 0 || street.join("").length < 2) return null;
  const raw = streetText.trim().split(/\s+/);
  // A trailing space or comma means the reader finished the word.
  const finished = /[\s,]$/.test(text) || after.length > 0;
  return {
    number: number ? number[1] : null,
    street,
    partial: finished ? "" : raw[raw.length - 1].replace(/[^A-Z0-9]/g, ""),
    hint: n.words(after.join(" ")),
    zip: zip ? zip[1] : null,
  };
}

export type StreetMatch = {
  street: string;
  towns: Record<string, string[]>;
  /** Words the reader typed after the street: a town, most likely. */
  leftover: string[];
  /** Whether the street was typed in full, rather than begun. */
  exact: boolean;
};

/**
 * The streets in a shard the query names. A street typed in full — its words the first
 * of the query's — beats one only begun, and a longer street beats a shorter: "Main St
 * Ext" is not "Main St". The words after a full street are kept as a town hint, so
 * "100 Community Dr Montgomery" works without a comma.
 */
export function matchStreets(shard: StreetShard, query: Query, n: Normaliser): StreetMatch[] {
  const q = query.street;
  const exact: StreetMatch[] = [];
  const begun: StreetMatch[] = [];
  for (const [street, towns] of Object.entries(shard)) {
    const words = street.split(" ");
    if (q.length >= words.length && words.every((w, i) => w === q[i])) {
      exact.push({ street, towns, leftover: q.slice(words.length), exact: true });
      continue;
    }
    if (q.length > words.length) continue;
    const last = q.length - 1;
    const head = q.slice(0, last).every((w, i) => w === words[i]);
    if (!head) continue;
    const typed = query.partial || q[last];
    const begins =
      words[last].startsWith(q[last]) ||
      n.spellings(words[last]).some((spelling) => spelling.startsWith(typed));
    if (begins) begun.push({ street, towns, leftover: [], exact: false });
  }
  if (exact.length > 0) {
    const longest = Math.max(...exact.map((m) => m.street.split(" ").length));
    return exact.filter((m) => m.street.split(" ").length === longest);
  }
  return begun.sort((a, b) => a.street.localeCompare(b.street)).slice(0, 40);
}

/**
 * Whether a house number in the index is the one typed: "4", or a range that holds it.
 * "2-6" is one building numbered across a side of a street, so it holds 2, 4 and 6 —
 * the numbers between of the same side's parity — but not 3 or 5, across the road.
 */
export function numberMatches(indexed: string, typed: string): boolean {
  if (indexed === typed) return true;
  const parts = indexed.split("-");
  if (parts.length !== 2) return false;
  if (parts.includes(typed)) return true;
  const [low, high, want] = [parseInt(parts[0], 10), parseInt(parts[1], 10), Number(typed)];
  if (!Number.isInteger(want) || !(low < high)) return false;
  return want > low && want < high && want % 2 === low % 2;
}

export type Hit = { street: string; geoid: string };

/**
 * Where the address could be, most likely first: a town the ZIP reaches, in HUD's order,
 * then a town the reader named, then alphabetical. With a house number, only towns that
 * have it on that street.
 */
export function placesFor(matches: StreetMatch[], query: Query, meta: StreetMeta, n: Normaliser): Hit[] {
  const zipTowns = query.zip ? (meta.zips[query.zip] ?? []) : [];
  const hint = [...query.hint, ...matches.flatMap((m) => m.leftover)];
  const named = (geoid: string) => {
    const [name, county] = meta.towns[geoid] ?? ["", ""];
    const words = [...n.words(name), ...n.words(county)];
    return hint.length > 0 && n.words(name).every((w) => hint.includes(w))
      ? 2
      : hint.some((w) => words.includes(w))
        ? 1
        : 0;
  };
  const hits: Hit[] = [];
  for (const match of matches) {
    for (const [geoid, numbers] of Object.entries(match.towns)) {
      if (query.number && !numbers.some((x) => numberMatches(x, query.number as string))) continue;
      hits.push({ street: match.street, geoid });
    }
  }
  const rank = (hit: Hit) => {
    const z = zipTowns.indexOf(hit.geoid);
    return [z === -1 ? 1 : 0, z === -1 ? 0 : z, -named(hit.geoid)];
  };
  return hits.sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    const [na, nb] = [meta.towns[a.geoid]?.[0] ?? "", meta.towns[b.geoid]?.[0] ?? ""];
    return na.localeCompare(nb) || a.street.localeCompare(b.street);
  });
}

/**
 * A town's parcels on a street, at a house number when one was typed, in house-number
 * order: what the reader picks from once the index has named the town.
 */
export function parcelsOn<P extends { address: string | null }>(
  parcels: P[],
  street: string,
  number: string | null,
  n: Normaliser,
  limit = 60,
): P[] {
  const found: { parcel: P; at: number }[] = [];
  for (const parcel of parcels) {
    if (!parcel.address) continue;
    const parsed = parseAddress(parcel.address, n);
    if (parsed.street !== street) continue;
    if (number && !(parsed.number && numberMatches(parsed.number, number))) continue;
    found.push({ parcel, at: parsed.number ? parseInt(parsed.number, 10) : Infinity });
  }
  return found
    .sort((a, b) => a.at - b.at)
    .slice(0, limit)
    .map((f) => f.parcel);
}
