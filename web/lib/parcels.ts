/**
 * The property-tax lookup's arithmetic (Milestone 37, ARCHITECTURE #289): finding a
 * parcel in a town's file, what its assessment implies at the state's ratio, and where
 * it sits among the town's parcels of the same class.
 *
 * Kept apart from the component so each rule is tested on its own. None of it reaches a
 * person: the files carry where a parcel is and what is assessed on it, never who owns
 * it, because the source fields that would say were never requested.
 */

export type Dated = { year: number; value: number };

export type ParcelFile = {
  geoid: string;
  municipality?: string;
  county?: string;
  tax_year: number;
  /** The Director's Ratio of the assessment's own tax year, as a percentage. */
  assessment_ratio?: Dated;
  nj_director_ratio?: Dated;
  nj_revaluation_year?: Dated;
  nj_effective_tax_rate?: Dated;
  nj_general_tax_rate?: Dated;
  classes: Record<string, string>;
  columns: string[];
  parcels: unknown[][];
};

export type Parcel = {
  block: string;
  lot: string;
  qualifier: string | null;
  address: string | null;
  propertyClass: string;
  land: number | null;
  improvement: number | null;
  assessed: number | null;
  tax: number | null;
  yearBuilt: number | null;
  dwellings: number | null;
  building: string | null;
  /** The lot's area, from the parcel map; null in files written before #427. */
  acres: number | null;
};

/** The rows of a town's file, as objects. */
export function parcelsOf(file: ParcelFile): Parcel[] {
  const at = (name: string) => file.columns.indexOf(name);
  const index = {
    block: at("block"),
    lot: at("lot"),
    qualifier: at("qualifier"),
    address: at("address"),
    propertyClass: at("class"),
    land: at("land"),
    improvement: at("improvement"),
    assessed: at("assessed"),
    tax: at("tax"),
    yearBuilt: at("year_built"),
    dwellings: at("dwellings"),
    building: at("building"),
    acres: at("acres"),
  };
  return file.parcels.map((row) => ({
    block: String(row[index.block] ?? ""),
    lot: String(row[index.lot] ?? ""),
    qualifier: (row[index.qualifier] as string | null) ?? null,
    address: (row[index.address] as string | null) ?? null,
    propertyClass: String(row[index.propertyClass] ?? ""),
    land: (row[index.land] as number | null) ?? null,
    improvement: (row[index.improvement] as number | null) ?? null,
    assessed: (row[index.assessed] as number | null) ?? null,
    tax: (row[index.tax] as number | null) ?? null,
    yearBuilt: (row[index.yearBuilt] as number | null) ?? null,
    dwellings: (row[index.dwellings] as number | null) ?? null,
    building: (row[index.building] as string | null) ?? null,
    acres: index.acres < 0 ? null : ((row[index.acres] as number | null) ?? null),
  }));
}

// "12/3", "12, 3", "block 12 lot 3" or "12 lot 3": a block and a lot.
const BLOCK_LOT = /^\s*(?:block\s*)?([0-9a-z.]+)\s*(?:\/|,|\s+lot\s+)\s*([0-9a-z.]+)\s*$/i;

/**
 * The parcels at a block and lot, written as `BLOCK_LOT` allows ("12/3", "12, 3",
 * "block 12 lot 3"), qualifiers included, since condominium units share a block and lot.
 * At most `limit`, in file order. Addresses are found statewide by
 * `web/lib/addressSearch.ts` (Milestone 38); anything that is not a block and lot finds
 * nothing here.
 */
export function search(parcels: Parcel[], query: string, limit = 25): Parcel[] {
  const blockLot = BLOCK_LOT.exec(query);
  if (!blockLot) return [];
  const found: Parcel[] = [];
  for (const parcel of parcels) {
    if (
      parcel.block.toUpperCase() === blockLot[1].toUpperCase() &&
      parcel.lot.toUpperCase() === blockLot[2].toUpperCase()
    ) {
      found.push(parcel);
      if (found.length >= limit) break;
    }
  }
  return found;
}

/**
 * The market value the state's ratio implies for an assessment: assessed value over the
 * Director's Ratio of the assessment's tax year. The state's method for equalizing
 * assessments across towns, not an appraisal of this property.
 */
export function impliedValue(assessed: number | null, ratio: Dated | undefined): number | null {
  if (assessed === null || assessed <= 0 || !ratio || ratio.value <= 0) return null;
  return assessed / (ratio.value / 100);
}

/**
 * The share of the town's parcels of the same class assessed below this one, 0 to 100.
 * Only the same class: a house is never ranked among office buildings or vacant lots.
 */
