import Link from "next/link";
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
      <header className="page-head nation-head" data-kind="state">
        <p className="entry-kicker">Housing, place by place</p>
        <h1>United States</h1>
        <p className="entry-introduction">A clearer picture of the place you could call home.</p>
        <p className="entry-context">Explore housing costs, local conditions and the figures behind them. Detailed state coverage starts with New Jersey.</p>
      </header>
      <section className="coverage-entry" aria-labelledby="coverage-heading">
        <header><p className="entry-kicker">Available now</p><h2 id="coverage-heading">Start with a state</h2><p>New Jersey is the only state with local housing profiles currently available.</p></header>
        <Link className="state-entry-link" href="/states/new-jersey">
          <span className="state-entry-monogram" aria-hidden="true">NJ</span>
          <span className="state-entry-copy"><span className="entry-kicker">State profile · available</span><strong>New Jersey</strong><span>Statewide context. County comparisons. Town and ZIP profiles.</span><span className="state-entry-action">Explore New Jersey <span aria-hidden="true">↗</span></span></span>
        </Link>
      </section>
      <section className="national-context" aria-labelledby="national-context-heading">
        <div><p className="entry-kicker">National context</p><h2 id="national-context-heading">The cost of borrowing</h2><p>A nationwide benchmark—not a mortgage quote or a New Jersey-specific rate.</p></div>
        {rate ? <div className="national-rate"><strong>{rate.value.toFixed(2)}%</strong><FloatingMetricTerm metricId={rate.metric_id} label="30-year fixed mortgage" /><small>Freddie Mac · {periodLabel(rate.period_start, rate.metric_id)}</small></div> : <p>Mortgage-rate data is unavailable in this snapshot.</p>}
      </section>
      <p className="entry-coverage-note">This is not yet a nationwide housing comparison. Other states will appear here when their data and profiles are available.</p>
    </main>
  </>;
}
