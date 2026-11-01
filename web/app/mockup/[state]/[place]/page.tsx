import Link from "next/link";
import { notFound } from "next/navigation";

import "../../../place-photo.css";
import "../../../horizon-theme.css";
import "../../../income-pressure.css";
import overview from "../../../place-overview.module.css";
import styles from "../../town.module.css";
import { CommunityContext } from "@/components/CommunityContext";
import { CostToOwn } from "@/components/CostToOwn";
import { Crumbs } from "@/components/Crumbs";
import { FloodRisk } from "@/components/FloodRisk";
import { GettingAround } from "@/components/GettingAround";
import { GroundAndWater } from "@/components/GroundAndWater";
import { CompactHousingProfile } from "@/components/CompactHousingProfile";
import { PaycheckExhibit } from "@/components/ExhibitCharts";
import { ExhibitGallery } from "@/components/ExhibitGallery";
import { HomesAdded } from "@/components/HomesAdded";
import { HomeSales } from "@/components/HomeSales";
import { IncomePressure } from "@/components/IncomePressure";
import { IndexedComparison } from "@/components/IndexedComparison";
import { LearningExhibit } from "@/components/LearningExhibit";
import { LocalEvidenceCharts } from "@/components/LocalEvidenceCharts";
import { Masthead } from "@/components/Masthead";
import { PlaceMarketOpening } from "@/components/PlaceMarketOpening";
import { StateContextExhibits } from "@/components/StateContextExhibits";
import { WhoIsMoving } from "@/components/WhoIsMoving";
import { PlaceComparisonRail } from "@/components/PlaceComparisonRail";
import { PlaceStoryGallery } from "@/components/PlaceStoryGallery";
import { SimilarPlaces } from "@/components/SimilarPlaces";
import { Utilities } from "@/components/Utilities";
import { api, artifactUrl, regionsWithData } from "@/lib/api";
import { ownershipInputs } from "@/lib/budgetScenario";
import { placesQuery } from "@/lib/compare";
import { costInputs } from "@/lib/costInputs";
import { formatMetric } from "@/lib/format";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { eachMonth } from "@/lib/ownership";
import { comparisonMeasures } from "@/lib/placeComparisons";
import { loadFloodStory } from "@/lib/placeFloodStory";
import { placeRouteParams, regionPath, resolvePlace } from "@/lib/placeRoutes";
import { marketPortraitData } from "@/lib/marketPortraitData";
import { makePlaceStoryRecord, PLACE_STORIES, storyHistoryMetrics, type PlaceStoryTopic } from "@/lib/placeStories";
import { TREND_METRICS } from "@/lib/trendMetrics";
import { stampPlaceStory } from "@/lib/placeStoryData";
import { stateCrumbs } from "@/lib/states";
import { projector, ringsOf, shapes } from "@/lib/storyMap";
import { uncertaintiesFrom } from "@/lib/uncertainty";
import { housingProfile, tradeoff, verdictHeadline, verdictRank } from "@/lib/verdict";

const WINDOW = "5y";
const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
export async function generateStaticParams() {
  return placeRouteParams(await regionsWithData());
}

/** A position from 0 (lowest) to 1 (highest), or a range of them. */
function standing(low: number, high: number): string {
  if (high <= 0.4) return "lower than most";
  if (low >= 0.6) return "higher than most";
  if (low >= 0.4 && high < 0.6) return "near the middle of";
  return "hard to tell apart from most";
}

/** The last five years of a series, with its change, on the series' own scale. */
function lastFiveYears(observations: { period_end: string; value: number }[]) {
  const end = observations.at(-1)?.period_end;
  if (!end) return null;
  const start = `${Number(end.slice(0, 4)) - 5}${end.slice(4)}`;
  const points = observations.filter((o) => o.period_end >= start).map((o) => o.value);
  if (points.length < 12 || points[0] === 0) return null;
  return { points, change: (points.at(-1)! / points[0] - 1) * 100 };
}

