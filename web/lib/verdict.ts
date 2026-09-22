/**
 * The sentences at the top of a region page that answer before the tables report
 * (Milestone 17): where its homes stand and how fast they rose, whether paychecks kept
 * up, and what the housing is like.
 *
 * Computed from ranks and figures the packet already carries, with no model. The
 * interpretation people need most is the one least safe to generate: a verdict built
 * from a percentile cannot be wrong the way generated prose can, and a wrong verdict is
 * worse than an unhelpful table. Every sentence says which figure and which rank it
 * quotes, so a reader can find both in the tables below.
 */

import type { PacketLevel, PacketMetric } from "@/lib/api";
import { definitionOf } from "@/lib/definitions";
import { formatMetric } from "@/lib/format";
import { periodLabel, surveyYears } from "@/lib/periods";
import { ordinal, rankPosition } from "@/lib/ranks";

/**
 * The home values a verdict can stand on, in order of preference. Zillow's index is the
 * current market; the ACS's owner-reported value covers the 176 municipalities Zillow
 * does not, a survey older and self-reported, which the sentence says by naming it.
 * `cohort` qualifies the peers when the figure covers fewer than the whole level.
 */
const HOME_VALUES = [
  { metric_id: "zhvi_sfr", noun: "typical single-family home value", cohort: "Zillow covers" },
  { metric_id: "acs_median_home_value", noun: "median owner-reported home value", cohort: "with an ACS estimate" },
] as const;

export type Peers = {
  /** The region as a reader names it: "Mercer County". */
  name: string;
  /** How many regions of this level the state has, e.g. 21 counties. */
  count: number;
  /** "counties", "municipalities", "ZIP codes". */
  noun: string;
  /** "New Jersey". */
  scope: string;
};

type Ranked<T> = T & { rank: number; of: number };

function ranked<T extends { metric_id: string; rank: number | null; of: number | null }>(
  rows: T[],
  metricId: string,
): Ranked<T> | undefined {
  const row = rows.find((r) => r.metric_id === metricId);
  return row && row.rank !== null && row.of !== null ? (row as Ranked<T>) : undefined;
}

/** Where a value rank sits, as price: "the most expensive", "the 8th least expensive". */
export function standing(rank: number, of: number): string {
  if (rank === 1) return "the most expensive";
  if (rank >= of) return "the least expensive";
  return rank <= Math.ceil(of / 2)
    ? `the ${ordinal(rank)} most expensive`
    : `the ${ordinal(of - rank + 1)} least expensive`;
}

/** How a change rank compares, in fifths: "faster than most", "at about the typical pace". */
export function pace(rank: number, of: number): string {
  const p = rankPosition(rank, of);
  if (p <= 0.2) return "faster than almost all";
  if (p <= 0.4) return "faster than most";
  if (p < 0.6) return "at about the typical pace";
  if (p < 0.8) return "more slowly than most";
  return "more slowly than almost all";
}

/**
 * "Mercer County is the 8th least expensive of New Jersey's 21 counties, by typical
 * single-family home value ($450,985), but its value rose faster than most over five
 * years (+35.8%, 9th of 21 by change)."
 *
 * "But" where price and pace pull opposite ways — dear and slow, or cheap and quick —
 * because that contrast is the news; "and" otherwise. Null when the region has no ranked
 * home value at all.
 */
