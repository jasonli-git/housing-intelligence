import { Term } from "@/components/Term";
import type { Metadata } from "next";
import { termOf } from "@/lib/terms";
import { NationalCoverageMap } from "@/components/NationalCoverageMap";
import { Masthead } from "@/components/Masthead";
import { api, regionsWithData, nationalBenchmarkTrends, nationalHomePriceChange, nationalMortgageRate } from "@/lib/api";
import { dataScale } from "@/lib/dataScale";
import { propertyScale } from "@/lib/propertyScale";
import { DataScale, ScaleSignature } from "@/components/DataScale";
import { NationalTrend } from "@/components/NationalTrend";
import { periodLabel } from "@/lib/periods";
import { pageMetadata } from "@/lib/meta";
import { HomeStories } from "@/components/HomeStories";
import { HomeTools } from "@/components/HomeTools";

import "./housing-entry.css";
import "./state-navigation.css";
import "./home-refresh.css";
import "./data-scale.css";
import "./landing-search-first.css";
import "./home-plate.css";
import "./home-horizon.css";
import "./home-tool-previews.css";

export const metadata: Metadata = pageMetadata({
  title: "Housing Intelligence — Find your place",
  description: "A clearer picture of the place you could call home. Free housing data with sources for every figure; detailed coverage starts with New Jersey.",
  path: "/",
});

export default async function HousingLandingPage() {
  const [rate, homePrices] = await Promise.all([nationalMortgageRate(), nationalHomePriceChange()]);
  const trends = await nationalBenchmarkTrends(rate?.metric_id);
  const [metrics,sources,places] = await Promise.all([api.metrics(),api.sources(),regionsWithData()]);
  const scale = dataScale(metrics,sources,places);
  const properties = propertyScale();
  return <div className="search-first-home">
    <Masthead affordability={{ kind: "route", active: false }} search={false} />
    <main id="main-content" tabIndex={-1} className="shell nation-page quiet-nation">
      <div className="landing-canvas">
      <header className="page-head nation-head" data-kind="nation">
        <p className="plate-kicker" aria-hidden="true"><span>Plate I</span><span>The United States</span><span>39.8° N · 98.6° W</span></p>
        <h1>Housing <em>Intelligence</em></h1>
        <p className="entry-introduction">Housing costs. Local context. Clear sources.</p>
        <details className="entry-free-assurance"><summary className="entry-free"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg><span>Free · No fees or ads</span></summary><p>No fees, subscriptions or advertisements. Free to use.</p></details>
      </header>
      <section className="coverage-entry coverage-entry-map" aria-label="Find your place">
        <NationalCoverageMap searchFirst focusedEntry scaleStrip={<div className="scale-map-edge artwork-caption">
          <ScaleSignature stats={scale} properties={properties} />
          <DataScale stats={scale} properties={properties} compactSummary />
        </div>} />
      </section>
      <section className="national-backdrop" aria-label="United States housing figures">
        <h2 className="visually-hidden">United States housing figures</h2>
        <div className="national-backdrop-grid">
          <section className="national-benchmark" aria-labelledby="national-context-heading">
            <h3 id="national-context-heading">30-year mortgage rate</h3>
            {rate ? <>
              <div className="national-rate"><strong>{rate.value.toFixed(2)}%</strong><small><a href="https://www.freddiemac.com/pmms" target="_blank" rel="noreferrer noopener">Freddie Mac</a> · {periodLabel(rate.period_start, rate.metric_id)}</small></div>
              <div className="national-benchmark-definition"><Term id={rate.metric_id}>National average—not a lender quote</Term></div>
              <NationalTrend points={trends.rates} label="30-year mortgage rate history" metricId={rate.metric_id} frequency={rate.metric_id === "mortgage_rate_30y_weekly" ? "Weekly" : "Monthly"} />
            </> : <p>Mortgage-rate data is unavailable in this snapshot.</p>}
          </section>
          <section className="national-benchmark" aria-labelledby="national-home-prices-heading">
            <h3 id="national-home-prices-heading">Home prices, change over the past year</h3>
            {homePrices ? <>
              <div className="national-rate"><strong>{homePrices.pct_change > 0 ? "+" : ""}{homePrices.pct_change.toFixed(1)}%</strong><small>{periodLabel(homePrices.period_start, "fhfa_hpi_us_monthly")} → {periodLabel(homePrices.period_end, "fhfa_hpi_us_monthly")} · <a href="https://www.fhfa.gov/data/hpi/datasets?tab=monthly-data" target="_blank" rel="noreferrer noopener">FHFA HPI®</a></small></div>
              <div className="national-benchmark-definition"><Term id="fhfa_hpi_us_monthly" definition={termOf("fhfa-us-annual-change")!.what} why={null}>Annual change · Single-family homes</Term></div>
              <NationalTrend points={trends.prices} label="Annual home-price change history" metricId="fhfa_hpi_us_monthly" frequency="Monthly" />
            </> : <p>A full year of comparable home-price data is unavailable.</p>}
          </section>
        </div>
        <p className="national-backdrop-note">Each trend uses its own scale. Historical figures, not forecasts.</p>
      </section>
      <HomeStories />
      <HomeTools />
      </div>
    </main>
  </div>;
}