function Sparkline({ points, label }: { points: number[]; label: string }) {
  const low = Math.min(...points), high = Math.max(...points), span = high - low || 1;
  const line = points.map((value, i) => `${(i / (points.length - 1)) * 120},${30 - ((value - low) / span) * 26}`).join(" ");
  return <svg className={styles.spark} viewBox="0 0 120 32" preserveAspectRatio="none" role="img" aria-label={label}>
    <title>{label}</title>
    <polyline points={line} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

/** Where the town sits among its peers, cheapest to priciest. */
function RankScale({ position, label }: { position: number; label: string }) {
  return <div className={styles.scale} role="img" aria-label={label} title={label}>
    <span>Least expensive</span>
    <div className={styles.scaleTrack}><i style={{ left: `${position * 100}%` }} /></div>
    <span>Most expensive</span>
  </div>;
}

function CostBars({ parts, total, rent }: { parts: { label: string; value: number; color: string }[]; total: number; rent: number | null }) {
  const scale = Math.max(total, rent ?? 0);
  return <div className={styles.bars}>
    <div className={styles.barRow}>
      <span>Own</span>
      <div className={styles.bar} style={{ width: `${(total / scale) * 100}%` }}>
        {parts.map((part) => <i key={part.label} title={`${part.label}: ${dollars(part.value)}`} style={{ flexGrow: part.value, background: part.color }} />)}
      </div>
      <b>{dollars(total)}</b>
    </div>
    {rent !== null && <div className={styles.barRow}>
      <span>Rent</span>
      <div className={styles.bar} style={{ width: `${(rent / scale) * 100}%` }}><i title={`Rent: ${dollars(rent)}`} style={{ flexGrow: 1, background: "var(--tick)" }} /></div>
      <b>{dollars(rent)}</b>
    </div>}
    <ul className={styles.legend}>{parts.map((part) => <li key={part.label}><i style={{ background: part.color }} /><span>{part.label}</span><b>{dollars(part.value)}</b></li>)}</ul>
  </div>;
}

/** A place's history on one labelled axis, Data Commons' chart half of its chart-and-number pair. */
function HistoryChart({ observations, label }: { observations: { period_end: string; value: number }[]; label: string }) {
  const W = 640, H = 240, left = 58, bottom = 24, top = 8;
  const high = Math.max(...observations.map((o) => o.value));
  const step = 10 ** Math.floor(Math.log10(high)) / 2;
  const ceiling = Math.ceil(high / step) * step;
  const ticks = Array.from({ length: Math.round(ceiling / step) + 1 }, (_, i) => i * step).filter((_, i, all) => i % Math.ceil((all.length - 1) / 5) === 0);
  const x = (i: number) => left + (i / (observations.length - 1)) * (W - left - 4);
  const y = (value: number) => H - bottom - (value / ceiling) * (H - bottom - top);
  const firstYear = Number(observations[0].period_end.slice(0, 4)), lastYear = Number(observations.at(-1)!.period_end.slice(0, 4));
  const every = lastYear - firstYear > 15 ? 5 : 2;
  const years = observations.flatMap((o, i) => {
    const year = Number(o.period_end.slice(0, 4));
    return year % every === 0 && (i === 0 || observations[i - 1].period_end.slice(0, 4) !== o.period_end.slice(0, 4)) ? [{ year, i }] : [];
  });
  return <svg className={styles.history} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
    <title>{label}</title>
    {ticks.map((tick) => <g key={tick}>
      <line x1={left} x2={W} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" />
      <text x={left - 8} y={y(tick) + 4} textAnchor="end">{tick >= 1e6 ? `$${(tick / 1e6).toFixed(1)}M` : `$${Math.round(tick / 1000)}K`}</text>
    </g>)}
    {years.map(({ year, i }) => <text key={year} x={x(i)} y={H - 6} textAnchor="middle">{year}</text>)}
    <polyline points={observations.map((o, i) => `${x(i)},${y(o.value)}`).join(" ")} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

/** The state's counties, the town's county tinted and the town ringed, since many are specks. */
function LocatorMap({ width, height, counties, countyId, town, label }: { width: number; height: number; counties: { id: number; d: string }[]; countyId: number | null;
  town: { d: string; centre: [number, number] }; label: string }) {
  return <figure className={styles.locator}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <title>{label}</title>
      {counties.map((shape) => <path key={shape.id} d={shape.d} fill="var(--text-muted)" fillOpacity={shape.id === countyId ? 0.75 : 0.28} stroke="var(--surface-card)" strokeWidth="0.75" />)}
      <path d={town.d} fill="var(--series-1)" />
      <circle cx={town.centre[0]} cy={town.centre[1]} r="7" fill="none" stroke="var(--series-1)" strokeWidth="2" />
    </svg>
    <figcaption>{label}</figcaption>
  </figure>;
}

type RankedTown = { id: number; name: string; value: number };

/** The county's towns, top and bottom five with this town kept in view. */
function CountyRanking({ towns, ownId }: { towns: RankedTown[]; ownId: number }) {
  const own = towns.findIndex((town) => town.id === ownId);
  const keep = new Set(towns.flatMap((_, i) => (i < 5 || i >= towns.length - 5 || i === own ? [i] : [])));
  const high = towns[0]?.value ?? 1;
  return <ol className={styles.ranking}>
    {towns.flatMap((town, i) => {
      if (!keep.has(i)) return keep.has(i - 1) ? [<li key={`gap-${i}`} className={styles.rankGap} aria-hidden="true">…</li>] : [];
      return [<li key={town.id} data-own={town.id === ownId || undefined}>
        <span>{i + 1}</span>
        <Link href={regionPath(town.id)}>{town.name}</Link>
        <div className={styles.rankTrack}><i style={{ width: `${(town.value / high) * 100}%` }} /></div>
        <b>{dollars(town.value)}</b>
      </li>];
    })}
  </ol>;
}

function Fold({ title, note, figure, children }: { title: string; note: string; figure?: { value: string; label: string; context?: string | null } | null; children: React.ReactNode }) {
  return <details className={styles.fold}>
    <summary><strong>{title}</strong>{figure ? <span className={styles.glance}><b>{figure.value}</b> {figure.label}{figure.context && <small>{figure.context}</small>}</span> : <span>{note}</span>}</summary>
    <div className={styles.foldBody}>{children}</div>
  </details>;
}

/** A mockup of the town page as the site's centre: one fixed reading order, nothing else. */
export default async function TownMockup({ params }: { params: Promise<{ state: string; place: string }> }) {
  const { state, place: slug } = await params;
  const regionId = resolvePlace(state, slug);
  if (regionId === null) notFound();
  const [region, packet, summary] = await Promise.all([api.region(regionId), api.packet(regionId, WINDOW), api.summary(regionId, WINDOW)]);
  if (!region || !packet) notFound();

  const county = region.ancestors.find((a) => a.level === "county") ?? null;
  const stateId = region.ancestors.find((a) => a.level === "state")?.region_id ?? null;
  const [cost, flood, water, utilities, destinations, similar, community, homeHistory, rentHistory] = await Promise.all([
    costInputs(region.state_code, region.level, packet.levels, packet.metrics),
    loadFloodStory(region, county ? { region_id: county.region_id, name: displayName(county) } : null, stateId,
      async (id, metric) => (await api.observations(id, metric))?.observations ?? []),
    api.waterSystems(regionId),
    api.utilities(regionId),
    api.workDestinations(regionId),
    api.similarPlaces(regionId),
    api.community(regionId),
    api.observations(regionId, "zhvi_sfr"),
    api.observations(regionId, "zori_all"),
  ]);

  const [series, construction, migration, pressure, marketCohorts] = await Promise.all([
    Promise.all(TREND_METRICS.map(async ({ metricId, short }) => ({ metricId, short, observations: (await api.observations(regionId, metricId))?.observations ?? [] }))),
    Promise.all(["permits_total_units", "nj_units_certified", "nj_units_demolished", "nj_net_units_added"].map(async (metricId) => (await api.observations(regionId, metricId))?.observations ?? [])),
    api.migration(regionId),
    api.housingPressure(regionId),
    marketPortraitData(region.state_code, packet.levels, region.level),
  ]);
  const indexedInputs = series.filter((item) => item.observations.length >= 2).map(({ metricId, short, observations }) => ({
    metricId, label: short, points: observations.map((o) => ({ date: o.period_end, value: o.value })),
  }));
  const name = displayName(region);
  const { peer_count, peer_level, peer_scope } = packet.comparisons;
  const peers = { name, count: peer_count, noun: peerNoun(peer_level), scope: scopeName(peer_scope) };
  const uncertainties = uncertaintiesFrom(summary);
  const headline = verdictHeadline(peers, packet.metrics, packet.levels, uncertainties);
  const trade = tradeoff(peers, packet.levels, uncertainties);
  const cohort = `${region.state_code} ${peerNoun(peer_level)}`;
  // By published rank and its survey range, so an uncertain figure says so.
  const compared = (metricId: string) => {
    const measure = comparisonMeasures(packet.levels, uncertainties, [metricId])[0];
    if (!measure) return null;
    const { row, best, worst } = measure;
    const fromLow = (rank: number) => (row.direction === "lower_is_better" ? rank - 1 : row.of! - rank) / (row.of! - 1);
    return `${standing(Math.min(fromLow(best), fromLow(worst)), Math.max(fromLow(best), fromLow(worst)))} ${cohort}`;
  };
  // `verdictRank` is null where a survey margin leaves the rank too wide to state.
  const homeRank = verdictRank(packet.levels, uncertainties);
  const homeRow = packet.levels.find((l) => (l.metric_id === "zhvi_sfr" || l.metric_id === "acs_median_home_value") && l.of === homeRank?.of);
  const rankWord = (homeRow?.rank ?? 0) <= Math.ceil((homeRank?.of ?? 0) / 2) ? "most" : "least";
  const rankLine = homeRank && homeRow ? `${homeRank.place === "1st" ? `The ${rankWord}` : `${homeRank.place} ${rankWord}`} expensive of ${homeRank.of} ${scopeName(peer_scope)} ${peerNoun(peer_level)} by typical home value.` : null;
  const income = housingProfile(packet.levels, packet.metrics, uncertainties).find((item) => /income/i.test(item.label));
  // The published starting figures only, the same baseline the calculator opens on.
  const month = cost ? eachMonth(ownershipInputs({ state: region.state_code, price: cost.home.value, ratePct: cost.rate.value,
    taxYear: cost.tax?.value ?? null, insuranceYear: cost.insurance?.value ?? null,
    utilitiesMonth: cost.utilities?.month ?? null, rentMonth: cost.rent?.value ?? null })) : null;
  const rent = cost?.rent?.value ?? null;
  const homeTrend = lastFiveYears(homeHistory?.observations ?? []);
  const rentTrend = lastFiveYears(rentHistory?.observations ?? []);
  const changeNote = (trend: { change: number }) => `${trend.change >= 0 ? "+" : ""}${trend.change.toFixed(0)}% in 5 years`;
  const figures: { label: string; value: string; note: string; points?: number[] }[] = ([
    cost && { label: "Typical home value", value: dollars(cost.home.value), note: homeTrend ? changeNote(homeTrend) : "Zillow estimate", points: homeTrend?.points },
    month && { label: "To own, each month", value: dollars(month.total), note: "20% down, today’s rate" },
    rent !== null && { label: "To rent, each month", value: dollars(rent), note: [rentTrend && `${rentTrend.change >= 0 ? "+" : ""}${rentTrend.change.toFixed(0)}%`, compared("zori_all")?.replace(` ${cohort}`, "")].filter(Boolean).join(" · ") || "Typical rent", points: rentTrend?.points },
    income && { label: "Household income", value: income.value, note: compared("acs_median_hh_income") ?? "Census median" },
  ] as const).flatMap((item) => (item ? [item] : []));
  const lineValue = (key: string) => month?.lines.find((line) => line.key === key)?.value ?? 0;
  const parts = [
    { label: "Mortgage", value: lineValue("mortgage"), color: "var(--series-1)" },
    { label: "Property tax", value: lineValue("tax"), color: "var(--series-2)" },
    { label: "Insurance, utilities and upkeep", value: lineValue("insurance") + lineValue("utilities") + lineValue("upkeep"), color: "var(--series-3)" },
  ].filter((part) => part.value > 0);
  const rankPosition = homeRow?.rank != null && homeRow.of != null && homeRow.of > 1 ? 1 - (homeRow.rank - 1) / (homeRow.of - 1) : null;
  const population = packet.levels.find((l) => l.metric_id === "acs_population");
  const glance = (metricId: string, label: string, context = compared(metricId)) => {
    const level = packet.levels.find((l) => l.metric_id === metricId);
    return level ? { value: formatMetric(level.value, level.unit, level.metric_id), label, context } : null;
  };
  // Open cleanups carry no published rank, so they are set among every town's count.
  const sitesLevel = packet.levels.find((l) => l.metric_id === "njdep_sites_open");
  const towns = sitesLevel ? (await api.regions(`state=${region.state_code}&level=municipality&limit=1000`))?.items ?? [] : [];
  const batches = Array.from({ length: Math.ceil(towns.length / 100) }, (_, i) => towns.slice(i * 100, i * 100 + 100).map((t) => t.region_id));
  const homesLevel = packet.levels.find((l) => l.metric_id === "acs_housing_units");
  const townValues = async (metricId: string, period: string) => new Map((await Promise.all(batches.map((ids) => api.marketObservations(metricId, ids, period))))
    .flatMap((part) => part?.regions.flatMap((r) => r.series.map((p) => [r.region_id, p.value] as const)) ?? []));
  const [siteCounts, homeCounts] = sitesLevel && homesLevel
    ? await Promise.all([townValues("njdep_sites_open", sitesLevel.period_start), townValues("acs_housing_units", homesLevel.period_start)])
    : [new Map<number, number>(), new Map<number, number>()];
  const siteRates = [...siteCounts].flatMap(([id, count]) => (homeCounts.get(id) ?? 0) > 0 ? [(count / homeCounts.get(id)!) * 1000] : []).sort((a, b) => a - b);
  const siteRate = sitesLevel && homesLevel && homesLevel.value > 0 ? (sitesLevel.value / homesLevel.value) * 1000 : null;
  const sitesFigure = sitesLevel && siteRate !== null ? {
    value: formatMetric(sitesLevel.value, sitesLevel.unit, sitesLevel.metric_id),
    label: `open site cleanups, ${siteRate.toFixed(1)} per 1,000 homes`,
    context: siteRates.length > 1 ? (() => {
      const position = (siteRates.filter((v) => v < siteRate).length + siteRates.filter((v) => v === siteRate).length / 2) / siteRates.length;
      return `${standing(position, position)} ${cohort} (typical: ${siteRates[Math.floor(siteRates.length / 2)].toFixed(1)})`;
    })() : null,
  } : null;
  // A town split between districts has no one school figure to lead with.
  const reading = community?.districts.length === 1
    ? community.districts[0].performance?.payload.indicators.find((i) => i.label.startsWith("English language arts"))
    : undefined;
  const schools = reading?.value != null ? { value: `${reading.value.toFixed(0)}%`, label: "met English expectations" } : null;
  const electric = utilities?.providers.find((p) => p.fuel === "electric");
  const homeLevel = packet.levels.find((l) => l.metric_id === "zhvi_sfr");
  const countyTowns = county && homeLevel ? (await api.regions(`level=municipality&parent_id=${county.region_id}&limit=1000`))?.items ?? [] : [];
  const countyValues = homeLevel && countyTowns.length ? await api.marketObservations("zhvi_sfr", countyTowns.map((t) => t.region_id), homeLevel.period_start) : null;
  const ranked = (countyValues?.regions ?? []).flatMap((row) => {
    const town = countyTowns.find((t) => t.region_id === row.region_id);
    const value = row.series.at(-1)?.value;
    return town && value !== undefined ? [{ id: town.region_id, name: displayName(town), value }] : [];
  }).sort((a, b) => b.value - a.value);
  const [countyGeo, townGeo] = await Promise.all([api.geo("county", region.state_code, 0.002), api.geo("municipality", region.state_code, 0.0005)]);
  const townFeature = townGeo?.features.find((f) => f.properties.region_id === regionId);
  const frame = countyGeo ? projector(countyGeo.features.flatMap((f) => ringsOf(f.geometry)), 150, 4) : null;
  const locator = countyGeo && frame && townFeature ? {
    width: frame.width, height: frame.height,
    counties: shapes(countyGeo.features, 150, frame).shapes,
    town: shapes([townFeature], 150, frame).shapes[0],
  } : null;
  const taxHref = `/tax?town=${region.geoid}`;
  const records = (Object.keys(PLACE_STORIES) as PlaceStoryTopic[]).filter((topic) => topic !== "past").map((topic) => stampPlaceStory(makePlaceStoryRecord(topic,
    { region_id: regionId, name: region.name, level: region.level, state_code: region.state_code, geoid: region.geoid }, packet.levels,
    { metrics: topic === "market" ? packet.metrics : [],
      history: topic === "market" ? series : topic === "building" ? storyHistoryMetrics(topic).map((metricId, i) => ({ metricId, observations: construction[i] })) : [],
      water: topic === "water" ? water : null, destinations: topic === "commute" ? destinations : null,
      pressure: topic === "pressure" ? pressure : null, migration: topic === "migration" ? migration : null,
      flood: topic === "flood" ? flood : null, utilities: topic === "utilities" ? utilities : null, utilityInquiry: null,
      community: topic === "broadband" || topic === "health" || topic === "schools" ? community : null })));
  const profile = housingProfile(packet.levels, packet.metrics, uncertainties).filter((item) => item.metric_id !== "acs_population");
  const context = { name, level: region.level, levels: packet.levels, destinations, community };

  return <>
    <Masthead affordability={{ kind: "route" }} simple />
    <main id="main-content" tabIndex={-1} className={`shell atlas-page atlas-local horizon-page quiet-county ${overview.page} ${styles.page}`} data-region-level={region.level}>
      <p className={styles.flag}>Mockup · not part of the published site · <Link href={regionPath(regionId)}>see the current page</Link></p>
      <header className={styles.head}>
        <Crumbs trail={[{ href: "/", label: "Home" }, ...stateCrumbs(region.state_code), ...(county ? [{ href: regionPath(county.region_id), label: displayName(county) }] : [])]} here={name} />
        <h1>{name}</h1>
        <p className={styles.where}>{county ? `${displayName(county)}, ` : ""}{scopeName(region.state_code)}{population ? ` · ${formatMetric(population.value, population.unit, population.metric_id)} residents` : ""}</p>
        <nav className={styles.steps} aria-label="On this page">
          <span>Topics</span><a href="#cost">Cost</a><a href="#values">Home values</a><a href="#market">Market</a><a href="#living">Living here</a><a href="#compare">Compared</a><a href="#stories">Stories</a>
        </nav>
      </header>

      <section className={styles.summary} aria-label="Summary">
        <h2>Summary</h2>
        <div className={styles.summaryTop}><div>
        {headline && <p className={styles.verdict}>{headline}</p>}
        {rankLine && <p className={styles.support}>{rankLine}</p>}
        {rankLine && rankPosition !== null && <RankScale position={rankPosition} label={rankLine} />}
        </div>
        {locator && <LocatorMap {...locator} countyId={county?.region_id ?? null} label={county ? `${name} in ${displayName(county)}` : name} />}
        </div>
        {trade && <p className={styles.support}>{trade}</p>}
        <dl className={styles.figures}>
          {figures.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd>{item.points && <Sparkline points={item.points} label={`${item.label}: ${item.note}`} />}<small>{item.note}</small></div>)}
        </dl>
      </section>

      <section id="cost" className={`${styles.section} ${styles.band}`} data-tone="cost">
        <h2>What it costs</h2>
        {cost && month ? <>
          <p className={styles.answer}>
            Owning the typical home here runs about <strong>{dollars(month.total)} a month</strong>
            {rent !== null && (month.total > rent ? `, ${dollars(month.total - rent)} more than renting` : `, ${dollars(rent - month.total)} less than renting`)}.
            {month.principal > 0 && ` About ${dollars(month.principal)} of that goes into the home.`}
            {month.missing.length > 0 && ` Not counted: ${month.missing.join(", ").toLowerCase()}.`}
          </p>
          <CostBars parts={parts} total={month.total} rent={rent} />
          <Fold title="Use your own numbers" note="Price, down payment, rate and rent">
            <CostToOwn {...cost} quiet compactOverview guidePlaceId={regionId} comparePlaceId={regionId} showHelp={false} />
          </Fold>
        </> : <p>No monthly cost is worked out for {name}.</p>}
        <ul className={styles.next}>
          <li><Link href={taxHref}>Look up a property’s tax</Link></li>
          <li><Link href={`/guide?place=${regionId}`}>Thinking of buying here?</Link></li>
          <li><Link href={`/afford?place=${regionId}&county=${county?.region_id ?? "all"}`}>Find places within my budget</Link></li>
        </ul>
      </section>

      {homeHistory && homeHistory.observations.length > 1 && homeLevel && <section id="values" className={`${styles.section} ${styles.band}`} data-tone="values">
        <h2>Home values</h2>
        <div className={styles.pair}>
          <figure>
            <figcaption>{name}: typical home value</figcaption>
            <HistoryChart observations={homeHistory.observations} label={`${name} typical home value over time`} />
          </figure>
          <div className={styles.big}>
            <strong>{formatMetric(homeLevel.value, homeLevel.unit, homeLevel.metric_id)}</strong>
            <span>{name}: typical home value</span>
            {homeTrend && <span>{changeNote(homeTrend)}</span>}
          </div>
        </div>
        <p className={styles.source}>Source: Zillow Home Value Index · <Link href="/sources">About this data</Link></p>
        {ranked.length > 1 && county && <figure className={styles.rankFigure}>
          <figcaption>Towns in {displayName(county)}: typical home value</figcaption>
          <CountyRanking towns={ranked} ownId={regionId} />
          <p className={styles.source}>Source: Zillow Home Value Index. Towns Zillow does not cover are left out.</p>
        </figure>}
      </section>}

      <section id="market" className={`${styles.section} ${styles.band}`} data-tone="market">
        <h2>The market in detail</h2>
        <Fold title="Against other towns" note="Home value and rent across the state" figure={homeRank ? { value: homeRank.place, label: `of ${homeRank.of} for home value` } : null}>
          <PlaceMarketOpening levels={packet.levels} metrics={packet.metrics} uncertainties={uncertainties} peers={peers} ownId={regionId} cohorts={marketCohorts} histories={series}
            reportHref={`${regionPath(regionId)}/report`} standing={[]} />
        </Fold>
        <Fold title="Prices and sales" note="Recent sales, paychecks and long-run trends" figure={glance("sr1a_median_sale_price", "typical recent sale")}><ExhibitGallery>
          <LearningExhibit kind="The homes that sold"><HomeSales name={name} level={region.level} geoid={region.geoid} levels={packet.levels} showLookup={false} portrait concise /></LearningExhibit>
          <LearningExhibit kind="Prices & paychecks"><PaycheckExhibit metrics={packet.metrics} /></LearningExhibit>
          {indexedInputs.length > 0 && <LearningExhibit kind="Trends"><IndexedComparison series={indexedInputs} /></LearningExhibit>}
        </ExhibitGallery></Fold>
        <Fold title="Affordability" note="Cost burden and buyer financing" figure={glance("acs_renter_cost_burden", "of renters spend over 30% of income")}><ExhibitGallery>
          <IncomePressure data={pressure} concise />
          <StateContextExhibits concise topics={["lending"]} {...context} />
        </ExhibitGallery></Fold>
        <Fold title="Homes and residents" note="The housing here, who moves and what gets built" figure={glance("acs_homeownership_rate", "of homes are owner-occupied")}><CompactHousingProfile items={profile} peers={peerNoun(peer_level)} standouts={[]} /><ExhibitGallery>
          {migration && <LearningExhibit kind="Arrivals & departures"><WhoIsMoving name={name} data={migration} exhibit concise /></LearningExhibit>}
          {construction.some((rows) => rows.length > 0) && <LearningExhibit kind="Building & demolition">
            <HomesAdded exhibit portrait concise name={name} level={region.level} permitted={construction[0]} completed={construction[1]} demolished={construction[2]} net={construction[3]} levels={packet.levels} />
          </LearningExhibit>}
        </ExhibitGallery></Fold>
        <Fold title="Work and internet" note="Where residents work and how they connect" figure={glance("acs_work_from_home_share", "of workers work from home")}><ExhibitGallery>
          <StateContextExhibits concise topics={["work"]} {...context} />
          <LocalEvidenceCharts kind="work" name={name} level={region.level} levels={packet.levels} series={construction} />
          <StateContextExhibits concise topics={["broadband"]} {...context} />
        </ExhibitGallery></Fold>
      </section>

      <section id="living" className={`${styles.section} ${styles.band}`} data-tone="living">
        <h2>What it’s like to live here</h2>
        <Fold title="Getting around" note="Commutes and where residents work" figure={glance("acs_mean_commute_minutes", "average commute")}><GettingAround name={name} level={region.level} levels={packet.levels} destinations={destinations} /></Fold>
        <Fold title="Schools, health and internet" note="Local services and community" figure={schools}><CommunityContext data={community} level={region.level} /></Fold>
        <Fold title="Flood risk" note="Risk and past claims" figure={glance("fema_flood_homes_share", "of homes in the 1% flood zone")}><FloodRisk name={name} levels={packet.levels} claims={flood.claims} paid={flood.paid} unplaced={flood.unplaced} newestYear={flood.newest} claimsPlace={flood.place} estimated={flood.place === null} unseparable={flood.unseparable} /></Fold>
        <Fold title="Ground and water" note="Drinking water and contaminated sites" figure={sitesFigure}><GroundAndWater name={name} levels={packet.levels} water={water} /></Fold>
        <Fold title="Utilities" note="Who serves the town" figure={electric ? { value: electric.provider, label: "electricity" } : null}><Utilities data={utilities} /></Fold>
      </section>

      <section id="compare" className={`${styles.section} ${styles.band}`} data-tone="compare">
        <h2>How it compares</h2>
        <PlaceComparisonRail name={name} peers={`${scopeName(peer_scope)} ${peerNoun(peer_level)}`} levels={packet.levels} uncertainties={uncertainties} reportHref={`${regionPath(regionId)}/report`} />
        <SimilarPlaces name={name} state={region.state_code} data={similar} />
        <ul className={styles.next}><li><Link href={`/compare${placesQuery([regionId])}`}>Compare {name} with another place</Link></li></ul>
      </section>

      <section id="stories" className={`${styles.section} ${styles.band}`} data-tone="stories">
        <h2>Stories about {name}</h2>
        <PlaceStoryGallery records={records} artifactUrl={artifactUrl} title="Read more" />
      </section>

      <footer className={styles.close}><Link href={`${regionPath(regionId)}/report`}>Full report: every figure, its history and sources</Link></footer>
    </main>
  </>;
}
