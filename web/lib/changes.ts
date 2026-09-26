/**
 * The "what changed" page's wording (Milestone 27, `GET /revisions`).
 *
 * The API has already summarised: a refresh's revisions arrive per metric, with counts
 * and the three places that moved most. What is left here is saying it plainly — one
 * sentence per metric, and each example as "was → now". Every change is relative to the
 * earlier value, the one rule that means the same thing for a price, a rent and a rate.
 */

import type { RevisedPlace, RevisionGroup } from "@/lib/api";
import { formatChange, formatMetric } from "@/lib/format";
import { displayName } from "@/lib/names";
import { periodLabel } from "@/lib/periods";

const count = (n: number) => n.toLocaleString("en-US");

/** "Margate City, Atlantic County", "ZIP 08402", "Hudson County". */
export function placeName(place: RevisedPlace): string {
  const name = place.level ? displayName({ name: place.name, level: place.level }) : place.name;
  return place.county ? `${name}, ${place.county} County` : name;
}

/** The revised periods, as the site labels them elsewhere: "Jan 2000 – Jul 2026", "2019". */
export function periodSpan(group: RevisionGroup): string {
  const first = periodLabel(group.earliest_period, group.metric_id);
  const last = periodLabel(group.latest_period, group.metric_id);
  return first === last ? first : `${first} – ${last}`;
}

const NOUNS: Record<string, [string, string]> = {
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
  quarterly: ["quarter", "quarters"],
  annual: ["year", "years"],
};

/** "and 29 other months", for a place whose several periods moved; "" for one. */
export function otherPeriods(place: RevisedPlace, frequency: string | null): string {
  const others = place.periods - 1;
  if (others < 1) return "";
  const [one, many] = NOUNS[frequency ?? ""] ?? ["period", "periods"];
  return `and ${count(others)} other ${others === 1 ? one : many}`;
}

/** A relative change as a reader says it: "1.1%", or "less than 0.1%". */
export function sizeLabel(fraction: number): string {
  const pct = Math.abs(fraction) * 100;
  return pct < 0.1 ? "less than 0.1%" : `${pct.toFixed(1)}%`;
}

function direction(group: RevisionGroup): string {
  const { figures, rose, fell } = group;
  if (figures === 1) return rose ? "revised up" : fell ? "revised down" : "revised";
  if (rose && fell) {
    return fell >= rose
      ? `${count(fell)} revised down and ${count(rose)} up`
      : `${count(rose)} revised up and ${count(fell)} down`;
  }
  if (fell) return fell === figures ? "all revised down" : `${count(fell)} revised down`;
  if (rose) return rose === figures ? "all revised up" : `${count(rose)} revised up`;
  return "revised";
}

/**
 * One sentence for a metric's revisions in a refresh: "294,469 figures across 955 places,
 * Jan 2000 – Jul 2026: 271,525 revised down and 22,944 up, typically by 1.1%."
 */
export function summaryLine(group: RevisionGroup): string {
  const figures = group.figures === 1 ? "1 figure" : `${count(group.figures)} figures`;
  const places = group.places === 1 ? "1 place" : `${count(group.places)} places`;
  const typical =
    group.figures > 1 && group.median_change !== null
      ? `, typically by ${sizeLabel(group.median_change)}`
      : "";
  return `${figures} across ${places}, ${periodSpan(group)}: ${direction(group)}${typical}.`;
}

/**
 * A revised value as the site shows it, except rates, which get two decimals: a monthly
 * mortgage-rate average moves by hundredths as each week's reading arrives, and
 * "6.8% → 6.9%" would overstate a move from 6.81 to 6.86.
 */
export function revisedValue(value: number | null, group: RevisionGroup): string {
  if (value === null) return "—";
  if (group.unit === "percent") return `${value.toFixed(2)}%`;
  return formatMetric(value, group.unit, group.metric_id);
}

/** The change relative to the earlier value: "+6.5%", "-46.0%"; "—" where there is none. */
export function changeLabel(place: RevisedPlace): string {
  return place.change === null ? "—" : formatChange(place.change * 100);
}
