import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "../../../poster.module.css";
import { Masthead } from "@/components/Masthead";
import { PlaceStoryGallery } from "@/components/PlaceStoryGallery";
import { api, artifactUrl, regionsWithData } from "@/lib/api";
import { ownershipInputs } from "@/lib/budgetScenario";
import { costInputs } from "@/lib/costInputs";
import { formatMetric } from "@/lib/format";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { eachMonth } from "@/lib/ownership";
import { comparisonMeasures } from "@/lib/placeComparisons";
import { placeRouteParams, regionPath, resolvePlace } from "@/lib/placeRoutes";
import { makePlaceStoryRecord, PLACE_STORIES, storyHistoryMetrics, type PlaceStoryTopic } from "@/lib/placeStories";
import { stampPlaceStory } from "@/lib/placeStoryData";
import { loadFloodStory } from "@/lib/placeFloodStory";
import { TREND_METRICS } from "@/lib/trendMetrics";
import { marketDistribution } from "@/lib/marketPortrait";
import { marketPortraitData } from "@/lib/marketPortraitData";
import { projector, ringsOf, shapes } from "@/lib/storyMap";
import { uncertaintiesFrom } from "@/lib/uncertainty";
import { verdictHeadline } from "@/lib/verdict";

const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
const STRIPS = [
  ["sr1a_median_sale_price", "Recent sale price"],
  ["acs_median_hh_income", "Household income"],
  ["acs_mean_commute_minutes", "Commute"],
  ["fema_flood_homes_share", "Homes in flood zone"],
  ["acs_homeownership_rate", "Homes owner-occupied"],
  ["acs_work_from_home_share", "Work from home"],
] as const;
const WORK = [
  ["lodes_work_same_town_share", "In town", "var(--series-1)"],
  ["lodes_work_home_county_share", "In county, with town", "var(--series-3)"],
  ["lodes_work_other_nj_share", "Elsewhere in NJ", "var(--series-2)"],
  ["lodes_work_nyc_share", "New York City", "var(--text-secondary)"],
  ["lodes_work_pennsylvania_share", "Pennsylvania", "var(--tick)"],
] as const;

export async function generateStaticParams() {
  return placeRouteParams(await regionsWithData());
}

