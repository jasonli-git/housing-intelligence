import type { Metadata } from "next";
import { NationalCoverageMap } from "@/components/NationalCoverageMap";
import { Masthead } from "@/components/Masthead";
import { api, regionsWithData, nationalMortgageRate, nationalScoreSeries } from "@/lib/api";
import { latestPrice, scoreboard } from "@/lib/nationalScoreboard";
import { NationalScoreboard } from "@/components/NationalScoreboard";
import { dataScale } from "@/lib/dataScale";
import { propertyScale } from "@/lib/propertyScale";
import { DataScale, ScaleSignature } from "@/components/DataScale";
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
import "./national-strip.css";

export const metadata: Metadata = pageMetadata({
  title: "Housing Intelligence — Find your place",
  description: "A clearer picture of the place you could call home. Free housing data with sources for every figure; detailed coverage starts with New Jersey.",
  path: "/",
});

export default async function HousingLandingPage() {
  const rate = await nationalMortgageRate();
  const series = await nationalScoreSeries(rate?.metric_id);
  const tiles = scoreboard(series);
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
        <p className="entry-free-assurance"><span className="entry-free"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg><span>Free · No fees or ads</span></span></p>
      </header>
      <section className="coverage-entry coverage-entry-map" aria-label="Find your place">
        <NationalCoverageMap searchFirst focusedEntry scaleStrip={<div className="scale-map-edge artwork-caption">
          <ScaleSignature stats={scale} properties={properties} />
          <DataScale stats={scale} properties={properties} compactSummary />
        </div>} />
      </section>
      <NationalScoreboard tiles={tiles} homePrice={latestPrice(series.newHomePrice)} />
      <HomeStories />
      <HomeTools />
      </div>
    </main>
  </div>;
}
