/**
 * The rent comparison by bedroom count (Milestone 35): every rent figure held for a place,
 * each labelled for what it measures, because they measure different things and a reader
 * comparing them needs to know which (ARCHITECTURE #286).
 *
 * - **What tenants pay**: the Census's gross rent by bedrooms, rent plus utilities, across
 *   everyone renting — long-standing tenancies included, so it runs below a new lease.
 * - **HUD's benchmark**: the Fair Market Rent, an administrative standard set near the
 *   40th percentile of recent movers' rents. ZIP by ZIP where HUD sets it that way, and
 *   the county's otherwise.
 * - **Listings**: Zillow's observed rent index, asking rents on new listings. Zillow
 *   publishes no split by bedrooms, so it is the same for every size and says so.
 * - **The reader's own rent**, if they give it.
 */

import type { PacketLevel } from "@/lib/api";
import { periodLabel } from "@/lib/periods";

export const BEDROOMS = [0, 1, 2, 3, 4] as const;
export type Bedrooms = (typeof BEDROOMS)[number];

export const BEDROOM_LABELS: Record<Bedrooms, string> = {
  0: "Studio",
  1: "1 bedroom",
  2: "2 bedrooms",
  3: "3 bedrooms",
  4: "4 bedrooms",
};

const CENSUS: Record<Bedrooms, string> = {
  0: "acs_median_rent_studio",
  1: "acs_median_rent_1br",
  2: "acs_median_rent_2br",
  3: "acs_median_rent_3br",
  4: "acs_median_rent_4br",
};

export type Kind = "occupants" | "benchmark" | "listings" | "reader";

export const KIND_LABELS: Record<Kind, string> = {
  occupants: "What tenants pay",
  benchmark: "Government benchmark",
  listings: "New listings",
  reader: "Your rent",
};

export type RentRow = {
  key: string;
  kind: Kind;
  label: string;
  /** Per month. */
  value: number;
  /** The Census's 90% margin, where the figure has one. */
  margin: number | null;
  asOf: string;
  note: string;
  metricId: string | null;
};

function find(levels: PacketLevel[], metricId: string): PacketLevel | undefined {
  return levels.find((level) => level.metric_id === metricId);
}

/**
 * The rows for one bedroom count, in a fixed order: tenants, benchmark, listings, the
 * reader. `levels` are the page's own; `countyLevels` its county's, where the page is a
 * town or ZIP and the county is where HUD's area figure lives. A row with no figure is
 * left out rather than shown empty.
 */
export function rentRows(
  bedrooms: Bedrooms,
  levels: PacketLevel[],
  countyLevels: PacketLevel[],
  margins: Map<string, number | null>,
  countyName: string | null,
  readerRent: number | null,
): RentRow[] {
  const rows: RentRow[] = [];
  const census = find(levels, CENSUS[bedrooms]);
  if (census) {
    rows.push({
      key: "census",
      kind: "occupants",
      label: "Census, rent plus utilities",
      value: census.value,
      margin: margins.get(census.metric_id) ?? null,
      asOf: periodLabel(census.period_end, census.metric_id),
      note: "Everyone renting here, long-standing tenancies included.",
      metricId: census.metric_id,
    });
  }
  const zip = find(levels, `hud_safmr_${bedrooms}br`);
  const county = find(levels, `hud_fmr_${bedrooms}br`) ?? find(countyLevels, `hud_fmr_${bedrooms}br`);
  const benchmark = zip ?? county;
  if (benchmark) {
    rows.push({
      key: "fmr",
      kind: "benchmark",
      label: zip ? "HUD Fair Market Rent for this ZIP code" : "HUD Fair Market Rent",
      value: benchmark.value,
      margin: null,
      asOf: periodLabel(benchmark.period_end, benchmark.metric_id),
      note: zip
        ? "Set ZIP by ZIP here, near the 40th percentile of recent movers’ rents."
        : `Set for ${countyName ? `${countyName}’s` : "the county’s"} HUD area, near the 40th percentile of recent movers’ rents.`,
      metricId: benchmark.metric_id,
    });
  }
  const listings = find(levels, "zori_all");
  if (listings) {
    rows.push({
      key: "zori",
      kind: "listings",
      label: "Zillow, typical asking rent",
      value: listings.value,
      margin: null,
      asOf: periodLabel(listings.period_end, listings.metric_id),
      note: "Every size together: Zillow publishes no split by bedrooms.",
      metricId: listings.metric_id,
    });
  }
  if (readerRent !== null) {
    rows.push({
      key: "reader",
      kind: "reader",
      label: "What you pay now",
      value: readerRent,
      margin: null,
      asOf: "",
      note: "Your figure, kept in this browser only.",
      metricId: null,
    });
  }
  return rows;
}

/** Whether the page has anything to compare: a figure for at least one size. */
export function hasRentEvidence(levels: PacketLevel[], countyLevels: PacketLevel[]): boolean {
  return BEDROOMS.some(
    (b) =>
      find(levels, CENSUS[b]) ||
      find(levels, `hud_safmr_${b}br`) ||
      find(levels, `hud_fmr_${b}br`) ||
      find(countyLevels, `hud_fmr_${b}br`),
  );
}