export function verdict(peers: Peers, metrics: PacketMetric[], levels: PacketLevel[]): string | null {
  for (const home of HOME_VALUES) {
    const level = ranked(levels, home.metric_id);
    if (!level) continue;

    const cohort =
      level.of === peers.count
        ? `${peers.scope}’s ${level.of} ${peers.noun}`
        : `the ${level.of} ${peers.scope} ${peers.noun} ${home.cohort}`;
    const value = formatMetric(level.value, level.unit, level.metric_id);
    let sentence = `${peers.name} is ${standing(level.rank, level.of)} of ${cohort}, by ${home.noun} (${value})`;

    const change = ranked(metrics, home.metric_id);
    if (change) {
      const pct = change.pct_change;
      const quoted = `${ordinal(change.rank)} of ${change.of} by change`;
      if (pct === 0) {
        sentence += `, and its value was unchanged over five years (${quoted})`;
      } else if (pct < 0) {
        sentence += `, and its value fell ${Math.abs(pct).toFixed(1)}% over five years (${quoted})`;
      } else {
        const p = rankPosition(change.rank, change.of);
        const dear = level.rank <= Math.ceil(level.of / 2);
        const contrast = (dear && p >= 0.6) || (!dear && p <= 0.4);
        sentence +=
          `, ${contrast ? "but" : "and"} its value rose ${pace(change.rank, change.of)} over ` +
          `five years (+${pct.toFixed(1)}%, ${quoted})`;
      }
    }
    return `${sentence}.`;
  }
  return null;
}

/** Whether a ratio's end moved from its start by more than two percent either way. */
function outpaced(metric: PacketMetric): "up" | "down" | "even" {
  const moved = metric.end_value / metric.start_value - 1;
  return moved > 0.02 ? "up" : moved < -0.02 ? "down" : "even";
}

function years(metric: PacketMetric): string {
  return `From ${periodLabel(metric.window_start, metric.metric_id)} to ${periodLabel(metric.window_end, metric.metric_id)}`;
}

/**
 * Whether paychecks kept up, read from the two ratios that already pair a year's prices
 * with the same year's incomes — so the comparison is like for like, where setting
 * Zillow's five-year change beside the ACS's would compare 2021–2026 with 2019–2023.
 * Null when the region has no price-to-income change.
 */
export function paychecks(metrics: PacketMetric[]): string | null {
  const price = metrics.find((m) => m.metric_id === "price_to_income");
  if (!price) return null;

  const fmt = (m: PacketMetric, v: number) => formatMetric(v, m.unit, m.metric_id);
  const priceVerdict = {
    up: "home values outpaced incomes",
    down: "incomes outpaced home values",
    even: "home values and incomes moved about in step",
  }[outpaced(price)];
  const sentences = [
    `${years(price)}, the typical home went from ${fmt(price, price.start_value)} to ` +
      `${fmt(price, price.end_value)} the typical household income here: ${priceVerdict}.`,
  ];

  const rent = metrics.find((m) => m.metric_id === "rent_to_income");
  if (rent) {
    const rentVerdict = {
      up: "rents outpaced incomes",
      down: "incomes outpaced rents",
      even: "rents and incomes moved about in step",
    }[outpaced(rent)];
    const when =
      rent.window_start === price.window_start && rent.window_end === price.window_end
        ? ""
        : ` (${years(rent).replace("From", "from")})`;
    sentences.push(
      `A year’s typical rent went from ${fmt(rent, rent.start_value)} to ` +
        `${fmt(rent, rent.end_value)} of income${when}: ${rentVerdict}.`,
    );
  }
  return sentences.join(" ");
}

export type PaycheckAnswer = "Yes" | "No" | "About even";

const ANSWER: Record<"up" | "down" | "even", PaycheckAnswer> = { up: "No", down: "Yes", even: "About even" };

/**
 * "Did paychecks keep up?" answered short, homes and rent apart (Milestone 23), by
 * `paychecks`' own rule: a price-to-income ratio up more than 2% is No, down more than 2%
 * is Yes, and otherwise about even. Rent is null where the region has no rent-to-income
 * change; the whole is null without price-to-income, as `paychecks` is.
 */
export function paycheckAnswers(
  metrics: PacketMetric[],
): { homes: PaycheckAnswer; rent: PaycheckAnswer | null } | null {
  const price = metrics.find((m) => m.metric_id === "price_to_income");
  if (!price) return null;
  const rent = metrics.find((m) => m.metric_id === "rent_to_income");
  return { homes: ANSWER[outpaced(price)], rent: rent ? ANSWER[outpaced(rent)] : null };
}

