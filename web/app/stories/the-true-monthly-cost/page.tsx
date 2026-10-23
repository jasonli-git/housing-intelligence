import type { Metadata } from "next";

import { MonthlyCostList } from "@/components/MonthlyCostList";
import { StoryShell } from "@/components/StoryShell";
import { nationalMortgageRate } from "@/lib/api";
import { monthlyPayment } from "@/lib/cost";
import { pageMetadata } from "@/lib/meta";
import { storyTowns } from "@/lib/storyData";
import { monthlyCost, PRICE } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The true monthly cost — Housing",
  description: "A typical home's month in every New Jersey town: mortgage, property tax, insurance, electricity, gas and water.",
  path: "/stories/the-true-monthly-cost",
});

export default async function TrueMonthlyCostPage() {
  const [towns, rate] = await Promise.all([
    storyTowns([PRICE, "modiv_median_tax_bill", "acs_median_home_insurance", "acs_median_electricity", "acs_median_gas", "acs_median_water_sewer"]),
    nationalMortgageRate(),
  ]);
  const ratePct = rate?.value ?? 6.5;
  const rows = towns.flatMap((t) => {
    const cost = monthlyCost(t.values, ratePct, monthlyPayment);
    return cost ? [{ id: t.id, name: t.name, county: t.countyName, cost }] : [];
  });
  const counties = [...new Set(rows.map((r) => r.county))].sort();
  return (
    <StoryShell
      title="The true monthly cost"
      lede="A mortgage is only part of a month in a home. Here every town's typical month is stacked: the loan, then property tax, insurance, and the electricity, gas and water bills. Ordered first by how much of the month is not the loan, which is where a low price can hide a high cost."
      note={<>Mortgage: principal and interest on Zillow&rsquo;s typical home value with 20% down, at the national 30-year rate of {ratePct.toFixed(2)}%{rate ? ` (${rate.period_start})` : ""}. Property tax: the typical residential bill from the state&rsquo;s tax list. Insurance, electricity, gas, water and sewer: the Census Bureau&rsquo;s median bills for homes billed for each, so a town where most homes heat with oil shows little gas. Left out: mortgage insurance, upkeep, and heating oil. {rows.length} towns have the home value and tax bill the month rests on.</>}
    >
      <MonthlyCostList rows={rows} counties={counties} />
    </StoryShell>
  );
}
