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
      <header className={styles.heading}>
        <div>
          <h1>Housing Intelligence</h1>
          <p>Housing costs and local context, traced to their sources.</p>
        </div>
        <span className={styles.assurance}>Free · No fees or ads</span>
      </header>
      <section className={styles.entry} aria-labelledby="home-find-heading">
        <div className={styles.find}>
          <h2 id="home-find-heading">Find a place</h2>
          <HomeSearch />
          <nav className={styles.startLinks} aria-label="Start with a task">
            <Link href="/afford">Check your budget <span aria-hidden="true">→</span></Link>
            <Link href="/compare">Compare places <span aria-hidden="true">→</span></Link>
          </nav>
        </div>
        <aside className={styles.coverage} aria-labelledby="home-coverage-heading">
          <p className={styles.eyebrow}>Detailed coverage</p>
          <h2 id="home-coverage-heading">{COVERED_STATES.map((state, index) => <span key={state.code}>{index > 0 && ", "}<Link href={state.path}>{state.name} <span aria-hidden="true">↗</span></Link></span>)}</h2>
          <p>Counties, towns and ZIP codes. Availability varies by measure.</p>
        </aside>
        <details className={styles.mapDisclosure}>
          <summary>Explore the coverage map</summary>
          <div className={styles.map}><NationalCoverageMap /></div>
        </details>
      </section>
      <HomeTools />
      <HomeStories />
      <NationalScoreboard tiles={tiles} homePrice={latestPrice(series.newHomePrice)} />
      <div className={styles.evidence}>
        <ScaleSignature stats={scale} properties={properties} />
        <DataScale stats={scale} properties={properties} heading="About these figures" />
      </div>
    </main>
  </div>;
}
