/**
 * The cost cards' inputs, read from a packet (Milestone 23): shared by the region page and
 * its report, which print the same cards.
 *
 * The cost to own needs a current market value, so it stands on Zillow's index only: the
 * ACS's owner-reported value is a survey five years old, and a monthly payment on it would
 * describe a market that has moved on. Null without that value or without a rate.
 *
 * The past gain is Zillow's own five-year change, spread over its months, beside the rate
 * buyers faced when it began — so a reader sets the past against today's borrowing, and
 * takes neither for a forecast.
 */

import type { CostProps } from "@/components/CostToOwn";
import { nationalMortgageRate, nationalMortgageRateIn, type PacketLevel, type PacketMetric } from "@/lib/api";
import { changePerMonth, monthsBetween } from "@/lib/cost";
import { periodLabel } from "@/lib/periods";

/** Why a region has no tax bill, in a reader's terms. */
function noTaxReason(level: string): string {
  return level === "zip"
    ? "Property tax is not included: New Jersey’s assessment records give it by " +
        "municipality and county, not by ZIP code."
    : "Property tax is not included: this municipality’s assessment records could not " +
        "be matched to it by name.";
}

export async function costInputs(
  level: string,
  levels: PacketLevel[],
  metrics: PacketMetric[],
): Promise<CostProps | null> {
  const find = (id: string) => levels.find((l) => l.metric_id === id);
  const dated = (row: PacketLevel | undefined) =>
    row ? { value: row.value, asOf: periodLabel(row.period_end, row.metric_id) } : null;

  const home = dated(find("zhvi_sfr"));
  const latest = await nationalMortgageRate();
  if (!home || !latest) return null;

  const rise = metrics.find((m) => m.metric_id === "zhvi_sfr");
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
