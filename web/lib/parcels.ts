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
  }));
}

function normal(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function addressMatches(tokens: string[], words: string[]): boolean {
  const last = words.length - 1;
  return words.every((word, i) =>
    i === last ? tokens.some((t) => t.startsWith(word)) : tokens.includes(word),
  );
}

// "12/3", "12, 3", "block 12 lot 3" or "12 lot 3": a block and a lot.
const BLOCK_LOT = /^\s*(?:block\s*)?([0-9a-z.]+)\s*(?:\/|,|\s+lot\s+)\s*([0-9a-z.]+)\s*$/i;

/**
 * Parcels matching a search. A block and lot, written as `BLOCK_LOT` allows, finds that
 * parcel and its qualifiers (condominium units share a block and lot); anything else is
 * an address: every word but the last present whole, and the last as the start of a
 * word, since a reader may still be typing it — "250 lorr" finds "250 LORRAINE DR", and
 * "100 washington" finds 100 Washington St but not 1008. At most `limit` results, in
 * file order, which is block and lot order.
 */
export function search(parcels: Parcel[], query: string, limit = 25): Parcel[] {
  const blockLot = BLOCK_LOT.exec(query);
  const words = normal(query).split(" ").filter(Boolean);
  if (!blockLot && words.length === 0) return [];
  const found: Parcel[] = [];
  for (const parcel of parcels) {
    const match = blockLot
      ? parcel.block.toUpperCase() === blockLot[1].toUpperCase() &&
        parcel.lot.toUpperCase() === blockLot[2].toUpperCase()
      : parcel.address !== null && addressMatches(normal(parcel.address).split(" "), words);
    if (match) {
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
