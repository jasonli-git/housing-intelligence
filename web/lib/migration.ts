/**
 * Who is moving here (Milestone 50, ARCHITECTURE #332-#333): the county's moves in, out
 * and staying, from the IRS's tax-return addresses, and what the movers reported earning.
 *
 * What the section owes a reader: a return is a tax return, not a household, and people
 * who file nothing are missing; an income is a mean per return, never a median; the IRS
 * publishes counties only, so a town reads its county's and says so; and newcomers
 * out-earning residents is a description of who moved, never shown as the cause of a
 * price change.
 */

import type { Migration, MigrationYear } from "@/lib/api";

const usd = (value: number) => `$${(Math.round(value / 1000) * 1000).toLocaleString("en-US")}`;
const count = (value: number) => Math.round(value).toLocaleString("en-US");

/** The county's newest year with moves both ways. */
export function latestYear(m: Migration): MigrationYear | null {
  return [...m.years].reverse().find((y) => y.inflow_returns !== null && y.outflow_returns !== null) ?? null;
}

/** "In 2023, 29,898 households moved into Hudson County and 31,040 moved out: …" */
export function movesSentence(y: MigrationYear, county: string): string | null {
  if (y.inflow_returns === null || y.outflow_returns === null) return null;
  const net = y.inflow_returns - y.outflow_returns;
  const rate = y.net_per_1000 !== null ? `, or ${Math.abs(y.net_per_1000).toFixed(1)} for every 1,000 households there` : "";
  const balance =
    net === 0 ? "as many as arrived" : `a net ${net > 0 ? "gain" : "loss"} of ${count(Math.abs(net))}${rate}`;
  return `In ${y.year}, ${count(y.inflow_returns)} households moved into ${county} and ${count(y.outflow_returns)} moved out: ${balance}.`;
}

/** Arrivals' income set against stayers' and leavers'. */
export function incomeSentence(y: MigrationYear): string | null {
  if (y.inflow_income === null || y.stayer_income === null) return null;
  const ratio = y.inflow_income / y.stayer_income;
  const gap = Math.round(Math.abs(ratio - 1) * 100);
  const compared =
    gap === 0
      ? `about the same as households who stayed (${usd(y.stayer_income)})`
      : `${gap}% ${ratio > 1 ? "more" : "less"} than households who stayed (${usd(y.stayer_income)})`;
  const leavers = y.outflow_income !== null ? `; those who left reported ${usd(y.outflow_income)}` : "";
  return `Households moving in reported an average income of ${usd(y.inflow_income)}, ${compared}${leavers}.`;
}

/** Whose figures these are, for a page that is not the county's own. */
export function whose(m: Migration, name: string): string | null {
  if (m.via === "self") return null;
  return m.via === "parent"
    ? `These are ${m.county_name} County’s figures: the IRS publishes moves by county only, not for ${name}.`
    : `These are ${m.county_name} County’s figures, the county holding most of ${name}’s addresses: the IRS publishes moves by county only.`;
}

export { count as formatReturns, usd as formatIncome };
