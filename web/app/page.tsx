import type { Metadata } from "next";
import Link from "next/link";
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
import { HomeSearch } from "@/components/HomeSearch";
import { COVERED_STATES } from "@/lib/states";

import "./housing-entry.css";
import "./state-navigation.css";
import "./data-scale.css";
import "./national-strip.css";
import styles from "./homepage.module.css";

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
  return <div className={`search-first-home home-page ${styles.home}`}>
    <Masthead affordability={{ kind: "route", active: false }} search={false} />
    <main id="main-content" tabIndex={-1} className={`shell ${styles.main}`}>
      <section className={styles.entry} aria-labelledby="home-find-heading">
        <div className={styles.find}>
          <header className={styles.heading}>
            <h1>Housing <em>Intelligence</em></h1>
            <span className={styles.assurance}>Free · No fees or ads</span>
          </header>
          <h2 id="home-find-heading">Find a place</h2>
          <HomeSearch />
          {/* What the platform holds, as proof of "Free" rather than a section of its own. */}
          <div className={styles.evidence}>
            <ScaleSignature stats={scale} properties={properties} />
            <DataScale stats={scale} properties={properties} heading="About these figures" />
          </div>
        </div>
        <aside className={styles.coverage} aria-labelledby="home-coverage-heading">
          <div className={styles.map}><NationalCoverageMap preview focusedEntry /></div>
          {/* One caption for the map: where detailed coverage is, and what the map is not. */}
          <p className={styles.coverageCaption}>
            <span id="home-coverage-heading">Detailed coverage: {COVERED_STATES.map((state, index) => <span key={state.code}>{index > 0 && ", "}<Link href={state.path}>{state.name}&nbsp;<span aria-hidden="true">↗</span></Link></span>)}</span>
            <span aria-hidden="true"> · </span>
            <span>A coverage map, not prices. Alaska and Hawaii not shown.</span>
          </p>
        </aside>
      </section>
      <HomeTools />
      <HomeStories />
      <NationalScoreboard tiles={tiles} homePrice={latestPrice(series.newHomePrice)} />
    </main>
  </div>;
}
