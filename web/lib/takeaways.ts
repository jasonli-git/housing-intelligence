import type { PacketLevel } from "@/lib/api";

/**
 * MOCK (2026-11-12): the briefing's takeaways as one shared module, so the briefing and
 * Compare say the same thing about a place (decision 7, under discussion). Everything here
 * reads a figure's published statewide rank; nothing is written by a model.
 *
 * A packet's `percentile` is the share of peer places this one does better than, so for a
 * "lower is better" figure it runs opposite to the figure's size. `sizePct` turns it back
 * into "how much of the thing": 100 is the most in the state, 0 the least.
 */
export const sizePct = (l: PacketLevel) => (l.direction === "lower_is_better" ? 100 - l.percentile! : l.percentile!);

/** Its place counting from the largest: "8th highest of 563". */
export const highest = (l: PacketLevel) => (l.direction === "lower_is_better" && l.rank != null && l.of != null ? l.of - l.rank + 1 : l.rank ?? 0);

export const ordinal = (n: number) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

export type Standing = { mark: "typical" | "high" | "low" | "very-high" | "very-low"; words: string; short: string };

/** Where a figure sits among the state's places, in words. */
export function standing(level: PacketLevel | null | undefined): Standing | null {
  if (!level || level.percentile == null) return null;
  const p = sizePct(level);
  const of = `${ordinal(highest(level))} highest of ${level.of}`;
  if (p >= 90) return { mark: "very-high", words: `Top tenth in NJ · ${of}`, short: "Top tenth in NJ" };
  if (p >= 70) return { mark: "high", words: `Above most of NJ · ${of}`, short: "Above most of NJ" };
  if (p <= 10) return { mark: "very-low", words: `Bottom tenth in NJ · ${of}`, short: "Bottom tenth in NJ" };
  if (p <= 30) return { mark: "low", words: `Below most of NJ · ${of}`, short: "Below most of NJ" };
  return { mark: "typical", words: `Typical for NJ · ${of}`, short: "Typical for NJ" };
}

/** "more than in 94% of NJ towns" / "less than in 70%": a percentile in words. */
export const share = (l: PacketLevel, more: string, less: string) => {
  const p = Math.round(sizePct(l));
  return p >= 50 ? `${more} in ${p}% of NJ towns` : `${less} in ${100 - p}% of NJ towns`;
};

/** The briefing's six takeaway topics. The first published id of each is the one read. */
export const TAKEAWAYS = [
  { key: "tax", ids: ["modiv_median_tax_bill"], topic: "taxes", label: "Property tax bill", more: "Higher", less: "Lower" },
  { key: "price", ids: ["sr1a_median_sale_price", "zhvi_sfr"], topic: "home prices", label: "Home price", more: "Higher", less: "Lower" },
  { key: "commute", ids: ["acs_mean_commute_minutes"], topic: "commutes", label: "Commute", more: "Longer", less: "Shorter" },
  { key: "flood", ids: ["fema_flood_homes_share"], topic: "flood risk", label: "Homes in a flood zone", more: "More", less: "Fewer" },
  { key: "built", ids: ["modiv_median_year_built", "acs_median_year_built"], topic: "the age of its homes", label: "Year homes were built", more: "Newer", less: "Older" },
  { key: "turnover", ids: ["sr1a_turnover_per_1000"], topic: "how often homes sell", label: "How often homes sell", more: "More often", less: "Less often" },
] as const;
export type Takeaway = (typeof TAKEAWAYS)[number];

export const takeawayLevel = (levels: readonly PacketLevel[], t: Takeaway) =>
  t.ids.map((id) => levels.find((l) => l.metric_id === id)).find((l) => l?.percentile != null) ?? null;

/** A place's takeaways: the topics where it sits furthest from the state's middle place. */
export function standsOut(levels: readonly PacketLevel[], count = 3) {
  return TAKEAWAYS.map((t) => ({ t, l: takeawayLevel(levels, t) }))
    .filter((x): x is { t: Takeaway; l: PacketLevel } => x.l != null)
    .sort((a, b) => Math.abs(sizePct(b.l) - 50) - Math.abs(sizePct(a.l) - 50))
    .slice(0, count);
}