export function classPercentile(parcels: Parcel[], parcel: Parcel): number | null {
  if (parcel.assessed === null) return null;
  const peers = parcels.filter(
    (p) => p.propertyClass === parcel.propertyClass && p.assessed !== null && p.assessed > 0,
  );
  if (peers.length < 2) return null;
  const below = peers.filter((p) => (p.assessed as number) < (parcel.assessed as number)).length;
  return Math.round((below / peers.length) * 100);
}

/** The threshold N.J.A.C. 18:12A-1.14 names: a Director's Ratio at or below 85%. */
export const REVALUATION_RATIO = 85;

/** Whether the state's rules would generally read the ratio as calling for a revaluation. */
export function revaluationIndicated(ratio: Dated | undefined): boolean | null {
  return ratio ? ratio.value <= REVALUATION_RATIO : null;
}

/**
 * The assessor's building code in words, where it reads unambiguously (2026-10-15):
 * "2SF2AG" is a 2-story wood-frame house with a 2-car attached garage. Codes are each
 * town's own shorthand, not a state standard, so only the common pieces are read —
 * stories, a wall material, a garage — and a code with any piece left over returns null,
 * leaving the raw code on show rather than a guess.
 */
const MATERIALS: Record<string, string> = { F: "wood frame", FR: "wood frame", B: "brick", AL: "aluminum siding", CB: "concrete block", V: "vinyl siding" };
const GARAGES: Record<string, string> = { G: "garage", AG: "attached garage", DG: "detached garage", BIG: "built-in garage", UG: "garage" };
// Stories, then a wall material (Camden writes "BH" for a brick house), then a garage with
// its cars before ("2AG") or after ("G2").
const BUILDING = /^(?:(\d(?:\.5)?)S?)?(AL|CB|FR|F|B|V)?H?(?:(\d)?(BIG|AG|DG|UG|G)(\d)?)?$/;
// Words some towns write out in full; "COMMON ELEMENTS" is a condominium's shared parts.
const WORDS: Record<string, string> = { "COMMON ELEMENT": "shared condo areas", "COMMON ELEMENTS": "shared condo areas", "HI RISE": "high-rise" };

export function describeBuilding(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase().trim();
  if (WORDS[upper]) return WORDS[upper];
  // A name written out ("TOWNHOUSE", "PARKING LOT") reads as itself.
  if (/^[A-Z]{5,}(?: [A-Z]+)*$/.test(upper)) return upper.charAt(0) + upper.slice(1).toLowerCase();
  const compact = upper
    // Toms River follows its code with a four-digit figure the state does not define.
    .replace(/\s{2,}\d{3,4}$/, "")
    .replace(/(\d)\s*1\/2/g, "$1.5")
    .replace(/(?<!\d)\.|\.(?!\d)/g, "")
    .replace(/[\s-]+/g, "");
  const match = BUILDING.exec(compact);
  if (!compact || !match || match.slice(1).every((part) => part === undefined)) return null;
  const [, stories, material, before, garage, after] = match;
  const cars = before ?? after;
  // A bare number with nothing after it could be anything; a story count needs company.
  if (stories && !material && !garage && !/S/.test(compact)) return null;
  if (before && after) return null;
  const parts = [
    stories ? `${stories.replace(".5", "½")}-story` : null,
    material ? MATERIALS[material] : null,
    garage ? `${cars ? `${cars}-car ` : ""}${GARAGES[garage]}` : null,
  ].filter(Boolean);
  return parts.join(", ");
}


/**
 * An assessor's capitals in ordinary case (2026-10-15): "246 WITHERSPOON ST" becomes
 * "246 Witherspoon St". Compass points stay as written ("NE"), and ordinals stay lower
 * ("2nd").
 */
const KEEP_UPPER = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "US", "NJ", "II", "III", "IV"]);
export function addressCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[a-z0-9]+/g, (word) => {
      if (KEEP_UPPER.has(word.toUpperCase())) return word.toUpperCase();
      if (/^\d/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
}

/** Where and by when an assessment is appealed: the state's rule, by county. */
const JANUARY_COUNTIES = new Set(["Burlington", "Gloucester", "Monmouth"]);
export function appealDeadline(county: string | null | undefined): { date: string; note: string } {
  return county && JANUARY_COUNTIES.has(county)
    ? { date: "January 15", note: `${county} County runs on the state’s alternative assessment calendar` }
    : { date: "April 1", note: "or May 1 in a year the town revalues or reassesses" };
}
