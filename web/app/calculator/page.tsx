import type { Metadata } from "next";
import { CostCalculator } from "@/components/CostCalculator";
import { Masthead } from "@/components/Masthead";
import { api, artifactUrl, nationalMortgageRate } from "@/lib/api";
import { periodLabel } from "@/lib/periods";
import { pageMetadata } from "@/lib/meta";
import "../tool-pages.css";
import "../horizon-theme.css";
import "./calculator.css";

export const metadata: Metadata = pageMetadata({ title: "Cost calculator — Housing", description: "What a New Jersey place would cost you: the month against your budget, the cash up front, and renting against buying.", path: "/calculator" });

/** MOCK (2026-11-11): the Cost calculator (#499). */
export default async function CalculatorPage() {
  const [rate, catalog] = await Promise.all([nationalMortgageRate(), api.metrics()]);
  const newest = Object.fromEntries((catalog ?? []).map((m) => [m.metric_id, m.last_period]));
  return <>
    <Masthead affordability={{ kind: "route" }} calculatorActive />
    <main id="main-content" tabIndex={-1} className="shell horizon-page cc-page" data-kind="budget">
      <header className="tool-head"><h1>Cost calculator</h1></header>
      <p className="meta cc-intro">What one place would cost you, with your own numbers.</p>
      {rate ? <CostCalculator artifactUrl={process.env.GUIDE_PREVIEW_ARTIFACT_URL ?? artifactUrl} rate={{ value: rate.value, asOf: periodLabel(rate.period_start, rate.metric_id) }} newest={newest} /> : <p>The mortgage rate is unavailable in this build.</p>}
    </main>
  </>;
}
