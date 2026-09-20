/**
 * The cost cards' inputs, read from a packet (Milestone 23): shared by the region page and
 * its report, which print the same cards.
 *
 * The cost to own needs a price a mortgage can be worked out from, and there are two, in
 * order.
 *
 * **Zillow's index first.** It models what a typical home *is worth* now, which is the
 * question a buyer's budget asks.
 *
 * **The transaction median second**, where Zillow publishes nothing — the owner's decision
 * of 2026-09-20. It is a median of what *sold*, not of what exists, and the two are not
 * interchangeable: the homes that change hands are newer and larger than the housing stock
 * around them. So the card stops describing "the typical home" and describes a purchase at
 * a stated price instead, names the window the sales come from, and drops the figures that
 * only Zillow can support. Measured 2026-09-20: 176 of New Jersey's 564 municipalities have
 * no Zillow figure and had no cost card at all, 163 of them while carrying a median of
 * deeds signed within the last year. Thirteen still have neither and still say so.
 *
 * The ACS's owner-reported value is still not a candidate: a survey five years old would
 * price a mortgage on a market that has moved on.
 *
 * The past gain is Zillow's own five-year change, spread over its months, beside the rate
 * buyers faced when it began — so a reader sets the past against today's borrowing, and
 * takes neither for a forecast. It has no transaction equivalent and is simply absent on
 * the fallback.
 */

import type { CostProps, HomePrice } from "@/components/CostToOwn";
import { nationalMortgageRate, nationalMortgageRateIn, type PacketLevel, type PacketMetric } from "@/lib/api";
import { changePerMonth, monthsBetween } from "@/lib/cost";
import { monthLabel, periodLabel } from "@/lib/periods";

/**
 * How stale a transaction median may be and still price a mortgage, in months.
 *
 * The window already ends at the newest deed the source holds, so this bounds how long
 * that may sit. Eighteen months is two publication cycles of the year-to-date file plus
 * slack: a figure that has missed two is not describing the market a reader is buying in,
 * and silence is better than a stale price presented as a current one. Zillow's index is
 * monthly and needs no such guard.
 */
export const MAX_SALE_AGE_MONTHS = 18;

/** Why a region has no tax bill, in a reader's terms. */
function noTaxReason(level: string): string {
  return level === "zip"
    ? "Property tax is not included: New Jersey’s assessment records give it by " +
        "municipality and county, not by ZIP code."
    : "Property tax is not included: no assessment records resolve to this place.";
}

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

export async function costInputs(
  level: string,
  levels: PacketLevel[],
  metrics: PacketMetric[],
): Promise<CostProps | null> {
  const find = (id: string) => levels.find((l) => l.metric_id === id);
  const dated = (row: PacketLevel | undefined) =>
    row ? { value: row.value, asOf: periodLabel(row.period_end, row.metric_id) } : null;

  const home = homePrice(levels);
  const latest = await nationalMortgageRate();
  if (!home || !latest) return null;

  // Both of these are Zillow's own change, so both are absent on the fallback rather
  // than approximated from a different source.
  const rise = home.basis === "index" ? metrics.find((m) => m.metric_id === "zhvi_sfr") : undefined;
  const then = rise ? await nationalMortgageRateIn(rise.window_start.slice(0, 7)) : null;
  const tax = dated(find("modiv_median_tax_bill"));

  return {
    home,
    rate: { value: latest.value, asOf: periodLabel(latest.period_start) },
    tax,
    rent: dated(find("zori_all")),
    noTax: tax ? null : noTaxReason(level),
    gain: rise
      ? {
          perMonth: changePerMonth(rise.start_value, rise.end_value, monthsBetween(rise.window_start, rise.window_end)),
          from: periodLabel(rise.window_start, rise.metric_id),
          to: periodLabel(rise.window_end, rise.metric_id),
        }
      : null,
    rateThen: then ? { value: then.value, asOf: periodLabel(then.period_start) } : null,
  };
}
