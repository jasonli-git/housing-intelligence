/**
 * The compare page's rows and its address (TODO "A compare page shared by its link",
 * 2026-10-21). The choice of places lives in the address — `?places=194,330,112` — so a
 * comparison can be bookmarked or sent, and nothing is kept in the browser. Each place's
 * figures are its published packet, read in the browser as the buyer's guide reads them:
 * any set of places is combinatorial, so no comparison is published (ARCHITECTURE #330).
 */
import type { PacketLevel } from "@/lib/api";

export const MAX_PLACES = 4;

/** Region ids from `?places=`, in order, distinct, at most four; anything else dropped. */
export function parsePlaces(search: string): number[] {
  const raw = new URLSearchParams(search).get("places") ?? "";
  const ids: number[] = [];
  for (const part of raw.split(",")) {
    const id = Number(part.trim());
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
    if (ids.length === MAX_PLACES) break;
  }
  return ids;
}

/** The address for a set of places. */
export function placesQuery(ids: readonly number[]): string {
  return ids.length ? `?places=${ids.join(",")}` : "";
}

/** A row reads one published figure; `cost` rows are worked out on the page. */
export type CompareRow = { metric: string; label?: string } | { cost: "own" };

export const COMPARE_SECTIONS: ReadonlyArray<{ title: string; rows: CompareRow[] }> = [
  {
    title: "What it costs",
    rows: [
      { metric: "zhvi_sfr", label: "Typical home value" },
      { metric: "zhvi_bottom_tier", label: "Starter home value" },
      { metric: "zori_all", label: "Typical asking rent" },
      { cost: "own" },
      { metric: "modiv_median_tax_bill", label: "Typical property tax bill" },
      { metric: "nj_effective_tax_rate", label: "Effective tax rate" },
    ],
  },
  {
    title: "Can people here afford it?",
    rows: [
      { metric: "acs_median_hh_income", label: "Household income" },
      { metric: "price_to_income", label: "Home price to income" },
      { metric: "sale_price_to_income", label: "Sale price to income" },
      { metric: "acs_renter_cost_burden", label: "Renters under housing-cost pressure" },
    ],
  },
  {
    title: "How homes sell",
    rows: [
      { metric: "sr1a_median_sale_price", label: "Median sale price" },
      { metric: "sr1a_sales_count", label: "Sales" },
      { metric: "acs_homeownership_rate", label: "Homes owned by their occupants" },
    ],
  },
  {
    title: "People and getting around",
    rows: [
      { metric: "pep_population", label: "Population" },
      { metric: "acs_mean_commute_minutes", label: "Average commute" },
      { metric: "transit_any_homes_share", label: "Homes near transit" },
    ],
  },
  {
    title: "Risks",
    rows: [
      { metric: "fema_flood_homes_share", label: "Homes in a flood zone" },
      { metric: "water_homes_share_violation", label: "Homes on water with a health violation" },
    ],
  },
];

export function levelOf(levels: readonly PacketLevel[], metric: string): PacketLevel | null {
  return levels.find((level) => level.metric_id === metric) ?? null;
}
