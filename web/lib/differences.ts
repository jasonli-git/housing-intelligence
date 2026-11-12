import type { PacketLevel } from "@/lib/api";
import { sizePct } from "@/lib/takeaways";

/**
 * MOCK (2026-11-12): the biggest differences between compared places, by statewide rank.
 *
 * Raw gaps cannot be set against each other ($80k of price against six minutes of commute),
 * so each figure is placed on the same 0–100 scale: where it sits among the state's places.
 * The gap is the distance between the furthest-apart places on that scale.
 *
 * Survey figures carry a margin of error, and the packets publish the rank range it allows
 * (`rank_best`–`rank_worst`). Two places whose ranges overlap may be the same, so a gap
 * between them is never called a difference, however large the point estimates make it.
 */

export type Spot = { id: number; level: PacketLevel; size: number };
export type Difference = {
  metric: string;
  spots: Spot[];
  /** Points apart on the 0–100 statewide scale, between the two furthest places. */
  gap: number;
  /** False when the margins of error allow the two furthest places to rank the same. */
  clear: boolean;
  /** For a cost figure, the place where it costs least. */
  easier: number | null;
};

/**
 * What a place costs: the only figures where "easier" is marked (the lowest is easier), and
 * the ones the differences lead with. A figure's published direction is not used here: it
 * would call a richer town "easier" and say nothing of a lower tax bill.
 */
export const COST_METRICS = new Set(["sr1a_median_sale_price", "zhvi_sfr", "zhvi_bottom_tier", "modiv_median_tax_bill", "nj_effective_tax_rate", "zori_all", "acs_median_gross_rent", "acs_renter_cost_burden"]);
export const isCost = (metric: string) => COST_METRICS.has(metric);

/** The smallest gap, in statewide points, worth calling out. */
export const NOTABLE_GAP = 15;

/** At most this many lead the page, so the section is one size whichever places are compared. */
export const TOP_DIFFERENCES = 5;

const range = (l: PacketLevel): [number, number] => [l.rank_best ?? l.rank ?? 0, l.rank_worst ?? l.rank ?? 0];

export function difference(metric: string, places: { id: number; level: PacketLevel | null }[]): Difference | null {
  const spots = places
    .filter((p): p is { id: number; level: PacketLevel } => p.level?.percentile != null)
    .map((p) => ({ id: p.id, level: p.level, size: sizePct(p.level) }));
  if (spots.length < 2) return null;
  const sorted = [...spots].sort((a, b) => a.size - b.size);
  const low = sorted[0], high = sorted[sorted.length - 1];
  const [aBest, aWorst] = range(low.level), [bBest, bWorst] = range(high.level);
  const clear = aBest > bWorst || bBest > aWorst;
  const easier = isCost(metric) ? low.id : null;
  return { metric, spots, gap: high.size - low.size, clear, easier };
}

/** The top clear, notable differences, costs first and then biggest first; and the rows the margins leave unsettled. */
export function biggest(rows: (Difference | null)[]) {
  const found = rows.filter((d): d is Difference => d != null);
  return {
    notable: found.filter((d) => d.clear && d.gap >= NOTABLE_GAP).sort((a, b) => Number(isCost(b.metric)) - Number(isCost(a.metric)) || b.gap - a.gap).slice(0, TOP_DIFFERENCES),
    unsettled: found.filter((d) => !d.clear && d.gap >= NOTABLE_GAP),
  };
}