/** A place page as one poster: every panel makes one point, and the picture makes it. */
export default async function PlacePoster({ params }: { params: Promise<{ state: string; place: string }> }) {
  const { state, place: slug } = await params;
  const regionId = resolvePlace(state, slug);
  if (regionId === null) notFound();
  const [region, packet, summary] = await Promise.all([api.region(regionId), api.packet(regionId, "5y"), api.summary(regionId, "5y")]);
  if (!region || !packet) notFound();

  const county = region.ancestors.find((a) => a.level === "county") ?? null;
  const [cost, history, countyGeo, townGeo, siblings] = await Promise.all([
    costInputs(region.state_code, region.level, packet.levels, packet.metrics),
    api.observations(regionId, "zhvi_sfr"),
    api.geo("county", region.state_code, 0.002),
    api.geo("municipality", region.state_code, 0.0005),
    county ? api.regions(`level=municipality&parent_id=${county.region_id}&limit=1000`) : null,
  ]);
  const name = displayName(region);
  const uncertainties = uncertaintiesFrom(summary);
  const { peer_count, peer_level, peer_scope } = packet.comparisons;
  const headline = verdictHeadline({ name, count: peer_count, noun: peerNoun(peer_level), scope: scopeName(peer_scope) }, packet.metrics, packet.levels, uncertainties);
  const level = (id: string) => packet.levels.find((l) => l.metric_id === id);

  const month = cost ? eachMonth(ownershipInputs({ state: region.state_code, price: cost.home.value, ratePct: cost.rate.value,
    taxYear: cost.tax?.value ?? null, insuranceYear: cost.insurance?.value ?? null, utilitiesMonth: cost.utilities?.month ?? null, rentMonth: cost.rent?.value ?? null })) : null;
  const rent = cost?.rent?.value ?? null;
  const line = (key: string) => month?.lines.find((l) => l.key === key)?.value ?? 0;
  const parts = [
    { label: "Mortgage", value: line("mortgage"), color: "var(--series-1)" },
    { label: "Property tax", value: line("tax"), color: "var(--series-2)" },
    { label: "Everything else", value: line("insurance") + line("utilities") + line("upkeep"), color: "var(--series-3)" },
  ].filter((part) => part.value > 0);
  const income = level("acs_median_hh_income")?.value ?? null;
  const shareOfIncome = (monthly: number | null) => (income && monthly ? (monthly * 12) / income * 100 : null);
  const ownShare = shareOfIncome(month?.total ?? null), rentShare = shareOfIncome(rent);

  const obs = history?.observations ?? [];
  const end = obs.at(-1)?.period_end;
  const recent = end ? obs.filter((o) => o.period_end >= `${Number(end.slice(0, 4)) - 10}${end.slice(4)}`).map((o) => o.value) : [];
  const low = Math.min(...recent), high = Math.max(...recent);
  const area = recent.map((v, i) => `${(i / Math.max(recent.length - 1, 1)) * 600},${190 - ((v - low * 0.8) / (high - low * 0.8 || 1)) * 180}`).join(" ");

  const strips = STRIPS.flatMap(([id, label]) => {
    const row = level(id);
    const measure = comparisonMeasures(packet.levels, uncertainties, [id])[0];
    return row && measure ? [{ ...measure, id, label, value: formatMetric(row.value, row.unit, id) }] : [];
  });
  const work = WORK.flatMap(([id, label, color]) => { const v = level(id)?.value; return v ? [{ label, color, value: v * 100 }] : []; });
  const owned = level("acs_homeownership_rate")?.value ?? null;

  const homeRow = level("zhvi_sfr");
  const countyTowns = siblings?.items ?? [];
  const values = homeRow && countyTowns.length ? await api.marketObservations("zhvi_sfr", countyTowns.map((t) => t.region_id), homeRow.period_start) : null;
  const ranked = (values?.regions ?? []).flatMap((row) => { const v = row.series.at(-1)?.value; const t = countyTowns.find((c) => c.region_id === row.region_id); return t && v !== undefined ? [{ id: t.region_id, name: displayName(t), value: v }] : []; }).sort((a, b) => b.value - a.value);

  const stateId = region.ancestors.find((a) => a.level === "state")?.region_id ?? null;
  const [series, construction, water, utilities, destinations, migration, pressure, community, flood] = await Promise.all([
    Promise.all(TREND_METRICS.map(async ({ metricId, short }) => ({ metricId, short, observations: (await api.observations(regionId, metricId))?.observations ?? [] }))),
    Promise.all(["permits_total_units", "nj_units_certified", "nj_units_demolished", "nj_net_units_added"].map(async (id) => (await api.observations(regionId, id))?.observations ?? [])),
    api.waterSystems(regionId), api.utilities(regionId), api.workDestinations(regionId), api.migration(regionId), api.housingPressure(regionId), api.community(regionId),
    loadFloodStory(region, county ? { region_id: county.region_id, name: displayName(county) } : null, stateId, async (id, metric) => (await api.observations(id, metric))?.observations ?? []),
  ]);
  const records = (Object.keys(PLACE_STORIES) as PlaceStoryTopic[]).filter((topic) => topic !== "past").map((topic) => stampPlaceStory(makePlaceStoryRecord(topic,
    { region_id: regionId, name: region.name, level: region.level, state_code: region.state_code, geoid: region.geoid }, packet.levels,
    { metrics: topic === "market" ? packet.metrics : [],
      history: topic === "market" ? series : topic === "building" ? storyHistoryMetrics(topic).map((metricId, i) => ({ metricId, observations: construction[i] })) : [],
      water: topic === "water" ? water : null, destinations: topic === "commute" ? destinations : null,
      pressure: topic === "pressure" ? pressure : null, migration: topic === "migration" ? migration : null,
      flood: topic === "flood" ? flood : null, utilities: topic === "utilities" ? utilities : null, utilityInquiry: null,
      community: topic === "broadband" || topic === "health" || topic === "schools" ? community : null })));

  const cohorts = await marketPortraitData(region.state_code, packet.levels, region.level);
  const boxes = cohorts.flatMap((cohort) => {
    const box = marketDistribution(cohort.points.map((p) => p.value));
    const own = level(cohort.metricId)?.value;
    if (!box || own === undefined) return [];
    // A log axis: a few very dear towns would otherwise squeeze every other town to the left.
    const x = (v: number) => (Math.log(v / box.min) / Math.log(box.max / box.min)) * 100;
    return [{ id: cohort.metricId, label: cohort.metricId === "zhvi_sfr" ? "Home value" : "Monthly rent", box, own, x, count: cohort.points.length }];
  });
  const townFeature = townGeo?.features.find((f) => f.properties.region_id === regionId);
  const frame = countyGeo ? projector(countyGeo.features.flatMap((f) => ringsOf(f.geometry)), 180, 4) : null;
  const counties = countyGeo && frame ? shapes(countyGeo.features, 180, frame).shapes : [];
  const town = townFeature && frame ? shapes([townFeature], 180, frame).shapes[0] : null;

  return <>
    <Masthead affordability={{ kind: "route" }} simple />
    <main id="main-content" tabIndex={-1} className={styles.poster}>
      <p className={styles.flag}>Infographic mockup · <Link href={regionPath(regionId)}>current page</Link> · <Link href={`/mockup/${state}/${slug}`}>first mockup</Link></p>

      <header className={`${styles.panel} ${styles.hero}`}>
        <div>
          <p className={styles.kicker}>{county ? `${displayName(county)}, ` : ""}{scopeName(region.state_code)}</p>
          <h1>{name}</h1>
          {headline && <p className={styles.headline}>{headline}</p>}
        </div>
        {frame && town && <svg viewBox={`0 0 ${frame.width} ${frame.height}`} role="img" aria-label={`${name} on a map of ${scopeName(region.state_code)}`}>
          {counties.map((c) => <path key={c.id} d={c.d} fill="currentColor" fillOpacity={c.id === county?.region_id ? 0.55 : 0.2} />)}
          <circle cx={town.centre[0]} cy={town.centre[1]} r="8" fill="var(--series-2)" stroke="var(--poster-hero)" strokeWidth="2" />
        </svg>}
      </header>

      {homeRow && <section className={`${styles.panel} ${styles.price}`}>
        <h2>The typical home</h2>
        <p className={styles.giant}>{formatMetric(homeRow.value, homeRow.unit, homeRow.metric_id)}</p>
        {recent.length > 1 && <svg className={styles.area} viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="Typical home value over the last ten years">
          <polygon points={`0,200 ${area} 600,200`} fill="currentColor" fillOpacity="0.16" />
          <polyline points={area} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>}
        <p className={styles.caption}>Last ten years · {dollars(recent[0] ?? 0)} to {dollars(recent.at(-1) ?? 0)}</p>
      </section>}

      {boxes.length > 0 && <section className={`${styles.panel} ${styles.boxes}`}>
        <h2>Where it sits among {scopeName(peer_scope)} {peerNoun(peer_level)}</h2>
        {boxes.map(({ id, label, box, own, x, count }) => <figure key={id} className={styles.boxPlot} aria-label={`${label}: ${name} ${dollars(own)}, median ${dollars(box.median)} of ${count}`} role="img">
          <figcaption><span>{label}</span><strong>{dollars(own)}</strong></figcaption>
          <div className={styles.boxTrack}>
            <hr />
            <u style={{ left: `${x(box.q1)}%`, width: `${x(box.q3) - x(box.q1)}%` }} />
            <b style={{ left: `${x(box.median)}%` }} />
            <i style={{ left: `${x(own)}%` }} />
          </div>
          <p className={styles.boxScale}><span>{dollars(box.min)}</span><span>median {dollars(box.median)}</span><span>{dollars(box.max)}</span></p>
        </figure>)}
        <p className={styles.caption}>Box: the middle half of towns. Line: the median. Ends: lowest and highest. Dot: {name}. Spacing is proportional, not linear.</p>
      </section>}

      {month && <section className={`${styles.panel} ${styles.cost}`}>
        <h2>Own or rent, each month</h2>
        <div className={styles.versus}>
          <div><span>Own</span><strong>{dollars(month.total)}</strong>
            <div className={styles.stack}>{parts.map((p) => <i key={p.label} title={`${p.label}: ${dollars(p.value)}`} style={{ flexGrow: p.value, background: p.color }} />)}</div></div>
          {rent !== null && <div><span>Rent</span><strong>{dollars(rent)}</strong>
            <div className={styles.stack} style={{ width: `${(rent / month.total) * 100}%` }}><i style={{ flexGrow: 1, background: "var(--text-secondary)" }} /></div></div>}
        </div>
        <ul className={styles.key}>{parts.map((p) => <li key={p.label}><i style={{ background: p.color }} />{p.label} {dollars(p.value)}</li>)}</ul>
      </section>}

      {ownShare !== null && <section className={`${styles.panel} ${styles.income}`}>
        <h2>Against a typical income</h2>
        {[["Owning", ownShare], ...(rentShare !== null ? [["Renting", rentShare]] : [])].map(([label, share]) => <div key={label as string} className={styles.meter}>
          <span>{label as string}</span>
          <div><i style={{ width: `${Math.min(share as number, 100)}%` }} /><b style={{ left: "30%" }} /></div>
          <strong>{(share as number).toFixed(0)}%</strong>
        </div>)}
        <p className={styles.caption}>Share of the {formatMetric(income!, "usd", "acs_median_hh_income")} median household income · the mark is the common 30% guideline</p>
      </section>}

      {strips.length > 0 && <section className={`${styles.panel} ${styles.rank}`}>
        <h2>Among {scopeName(peer_scope)} {peerNoun(peer_level)}</h2>
        <p className={styles.caption}>Lowest on the left, highest on the right. A wide band means the survey can’t place it exactly.</p>
        {strips.map((s) => <div key={s.id} className={styles.strip}>
          <span>{s.label}</span>
          <div><u style={{ left: `${s.low * 100}%`, width: `${(s.high - s.low) * 100}%` }} /><i style={{ left: `${s.position * 100}%` }} /></div>
          <strong>{s.value}</strong>
        </div>)}
      </section>}

      {(work.length > 0 || owned !== null) && <section className={`${styles.panel} ${styles.people}`}>
        {owned !== null && <><h2>Who holds the keys</h2>
          <div className={styles.split}><i style={{ flexGrow: owned }}>{(owned * 100).toFixed(0)}% own</i><i style={{ flexGrow: 1 - owned }}>{((1 - owned) * 100).toFixed(0)}% rent</i></div></>}
        {work.length > 0 && <><h2>Where residents work</h2>
          {work.map((w) => <div key={w.label} className={styles.meter}><span>{w.label}</span><div><i style={{ width: `${w.value}%`, background: w.color }} /></div><strong>{w.value.toFixed(0)}%</strong></div>)}</>}
      </section>}

      {ranked.length > 1 && county && <section className={`${styles.panel} ${styles.county}`}>
        <h2>Across {displayName(county)}</h2>
        {ranked.slice(0, 12).map((t) => <div key={t.id} className={styles.townBar} data-own={t.id === regionId || undefined}>
          <span>{t.name}</span><div><i style={{ width: `${(t.value / ranked[0].value) * 100}%` }} /></div><strong>{dollars(t.value)}</strong>
        </div>)}
      </section>}

      <section className={`${styles.panel} ${styles.stories}`}>
        <PlaceStoryGallery records={records} artifactUrl={artifactUrl} title={`Stories about ${name}`} />
      </section>

      <footer className={styles.close}>Sources: Zillow, Census Bureau, FEMA, NJ Division of Taxation. <Link href={`${regionPath(regionId)}/report`}>Every figure in the full report</Link></footer>
    </main>
  </>;
}