export type ProfileItem = {
  metric_id: string;
  label: string;
  value: string;
  definition: string;
  /** Plain-language context plus an optional typed rank; never parsed back out of prose. */
  context: {
    words: string;
    rank: { value: number; of: number } | null;
  } | null;
};

/**
 * Where a value sits among the region's peers, in its measure's own words: "older than
 * most · 13th of 21". The two fifths either side of the middle take `pace`'s "most"; the
 * fifth between is near the middle. Rank 1 is the largest value except where lower is
 * better (`lib/ranks.ts`), so the position is read from the largest end either way.
 */
function among(row: PacketLevel, more: string, fewer: string): ProfileItem["context"] {
  if (row.rank === null || row.of === null) return null;
  const p = rankPosition(row.rank, row.of);
  const fromLargest = row.direction === "lower_is_better" ? 1 - p : p;
  const words = fromLargest <= 0.4 ? more : fromLargest >= 0.6 ? fewer : "near the middle";
  return { words, rank: { value: row.rank, of: row.of } };
}

function moved(pct: number): string {
  if (pct === 0) return "unchanged";
  return `${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}%`;
}

/**
 * What the housing here is like, as the cards under the costs show it: how old its homes
 * are, on what lots, how many are owned, apartments or standing empty, whether anything is
 * being built, and how many people live here — from whichever of these the region has.
 * Each carries a definition shown on hover, focus or tap, because a short label cannot say
 * what was counted, and a line placing it among its peers from the rank the packet already
 * carries (Milestone 23, which added the vacancy rate and the population).
 *
 * "Apartment buildings", not the metric's "apartment share of residential parcels": a
 * parcel is tax-roll vocabulary, and what it counts here is buildings. The metric keeps
 * its label, because renaming it would change every packet and stale every explanation.
 */
export function housingProfile(levels: PacketLevel[], metrics: PacketMetric[] = []): ProfileItem[] {
  const find = (id: string) => levels.find((l) => l.metric_id === id);
  const items: ProfileItem[] = [];

  const built = find("modiv_median_year_built");
  if (built) {
    items.push({
      metric_id: built.metric_id,
      label: "Typical home built",
      value: String(Math.round(built.value)),
      definition:
        "The median year one- to four-family homes here were built, among those New " +
        "Jersey’s property tax records (MOD-IV) give a year for.",
      context: among(built, "newer than most", "older than most"),
    });
  }
  const lot = find("modiv_median_lot_acres");
  if (lot) {
    items.push({
      metric_id: lot.metric_id,
      label: "Median lot",
      value: `${lot.value.toFixed(2)} acres`,
      definition:
        "The median lot size of one- to four-family homes here, from the property tax " +
        "records (MOD-IV). An acre is 43,560 square feet.",
      context: among(lot, "larger than most", "smaller than most"),
    });
  }
  const owned = find("acs_homeownership_rate");
  if (owned) {
    items.push({
      metric_id: owned.metric_id,
      label: "Households that own",
      value: formatMetric(owned.value, owned.unit, owned.metric_id),
      definition:
        "The share of occupied homes lived in by their owners rather than rented out, from " +
        "the Census Bureau’s American Community Survey five-year estimate.",
      context: among(owned, "more than most", "fewer than most"),
    });
  }
  const apartments = find("modiv_multifamily_share");
  if (apartments) {
    items.push({
      metric_id: apartments.metric_id,
      label: "Apartment buildings",
      value: formatMetric(apartments.value, apartments.unit, apartments.metric_id),
      definition:
        "Apartment buildings as a share of the residential properties on the tax roll — " +
        "one- to four-family homes and apartment buildings. It counts buildings, not " +
        "homes: a 200-unit building counts once.",
      context: among(apartments, "more than most", "fewer than most"),
    });
  }
  const empty = find("acs_vacancy_rate");
  if (empty) {
    items.push({
      metric_id: empty.metric_id,
      label: "Homes standing empty",
      value: formatMetric(empty.value, empty.unit, empty.metric_id),
      definition:
        definitionOf(empty.metric_id)?.what ??
        "The share of all homes standing empty, from the Census Bureau’s American Community Survey.",
      context: among(empty, "more than most", "fewer than most"),
    });
  }
  const permits = find("permits_total_units");
  if (permits) {
    items.push({
      metric_id: permits.metric_id,
      label: `Homes permitted in ${periodLabel(permits.period_end, permits.metric_id)}`,
      value: formatMetric(permits.value, permits.unit, permits.metric_id),
      definition:
        "New homes authorized by building permits that year, counted in units, from the " +
        "Census Bureau’s Building Permits Survey. A permit is approval to build, not a " +
        "finished home.",
      context: among(permits, "more than most", "fewer than most"),
    });
  }
  const people = find("acs_population");
  if (people) {
    const change = metrics.find((m) => m.metric_id === "acs_population");
    items.push({
      metric_id: people.metric_id,
      label: "People",
      value: formatMetric(people.value, people.unit, people.metric_id),
      definition:
        "The Census Bureau’s American Community Survey five-year estimate for the survey " +
        `years ${surveyYears(people.period_start, people.period_end)}.`,
      context: change
        ? {
            words:
              `${moved(change.pct_change)}, ${periodLabel(change.window_start, change.metric_id)} to ` +
              `${periodLabel(change.window_end, change.metric_id)}`,
            rank: null,
          }
        : among(people, "more than most", "fewer than most"),
    });
  }

  return items;
}

