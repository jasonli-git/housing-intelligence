import type { Metadata } from "next";
import { NationalCoverageMap } from "@/components/NationalCoverageMap";
import { Masthead } from "@/components/Masthead";
import { nationalMortgageRate } from "@/lib/api";
import { periodLabel } from "@/lib/periods";
import { pageMetadata } from "@/lib/meta";
import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import { PlaceSearch } from "@/components/PlaceSearch";
import "./housing-entry.css";
import "./state-navigation.css";

export const metadata: Metadata = pageMetadata({
  title: "Housing Intelligence — Find your place",
  description: "A clearer picture of the place you could call home. Free housing data with sources for every figure; detailed coverage starts with New Jersey.",
  path: "/",
});

export default async function HousingLandingPage() {
  const rate = await nationalMortgageRate();
  return <>
    <Masthead affordability={{ kind: "disabled", reason: "Choose a covered state first" }} budgetLabel="Find within my budget" search={false} />
    <main id="main-content" tabIndex={-1} className="shell nation-page quiet-nation">
      <header className="page-head nation-head" data-kind="nation">
        <svg className="nation-portrait" viewBox="0 0 360 300" fill="none" aria-hidden="true">
          <circle className="portrait-halo" cx="185" cy="157" r="123" />
          <path className="portrait-foundation" pathLength="1" d="M20 254H340" />
          <path className="portrait-house" pathLength="1" d="M47 254V125L136 60L225 125V254M33 135L136 60L239 135M104 82V37H119V72M225 254V166L283 124L332 160V254M213 175L283 124L344 168" />
          <path className="portrait-windows" pathLength="1" d="M112 254V183H151V254M70 145H96V174H70ZM176 145H202V174H176ZM250 189H275V217H250ZM298 189H320V217H298Z" />
          <path className="portrait-guides" d="M47 276H225M47 270V282M225 270V282M20 254V125M14 125H26M14 254H26" strokeDasharray="3 5" />
        </svg>
        <p className="entry-kicker">A public data project</p>
        <h1>Housing Intelligence</h1>
        <p className="entry-introduction">A clearer picture of the place you could call home.</p>
        <section className="home-find" aria-labelledby="home-find-heading">
          <h2 id="home-find-heading">Find your town</h2>
          <PlaceSearch variant="hero" />
          <p className="home-find-hint">Any state, county, town or ZIP code the site covers. Detailed coverage starts with New Jersey: try NJ, Princeton or 07030. <a href="#coverage-heading">Or browse the map ↓</a></p>
        </section>
        <p className="entry-free computed"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg><span>Free to use · No fees. No subscription. Definitely no ads.</span></p>
      </header>
      <section className="coverage-entry coverage-entry-map" aria-labelledby="coverage-heading">
        <header><p className="entry-kicker">United States · Explore by state</p><h2 id="coverage-heading">Find your place</h2></header>
        <NationalCoverageMap />
      </section>
      <section className="national-context" aria-labelledby="national-context-heading">
        <div><h2 id="national-context-heading">National borrowing benchmark</h2><p>National average—not a lender quote.</p></div>
        {rate ? <div className="national-rate"><strong>{rate.value.toFixed(2)}%</strong><FloatingMetricTerm metricId={rate.metric_id} label="30-year fixed mortgage" /><small>Freddie Mac · {periodLabel(rate.period_start, rate.metric_id)}</small></div> : <p>Mortgage-rate data is unavailable in this snapshot.</p>}
      </section>
    </main>
  </>;
}
