/**
 * The price a cost of owning is worked out from (Milestone 23), split from `costInputs`
 * in Milestone 49 so the browser-side decision guide can use it without bringing the
 * server-only API module into its bundle. The rule is described in `costInputs.ts`.
 */

import type { HomePrice } from "@/components/CostToOwn";
import type { PacketLevel } from "@/lib/api";
import { monthsBetween } from "@/lib/cost";
import { monthLabel, periodLabel } from "@/lib/periods";

/**
 * How stale a transaction median may be and still price a mortgage, in months.
 *
 * The window already ends at the newest deed the source holds, so this bounds how long
 * that may sit. Eighteen months is two publication cycles of the year-to-date file plus
 * slack: a figure that has missed two is not describing the market a reader is buying in,
 * and silence is better than a stale price presented as a current one.
 *
 * **Checked when the site is built, not while it is read.** A static export evaluates this
 * once per publish, so a card already on the CDN does not withdraw itself the day its
 * window turns 18 months old — only the next publish drops it. Scheduled refresh
 * (Milestone 29) is what makes the limit bite on a cadence.
 *
 * No equivalent guard sits on Zillow's index, which is a gap rather than a judgement that
 * it needs none: Zillow publishes monthly, but `hip acquire` never re-checks a `@current`
 * ref, so the warehouse can hold a month-old observation indefinitely (TODO.md). A limit
 * there would want that fixed first, or it would drop good regions for a fetching bug.
 */
export const MAX_SALE_AGE_MONTHS = 18;

/** Today, as `YYYY-MM-DD`. Split out so a test can pin the freshness limit. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The price the owning card is worked out from, and what may be said about it.
 *
 * Returns null when neither source can price a mortgage, which is what makes the page say
 * so rather than print a card it cannot stand behind.
 */
export function homePrice(levels: PacketLevel[], now: string = today()): HomePrice | null {
  const index = levels.find((l) => l.metric_id === "zhvi_sfr");
  if (index) {
    return { basis: "index", value: index.value, asOf: periodLabel(index.period_end, index.metric_id) };
  }
  const sold = levels.find((l) => l.metric_id === "sr1a_median_sale_price");
  if (!sold || monthsBetween(sold.period_end, now) > MAX_SALE_AGE_MONTHS) return null;
  return {
    basis: "transactions",
    value: sold.value,
    asOf: monthLabel(sold.period_end),
    from: monthLabel(sold.period_start),
    to: monthLabel(sold.period_end),
  };
}