/**
 * The ledger's note on what its ranks rank, shown on the region's own home value where
 * it has both: "Mercer County's typical single-family home value is 9th of 21 by its
 * five-year rise and 14th of 21 by value." The example is the point — the two ranks of
 * one figure, side by side, are what stops a change rank being read as a price rank.
 */
export function rankBasisExample(name: string, metrics: PacketMetric[], levels: PacketLevel[]): string | null {
  for (const home of HOME_VALUES) {
    const change = ranked(metrics, home.metric_id);
    const level = ranked(levels, home.metric_id);
    if (change && level) {
      return (
        `${name}’s ${home.noun} is ${ordinal(change.rank)} of ${change.of} by its five-year ` +
        `rise and ${ordinal(level.rank)} of ${level.of} by value.`
      );
    }
  }
  return null;
}

/**
 * The trade a home's price comes with, named when the figures show one: homes cheaper
 * than most with a tax bill in the highest third, or dearer than most with one in the
 * lowest third. Silent otherwise, because a tradeoff printed on every page whether or not
 * there is one is noise.
 *
 * Net migration was the ROADMAP's other candidate and is left out: IRS counts tax
 * returns at county level only, and more households leaving than arriving is not a cost
 * to the buyer, so pairing it with a price would be a reading the figure does not
 * support (ARCHITECTURE #142).
 */
export function tradeoff(peers: Peers, levels: PacketLevel[]): string | null {
  const home = HOME_VALUES.map((h) => ranked(levels, h.metric_id)).find((row) => row !== undefined);
  const tax = ranked(levels, "modiv_median_tax_bill");
  if (!home || !tax) return null;

  const price = rankPosition(home.rank, home.of);
  const taxAt = rankPosition(tax.rank, tax.of);
  const bill = formatMetric(tax.value, tax.unit, tax.metric_id);
  if (price > 0.5 && taxAt <= 1 / 3) {
    const nth = tax.rank === 1 ? "the highest" : `the ${ordinal(tax.rank)} highest`;
    return (
      `Homes here cost less than in most ${peers.noun}, but the typical property tax ` +
      `bill, ${bill} a year, is ${nth} of ${tax.of}.`
    );
  }
  if (price < 0.5 && taxAt >= 2 / 3) {
    const low = tax.of - tax.rank + 1;
    const nth = low === 1 ? "the lowest" : `the ${ordinal(low)} lowest`;
    return (
      `Homes here cost more than in most ${peers.noun}, but the typical property tax ` +
      `bill, ${bill} a year, is ${nth} of ${tax.of}.`
    );
  }
  return null;
}
