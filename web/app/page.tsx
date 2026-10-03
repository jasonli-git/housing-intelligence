import { NationalCoverageMap } from "@/components/NationalCoverageMap";
import { Masthead } from "@/components/Masthead";
import { nationalMortgageRate } from "@/lib/api";
import { periodLabel } from "@/lib/periods";
import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import "./housing-entry.css";

export default async function UnitedStatesPage() {
  const rate = await nationalMortgageRate();
  return <>
    <Masthead affordability={{ kind: "disabled", reason: "Choose a covered state first" }} budgetLabel="NJ budget" />
    <main className="shell nation-page">
      <header className="page-head nation-head" data-kind="nation">
        <p className="entry-kicker">Housing · a public data project</p>
        <h1>United States</h1>
        <p className="entry-introduction">A clearer picture of the place you could call home.</p>
        <p className="entry-context">Compare housing costs and local conditions, with sources for every figure.</p>
        <p className="entry-free"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>Free to use <span aria-hidden="true">·</span> <span>No fees. No subscription.</span></p>
      </header>
      <section className="coverage-entry coverage-entry-map" aria-labelledby="coverage-heading">
        <header><p className="entry-kicker">Explore by state</p><h2 id="coverage-heading">Find your place</h2></header>
        <NationalCoverageMap />
      </section>
      <section className="national-context" aria-labelledby="national-context-heading">
        <div><p className="entry-kicker">National context</p><h2 id="national-context-heading">The cost of borrowing</h2><p>A national benchmark, not a lender quote.</p></div>
        {rate ? <div className="national-rate"><strong>{rate.value.toFixed(2)}%</strong><FloatingMetricTerm metricId={rate.metric_id} label="30-year fixed mortgage" /><small>Freddie Mac · {periodLabel(rate.period_start, rate.metric_id)}</small></div> : <p>Mortgage-rate data is unavailable in this snapshot.</p>}
      </section>
    </main>
  </>;
}
