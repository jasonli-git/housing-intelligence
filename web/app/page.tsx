import type { Metadata } from "next";
import { NationalCoverageMap } from "@/components/NationalCoverageMap";
import { Masthead } from "@/components/Masthead";
import { nationalBenchmarkTrends, nationalHomePriceChange, nationalMortgageRate } from "@/lib/api";
import { NationalTrend } from "@/components/NationalTrend";
import { periodLabel } from "@/lib/periods";
import { pageMetadata } from "@/lib/meta";
import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import Link from "next/link";

// The tools reachable from the bar, each with what it answers. All three cover New
// Jersey today, and say so, so the home page stays about no one state (#362).
const HOME_TOOLS = [
  { href: "/afford", title: "What can I afford?", text: "The counties and towns where the typical home is within reach of an income.", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { href: "/guide", title: "Buyer’s guide", text: "Afford, rent or buy, and what to check before an offer, for any place.", icon: "M4 5h7v14H4zM13 5h7v14h-7M7 9h1M16 9h1" },
  { href: "/tax", title: "Property tax lookup", text: "Any property by address or block and lot: its assessment and last year’s tax.", icon: "M5 21V8l7-5 7 5v13M9 21v-6h6v6" },
] as const;
import "./housing-entry.css";
import "./state-navigation.css";
import "./home-refresh.css";

export const metadata: Metadata = pageMetadata({
  title: "Housing Intelligence — Find your place",
  description: "A clearer picture of the place you could call home. Free housing data with sources for every figure; detailed coverage starts with New Jersey.",
  path: "/",
});

export default async function HousingLandingPage() {
  const [rate, homePrices] = await Promise.all([nationalMortgageRate(), nationalHomePriceChange()]);
  const trends = await nationalBenchmarkTrends(rate?.metric_id);
  return <>
    <Masthead affordability={{ kind: "hidden" }} search={false} />
    <main id="main-content" tabIndex={-1} className="shell nation-page quiet-nation">
      <div className="landing-canvas">
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
        <p className="entry-free computed"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg><span>Free · No fees, subscriptions or ads</span></p>
      </header>
      <section className="coverage-entry coverage-entry-map" aria-label="Find your place">
        <NationalCoverageMap searchFirst />
      </section>
      <section className="home-tools" aria-labelledby="home-tools-heading">
        <h2 id="home-tools-heading">Tools</h2>
        <ul>
          {HOME_TOOLS.map((tool) => <li key={tool.href}>
            <Link href={tool.href} data-tool={tool.href.slice(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={tool.icon} /></svg>
              <span className="home-tool-title">{tool.title} <span aria-hidden="true">→</span></span>
              <span className="home-tool-text">{tool.text}</span>
              <span className="home-tool-scope">New Jersey</span>
            </Link>
          </li>)}
        </ul>
      </section>
      <section className="national-backdrop" aria-labelledby="national-backdrop-heading">
        <header><h2 id="national-backdrop-heading">The national backdrop</h2><span>United States</span></header>
        <div className="national-backdrop-grid">
          <section className="national-benchmark" aria-labelledby="national-context-heading">
            <h3 id="national-context-heading">30-year mortgage rate</h3>
            {rate ? <>
              <div className="national-rate"><strong>{rate.value.toFixed(2)}%</strong><small><a href="https://www.freddiemac.com/pmms" target="_blank" rel="noreferrer noopener">Freddie Mac</a> · {periodLabel(rate.period_start, rate.metric_id)}</small></div>
              <div className="national-benchmark-definition"><FloatingMetricTerm metricId={rate.metric_id} label="National average—not a lender quote" /></div>
              <NationalTrend points={trends.rates} label="30-year mortgage rate history" metricId={rate.metric_id} frequency={rate.metric_id === "mortgage_rate_30y_weekly" ? "Weekly" : "Monthly"} />
            </> : <p>Mortgage-rate data is unavailable in this snapshot.</p>}
          </section>
          <section className="national-benchmark" aria-labelledby="national-home-prices-heading">
            <h3 id="national-home-prices-heading">Home prices · past year</h3>
            {homePrices ? <>
              <div className="national-rate"><strong>{homePrices.pct_change > 0 ? "+" : ""}{homePrices.pct_change.toFixed(1)}%</strong><small>{periodLabel(homePrices.period_start, "fhfa_hpi_us_monthly")} → {periodLabel(homePrices.period_end, "fhfa_hpi_us_monthly")} · <a href="https://www.fhfa.gov/data/hpi/datasets?tab=monthly-data" target="_blank" rel="noreferrer noopener">FHFA HPI®</a></small></div>
              <div className="national-benchmark-definition"><FloatingMetricTerm metricId="fhfa_hpi_us_monthly" label="Annual change · Single-family homes" definition="Calculated from FHFA’s national purchase-only house price index: the latest published month compared with the same month a year earlier. Seasonally adjusted, not adjusted for inflation. Covers homes financed with mortgages bought or securitized by Fannie Mae or Freddie Mac—not every home or your home's value. The plot shows annual percentage changes for successive months, not index levels. Historical figures may be revised." why={null} /></div>
              <NationalTrend points={trends.prices} label="Annual home-price change history" metricId="fhfa_hpi_us_monthly" frequency="Monthly" />
            </> : <p>A full year of comparable home-price data is unavailable.</p>}
          </section>
        </div>
        <p className="national-backdrop-note">Each trend uses its own scale. Historical figures, not forecasts.</p>
      </section>
      </div>
    </main>
  </>;
}
