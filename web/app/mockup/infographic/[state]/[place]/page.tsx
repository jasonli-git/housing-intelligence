import Link from "next/link";
import { notFound } from "next/navigation";

import { GoDeeper } from "../../../GoDeeper";
import { OwnNumbers } from "../../../OwnNumbers";
import styles from "../../../poster.module.css";
import { Crumbs } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { similarGroups } from "@/lib/similar";
import { stateCrumbs } from "@/lib/states";
import { placesQuery } from "@/lib/compare";
import { api, regionsWithData } from "@/lib/api";
import { ownershipInputs } from "@/lib/budgetScenario";
import { costInputs } from "@/lib/costInputs";
import { formatMetric } from "@/lib/format";
import { regionTitle } from "@/lib/meta";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { eachMonth } from "@/lib/ownership";
import { comparisonMeasures } from "@/lib/placeComparisons";
import { placeRouteParams, regionPath, resolvePlace } from "@/lib/placeRoutes";
import { makePlaceStoryRecord, PLACE_STORIES, placeStoryHref, storyHistoryMetrics, summarizePlaceStory, type PlaceStorySummary, type PlaceStoryTopic } from "@/lib/placeStories";
import { stampPlaceStory } from "@/lib/placeStoryData";
import { loadFloodStory } from "@/lib/placeFloodStory";
import { TREND_METRICS } from "@/lib/trendMetrics";
import { marketDistribution } from "@/lib/marketPortrait";
import { marketPortraitData } from "@/lib/marketPortraitData";
import { projector, ringsOf, shapes } from "@/lib/storyMap";
import { ordinal } from "@/lib/ranks";
import { uncertaintiesFrom } from "@/lib/uncertainty";
import { verdictHeadline } from "@/lib/verdict";

const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
const STRIPS = [
  ["acs_median_hh_income", "Household income"],
  ["acs_mean_commute_minutes", "Commute"],
  ["fema_flood_homes_share", "Homes in flood zone"],
  ["acs_work_from_home_share", "Work from home"],
] as const;
const WORK = [
  ["lodes_work_same_town_share", "In town", "var(--series-1)"],
  ["lodes_work_home_county_share", "In county, with town", "var(--series-3)"],
  ["lodes_work_other_nj_share", "Elsewhere in NJ", "var(--series-2)"],
  ["lodes_work_nyc_share", "New York City", "var(--text-secondary)"],
  ["lodes_work_pennsylvania_share", "Pennsylvania", "var(--tick)"],
] as const;

/** A story's own rows as bars: shares on a 0–100% scale, counts against the largest. */
function StoryBars({ rows }: { rows: PlaceStorySummary["rows"] }) {
  const percent = rows.every((row) => row.formatted.endsWith("%"));
  const peak = Math.max(...rows.map((row) => row.value), 1);
  return <>{rows.map((row) => <div key={row.label} className={styles.storyBar}>
    <span>{row.label}</span>
    <div><i style={{ width: `${percent ? parseFloat(row.formatted) : (row.value / peak) * 100}%` }} /></div>
    <strong>{row.formatted}</strong>
  </div>)}</>;
}

export async function generateStaticParams() {
  return placeRouteParams(await regionsWithData());
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; place: string }> }) {
  const { state, place } = await params;
  const regionId = resolvePlace(state, place);
  const region = regionId === null ? null : await api.region(regionId);
  return { title: region ? `${regionTitle(region)} — Housing` : "Housing" };
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
  const high = Math.max(...recent);
  const area = recent.map((v, i) => `${(i / Math.max(recent.length - 1, 1)) * 600},${190 - (v / (high || 1)) * 180}`).join(" ");

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
    const below = cohort.points.filter((p) => p.value < own).length / cohort.points.length * 100;
    return [{ id: cohort.metricId, label: cohort.metricId === "zhvi_sfr" ? "Home value" : "Monthly rent", box, own, x, count: cohort.points.length, below }];
  });
  const stories = new Map(records.map((record) => [record.topic, summarizePlaceStory(record)]));
  const story = (topic: PlaceStoryTopic) => { const found = stories.get(topic); return found?.available ? found : null; };
  // Open cleanups have no published rank, so towns are compared per thousand homes here.
  const towns = (await api.regions(`state=${region.state_code}&level=municipality&limit=1000`))?.items ?? [];
  const batches = Array.from({ length: Math.ceil(towns.length / 100) }, (_, i) => towns.slice(i * 100, i * 100 + 100).map((t) => t.region_id));
  const townValues = async (id: string, period?: string) => period ? new Map((await Promise.all(batches.map((ids) => api.marketObservations(id, ids, period))))
    .flatMap((part) => part?.regions.flatMap((r) => r.series.map((p) => [r.region_id, p.value] as const)) ?? [])) : new Map<number, number>();
  const sitesRow = level("njdep_sites_open"), homesRow = level("acs_housing_units");
  const [siteCounts, homeCounts, similar] = await Promise.all([townValues("njdep_sites_open", sitesRow?.period_start), townValues("acs_housing_units", homesRow?.period_start), api.similarPlaces(regionId)]);
  const siteRates = [...siteCounts].flatMap(([id, n]) => (homeCounts.get(id) ?? 0) > 0 ? [(n / homeCounts.get(id)!) * 1000] : []).sort((a, b) => a - b);
  const siteRate = sitesRow && homesRow?.value ? (sitesRow.value / homesRow.value) * 1000 : null;
  const typicalSites = siteRates.length ? siteRates[Math.floor(siteRates.length / 2)] : null;

  const pct = (id: string, digits = 0) => { const v = level(id)?.value; return v === undefined ? null : `${(v * 100).toFixed(digits)}%`; };
  const reading = community?.districts.length === 1 ? community.districts[0].performance?.payload.indicators.find((i) => i.label.startsWith("English language arts")) : undefined;
  const fiber = community?.broadband_place?.payload;
  const uninsured = community?.health.find((h) => h.payload.measure === "ACCESS2")?.payload;
  const floodYears = [...flood.claims].slice(-10);
  const floodClaims = floodYears.reduce((sum, o) => sum + o.value, 0);
  const violations = water?.systems.reduce((sum, w) => sum + w.violations, 0) ?? null;
  const electric = utilities?.providers.find((p) => p.fuel === "electric")?.provider;
  const facts = [
    reading?.value != null && { value: `${reading.value.toFixed(0)}%`, label: "of students met English expectations" },
    fiber && fiber.locations > 0 && { value: `${((fiber.fiber / fiber.locations) * 100).toFixed(0)}%`, label: "of locations can get fiber" },
    pct("transit_any_homes_share") && { value: pct("transit_any_homes_share")!, label: "of homes near a transit stop" },
    flood.claims.length > 0 && { value: `${flood.estimated ? "~" : ""}${Math.round(floodClaims).toLocaleString("en-US")}`, label: `flood claims in ${flood.place ?? "town"}${flood.estimated ? " (estimated)" : ""}, ${floodYears.length} years on file` },
    siteRate !== null && { value: siteRate.toFixed(1), label: `open site cleanups per 1,000 homes${typicalSites !== null ? ` (typical town ${typicalSites.toFixed(1)})` : ""}` },
    violations !== null && { value: violations.toLocaleString("en-US"), label: `drinking-water violations, ${water?.first_year}–${water?.last_year}` },
    story("utilities")?.rows[0] && { value: story("utilities")!.rows[0].formatted, label: "without power per customer, utility-wide" },
    uninsured?.value != null && { value: `${uninsured.value.toFixed(0)}%`, label: `of adults 18–64 uninsured (county, ${uninsured.year})` },
  ].flatMap((fact) => (fact ? [fact] : []));
  const bedrooms = [["acs_share_0_1_bedrooms", "0–1 bed"], ["acs_share_2_bedrooms", "2 bed"], ["acs_share_3_bedrooms", "3 bed"], ["acs_share_4plus_bedrooms", "4+ bed"]].flatMap(([id, label], i) => { const v = level(id)?.value; return v ? [{ label, value: v * 100, color: ["var(--series-3)", "var(--series-1)", "var(--series-2)", "var(--text-secondary)"][i] }] : []; });
  const stock = [
    level("modiv_median_year_built") && { value: String(Math.round(level("modiv_median_year_built")!.value)), label: "typical year built" },
    level("modiv_median_lot_acres") && { value: level("modiv_median_lot_acres")!.value.toFixed(2), label: "acre median lot" },
    level("permits_total_units") && { value: level("permits_total_units")!.value.toLocaleString("en-US"), label: `homes permitted, ${level("permits_total_units")!.period_end.slice(0, 4)}` },
    level("nj_ah_prospective_need") && { value: level("nj_ah_prospective_need")!.value.toLocaleString("en-US"), label: "affordable homes in the prospective need" },
  ].flatMap((fact) => (fact ? [fact] : []));
  const q1 = level("sr1a_price_lower_quartile"), q3 = level("sr1a_price_upper_quartile"), medianSale = level("sr1a_median_sale_price"), salesCount = level("sr1a_sales_count");
  const movers = migration?.years.at(-1)?.net_per_1000 != null ? migration.years.filter((y) => y.net_per_1000 !== null) : [];
  const moverPeak = Math.max(...movers.map((y) => Math.abs(y.net_per_1000!)), 1);
  const taxBill = level("modiv_median_tax_bill"), taxRate = level("nj_effective_tax_rate");
  const taxBillMeasure = comparisonMeasures(packet.levels, uncertainties, ["modiv_median_tax_bill"])[0];
  const groups = similar ? similarGroups(similar) : [];
  const priceRow = similar ? groups.flatMap((g) => g.rows).find((r) => r.metric_id === similar.price) : undefined;
  const taxHref = `/tax?town=${region.geoid}`;
  // Measures outside the packet, read directly and set among every town's value.
  const latest = async (id: string) => (await api.observations(regionId, id))?.observations.at(-1) ?? null;
  const placed = async (id: string, label: string, show: (v: number) => string) => {
    const own = await latest(id);
    if (!own) return null;
    const all = [...(await townValues(id, own.period_start)).values()];
    const position = all.length ? (all.filter((v) => v < own.value).length + all.filter((v) => v === own.value).length / 2) / all.length : 0.5;
    return { id, label, value: show(own.value), position, raw: own.value };
  };
  const share = (v: number) => `${(v * 100).toFixed(0)}%`;
  const ground = (await Promise.all([
    placed("tree_canopy_homes_share", "Tree canopy over homes", share),
    placed("nlcd_impervious_homes_share", "Paved ground around homes", share),
    placed("noise_homes_share_55db", "Homes in 55 dB+ traffic noise", share),
    placed("lights_homes_radiance", "Night-time brightness", (v) => v.toFixed(1)),
    placed("elevation_homes_feet", "Height above sea level", (v) => `${Math.round(v)} ft`),
    placed("msft_median_footprint_sqft", "Typical house footprint", (v) => `${Math.round(v).toLocaleString("en-US")} sq ft`),
  ])).flatMap((item) => (item ? [item] : []));
  const groundLead = [...ground].sort((a, b) => Math.abs(b.position - 0.5) - Math.abs(a.position - 0.5))[0];
  const SHOPS = [["osm_starbucks_count", "Starbucks"], ["osm_dunkin_count", "Dunkin’"], ["osm_wawa_count", "Wawa"], ["osm_quickchek_count", "QuickChek"], ["osm_trader_joes_count", "Trader Joe’s"], ["osm_whole_foods_count", "Whole Foods"], ["osm_pizza_count", "Pizzerias"], ["osm_bagel_count", "Bagel shops"], ["osm_diner_count", "Diners"]];
  const shops = (await Promise.all(SHOPS.map(async ([id, label]) => ({ label, value: (await latest(id))?.value ?? 0 })))).filter((shop) => shop.value > 0);
  const eras = [["acs_share_built_pre_1940", "Before 1940"], ["acs_share_built_1940_1979", "1940–79"], ["acs_share_built_1980_1999", "1980–99"], ["acs_share_built_2000_later", "2000 on"]].flatMap(([id, label]) => { const v = level(id)?.value; return v !== undefined ? [{ label, value: v * 100 }] : []; });
  const eraLead = [...eras].sort((a, b) => b.value - a.value)[0];
  const kinds = [["acs_share_detached", "Detached houses"], ["acs_share_attached", "Attached"], ["acs_share_2_4_units", "2–4 units"], ["acs_share_5_19_units", "5–19 units"], ["acs_share_20plus_units", "20+ units"]].flatMap(([id, label]) => { const v = level(id)?.value; return v ? [{ label, value: v * 100 }] : []; });
  const bills = [["acs_median_electricity", "Electricity", 1], ["acs_median_gas", "Gas", 1], ["acs_median_water_sewer", "Water and sewer", 12]].flatMap(([id, label, per]) => { const v = level(id as string)?.value; return v ? [{ label: label as string, value: v / (per as number) }] : []; });
  const billTotal = bills.reduce((sum, b) => sum + b.value, 0);
  const passed = (mark: number) => obs.find((o) => o.value >= mark)?.period_end.slice(0, 4);
  const milestones = [500000, 1000000].flatMap((mark) => { const year = passed(mark); return year && year !== obs[0]?.period_end.slice(0, 4) ? [`passed ${dollars(mark)} in ${year}`] : []; });
  const perAcre = homeRow && level("modiv_median_lot_acres")?.value ? homeRow.value / level("modiv_median_lot_acres")!.value : null;
  const starter = level("zhvi_bottom_tier");
  const vacant = level("acs_vacancy_rate"), seasonal = level("acs_vacant_seasonal_share");
  // Every panel's title states its finding, from the same figures the picture draws.
  const asOf = (row?: { period_end: string }) => row ? new Date(`${row.period_end.slice(0, 7)}-15`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "";
  const homeBox = boxes.find((b) => b.id === "zhvi_sfr"), rentBox = boxes.find((b) => b.id !== "zhvi_sfr");
  const versusTypical = homeBox ? (homeBox.own / homeBox.box.median - 1) * 100 : null;
  const peers = `${region.state_code} ${peerNoun(peer_level)}`;
  const priceTitle = versusTypical === null ? "The typical home" : `${Math.abs(versusTypical).toFixed(0)}% ${versusTypical >= 0 ? "above" : "below"} the typical ${peers.replace(/ies$/, "y").replace(/s$/, "")}`;
  const boxTitle = homeBox ? (homeBox.below < 1 ? `The lowest home value of ${homeBox.count} ${peers}` : `Pricier than ${homeBox.below.toFixed(0)}% of ${peers}${rentBox ? `, and ${rentBox.below.toFixed(0)}% on rent` : ""}`) : "";
  const costTitle = month && rent ? (month.total >= rent ? `Owning costs ${(month.total / rent).toFixed(1)} times renting` : `Owning costs less than renting`) : "What owning costs each month";
  const incomeTitle = ownShare !== null ? `Owning takes ${ownShare.toFixed(0)}% of a typical income${rentShare !== null ? `, renting ${rentShare.toFixed(0)}%` : ""}` : "";
  const threePlus = (level("acs_share_3_bedrooms")?.value ?? 0) + (level("acs_share_4plus_bedrooms")?.value ?? 0);
  const elsewhere = level("lodes_work_same_town_share") ? (1 - level("lodes_work_same_town_share")!.value) * 100 : null;
  const countyRank = ranked.findIndex((t) => t.id === regionId);

  const storyLink = (topic: PlaceStoryTopic) => <Link href={placeStoryHref(topic, regionId)}>Full story</Link>;
  const pressureStory = story("pressure"), lendingStory = story("lending"), buildingStory = story("building");
  const STORY_GROUP: Record<string, string> = { market: "Money", sales: "Money", pressure: "Money", lending: "Money", building: "Homes", utilities: "Homes", water: "Surroundings", flood: "Surroundings", sites: "Surroundings", broadband: "Surroundings", commute: "People", migration: "People", schools: "People", health: "People" };
  const deepStories = records.flatMap(({ topic }) => { const found = story(topic); return found ? [{ topic, title: PLACE_STORIES[topic].title, headline: found.headline, source: found.source, href: placeStoryHref(topic, regionId), slug: PLACE_STORIES[topic].slug, group: STORY_GROUP[topic] ?? "Homes" }] : []; });

  const townFeature = townGeo?.features.find((f) => f.properties.region_id === regionId);
  const frame = countyGeo ? projector(countyGeo.features.flatMap((f) => ringsOf(f.geometry)), 180, 4) : null;
  const counties = countyGeo && frame ? shapes(countyGeo.features, 180, frame).shapes : [];
  const town = townFeature && frame ? shapes([townFeature], 180, frame).shapes[0] : null;

  return <>
    <Masthead affordability={{ kind: "route" }} simple />
    <main id="main-content" tabIndex={-1} className={styles.poster}>
      <p className={styles.flag}>Infographic mockup · <Link href={regionPath(regionId)}>current page</Link> · <Link href={`/mockup/${state}/${slug}`}>first mockup</Link></p>
      <Crumbs trail={[{ href: "/", label: "Home" }, ...stateCrumbs(region.state_code), ...(county ? [{ href: regionPath(county.region_id), label: displayName(county) }] : [])]} here={name} />
      <nav className={styles.topics} aria-label="On this page"><a href="#price">Price</a><a href="#cost">Cost</a><a href="#tax">Tax</a><a href="#ranks">Compared</a><a href="#living">Living here</a><a href="#homes">Homes</a><a href="#people">People</a><a href="#county">County</a><a href="#stories">Stories</a></nav>

      <header className={`${styles.panel} ${styles.hero}`}>
        <div>
          <p className={styles.kicker}>{county ? `${displayName(county)}, ` : ""}{scopeName(region.state_code)}{level("acs_population") ? ` · ${formatMetric(level("acs_population")!.value, "count", "acs_population")} residents` : ""}</p>
          <h1>{name}</h1>
          {headline && <p className={styles.headline}>{headline}</p>}
        </div>
        {frame && town && <svg viewBox={`0 0 ${frame.width} ${frame.height}`} role="img" aria-label={`${name} on a map of ${scopeName(region.state_code)}`}>
          {counties.map((c) => <path key={c.id} d={c.d} fill="currentColor" fillOpacity={c.id === county?.region_id ? 0.55 : 0.2} />)}
          <circle cx={town.centre[0]} cy={town.centre[1]} r="8" fill="var(--series-2)" stroke="var(--poster-hero)" strokeWidth="2" />
        </svg>}
      </header>

      {homeRow && <section id="price" className={`${styles.panel} ${styles.price}`}>
        <h2>The typical home, {priceTitle}</h2>
        <p className={styles.giant}>{formatMetric(homeRow.value, homeRow.unit, homeRow.metric_id)}</p>
        {recent.length > 1 && <svg className={styles.area} viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="Typical home value over the last ten years">
          <polygon points={`0,200 ${area} 600,200`} fill="currentColor" fillOpacity="0.16" />
          <polyline points={area} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>}
        <p className={styles.caption}>Last ten years, from $0 · {dollars(recent[0] ?? 0)} to {dollars(recent.at(-1) ?? 0)} · Zillow estimate, {asOf(homeRow)}{milestones.length ? ` · ${milestones.join(", ")}` : ""}</p>
        {medianSale && q1 && q3 && <div className={styles.sales}>
          <h3>What homes actually sold for</h3>
          <div className={styles.saleBar}><span><b>{dollars(q1.value)}</b>lower quarter</span><span><b>{dollars(medianSale.value)}</b>median</span><span><b>{dollars(q3.value)}</b>upper quarter</span></div>
          <p className={styles.caption}>{salesCount ? `${formatMetric(salesCount.value, "count", "sr1a_sales_count")} sales` : "Recent sales"}{level("sr1a_median_price_per_sqft") ? ` · ${dollars(level("sr1a_median_price_per_sqft")!.value)} per square foot` : ""}{starter ? ` · starter home ${dollars(starter.value)}` : ""}{perAcre ? ` · ${dollars(perAcre)} per acre of lot` : ""}</p>
        </div>}
      </section>}

      {boxes.length > 0 && <section className={`${styles.panel} ${styles.boxes}`}>
        <h2>{boxTitle}</h2>
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
        <p className={styles.caption}>Box: the middle half of towns. Line: the median. Ends: lowest and highest. Dot: {name}. Spacing is proportional, not linear. Zillow, {asOf(homeRow)}.</p>
      </section>}

      {month && <section id="cost" className={`${styles.panel} ${styles.cost}`}>
        <h2>{costTitle}</h2>
        <div className={styles.versus}>
          <div><span>Own</span><strong>{dollars(month.total)}</strong>
            <div className={styles.stack}>{parts.map((p) => <i key={p.label} title={`${p.label}: ${dollars(p.value)}`} style={{ flexGrow: p.value, background: p.color }} />)}</div></div>
          {rent !== null && <div><span>Rent</span><strong>{dollars(rent)}</strong>
            <div className={styles.stack} style={{ width: `${(rent / month.total) * 100}%` }}><i style={{ flexGrow: 1, background: "var(--text-secondary)" }} /></div></div>}
        </div>
        <ul className={styles.key}>{parts.map((p) => <li key={p.label}><i style={{ background: p.color }} />{p.label} {dollars(p.value)}</li>)}</ul>
        <p className={styles.caption}>{month.principal > 0 ? `About ${dollars(month.principal)} of owning goes into the home. ` : ""}An estimate, not a quote: 20% down at {cost!.rate.value.toFixed(2)}%, {homeRow ? "typical home and typical rental" : "at a recent sale price"}.</p>
        <details className={styles.tool}>
          <summary>Use your own numbers</summary>
          <OwnNumbers income={income} guideHref={`/guide?place=${regionId}`} source={{ state: region.state_code, price: cost!.home.value, ratePct: cost!.rate.value, taxYear: cost!.tax?.value ?? null, insuranceYear: cost!.insurance?.value ?? null, utilitiesMonth: cost!.utilities?.month ?? null, rentMonth: cost!.rent?.value ?? null }} />
        </details>
        <p className={styles.actions}><Link href={`/guide?place=${regionId}`}>Buyer’s guide</Link><Link href={`/afford?place=${regionId}&county=${county?.region_id ?? "all"}`}>Places within my budget</Link><Link href="/help">Housing help</Link></p>
      </section>}

      {ownShare !== null && <section className={`${styles.panel} ${styles.income}`}>
        <h2>{incomeTitle}</h2>
        {[["Owning", ownShare], ...(rentShare !== null ? [["Renting", rentShare]] : [])].map(([label, share]) => <div key={label as string} className={styles.meter}>
          <span>{label as string}</span>
          <div><i style={{ width: `${Math.min(share as number, 100)}%` }} /><b style={{ left: "30%" }} /></div>
          <strong>{(share as number).toFixed(0)}%</strong>
        </div>)}
        <p className={styles.caption}>The typical home against the median household income, not any one household. The mark is the common 30% guideline. Census ACS.</p>
      </section>}

      {taxBill && <section id="tax" className={`${styles.panel} ${styles.tax}`}>
        <h2>Property tax adds {dollars(taxBill.value / 12)} a month</h2>
        <p className={styles.giant}>{dollars(taxBill.value)}</p>
        <p className={styles.caption}>Median yearly bill{taxRate ? ` · ${taxRate.value.toFixed(2)}% effective rate` : ""}{taxBillMeasure ? ` · ${taxBillMeasure.row.rank}th of ${taxBillMeasure.row.of} towns` : ""}</p>
        <p className={styles.actions}><Link href={taxHref}>Look up a property</Link></p>
      </section>}

      {strips.length > 0 && <section id="ranks" className={`${styles.panel} ${styles.rank}`}>
        <h2>Among {scopeName(peer_scope)} {peerNoun(peer_level)}</h2>
        <p className={styles.caption}>Lowest on the left, highest on the right. A wide band means the survey can’t place it exactly.</p>
        {strips.map((s) => <div key={s.id} className={styles.strip}>
          <span>{s.label}</span>
          <div><u style={{ left: `${s.low * 100}%`, width: `${(s.high - s.low) * 100}%` }} /><i style={{ left: `${s.position * 100}%` }} /></div>
          <strong>{s.value}</strong>
        </div>)}
      </section>}

      {pressureStory && <section className={`${styles.panel} ${styles.pressure}`}>
        <h2>{pressureStory.headline}</h2>
        <StoryBars rows={pressureStory.rows} />
        <p className={styles.caption}>{pressureStory.source}, {pressureStory.period} · {storyLink("pressure")}</p>
      </section>}

      {lendingStory && <section className={`${styles.panel} ${styles.lending}`}>
        <h2>{lendingStory.headline}</h2>
        <StoryBars rows={lendingStory.rows} />
        <div className={styles.facts}>{[level("hmda_denial_rate") && { value: pct("hmda_denial_rate")!, label: "of applications denied" }, level("hmda_median_rate") && { value: `${level("hmda_median_rate")!.value.toFixed(2)}%`, label: "median mortgage rate" }, level("hmda_median_ltv") && { value: `${level("hmda_median_ltv")!.value.toFixed(0)}%`, label: "median loan-to-value" }].flatMap((fact) => (fact ? [fact] : [])).map((fact) => <div key={fact.label}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}</div>
        <p className={styles.caption}>{lendingStory.source}, {lendingStory.period} · {storyLink("lending")}</p>
      </section>}

      {facts.length > 0 && <section id="living" className={`${styles.panel} ${styles.living}`}>
        <h2>Living here</h2>
        <div className={styles.facts}>{facts.map((fact) => <div key={fact.label}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}</div>
        <p className={styles.caption}>{electric ? `Electricity: ${electric}. ` : ""}NJ Education, FCC, BTS, FEMA, NJDEP, EPA and CDC.</p>
      </section>}

      {(bedrooms.length > 0 || stock.length > 0) && <section id="homes" className={`${styles.panel} ${styles.homes}`}>
        <h2>{threePlus > 0 ? `${(threePlus * 100).toFixed(0)}% of homes have three or more bedrooms` : "The homes here"}</h2>
        {bedrooms.length > 0 && <><div className={styles.stack}>{bedrooms.map((b) => <i key={b.label} title={`${b.label}: ${b.value.toFixed(0)}%`} style={{ flexGrow: b.value, background: b.color }} />)}</div>
          <ul className={styles.key}>{bedrooms.map((b) => <li key={b.label}><i style={{ background: b.color }} />{b.label} {b.value.toFixed(0)}%</li>)}</ul></>}
        <div className={styles.facts}>{stock.map((fact) => <div key={fact.label}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}</div>
        {buildingStory && <div className={styles.building}><h3>{buildingStory.headline}</h3><StoryBars rows={buildingStory.rows} /><p className={styles.caption}>{buildingStory.source}, {buildingStory.period} · {storyLink("building")}</p></div>}
      </section>}

      {eras.length > 0 && <section className={`${styles.panel} ${styles.era}`}>
        <h2>{eraLead.value.toFixed(0)}% of homes date from {eraLead.label === "Before 1940" ? "before 1940" : eraLead.label === "2000 on" ? "2000 or later" : eraLead.label}</h2>
        <StoryBars rows={eras.map((e) => ({ label: e.label, value: e.value, formatted: `${e.value.toFixed(0)}%` }))} />
        {kinds.length > 0 && <><h3>Kinds of home</h3><StoryBars rows={kinds.map((k) => ({ label: k.label, value: k.value, formatted: `${k.value.toFixed(0)}%` }))} /></>}
        <p className={styles.caption}>Census ACS{vacant ? ` · ${pct("acs_vacancy_rate", 1)} of homes vacant${seasonal ? `, ${pct("acs_vacant_seasonal_share")} of those seasonal` : ""}` : ""}</p>
      </section>}

      {bills.length > 0 && <section className={`${styles.panel} ${styles.bills}`}>
        <h2>Utilities run about {dollars(billTotal)} a month</h2>
        <StoryBars rows={bills.map((b) => ({ label: b.label, value: b.value, formatted: dollars(b.value) }))} />
        <p className={styles.caption}>Typical bills for homes billed for each, Census ACS. Already counted in the cost to own.</p>
      </section>}

      {ground.length > 0 && <section className={`${styles.panel} ${styles.ground}`}>
        <h2>{groundLead.label}: {groundLead.position >= 0.5 ? "higher" : "lower"} than {Math.round(Math.max(groundLead.position, 1 - groundLead.position) * 100)}% of {peers}</h2>
        <p className={styles.caption}>Around the homes, lowest towns on the left, highest on the right.</p>
        {ground.map((g) => <div key={g.id} className={styles.strip}><span>{g.label}</span><div><i style={{ left: `${g.position * 100}%` }} /></div><strong>{g.value}</strong></div>)}
      </section>}

      {shops.length > 0 && <section className={`${styles.panel} ${styles.street}`}>
        <h2>On the map in {name}</h2>
        <div className={styles.facts}>{shops.map((shop) => <div key={shop.label}><strong>{shop.value}</strong><span>{shop.label}</span></div>)}</div>
        <p className={styles.caption}>Mapped in OpenStreetMap, so some may be missing.</p>
      </section>}

      {(work.length > 0 || owned !== null) && <section id="people" className={`${styles.panel} ${styles.people}`}>
        {owned !== null && <><h2>{(owned * 100).toFixed(0)}% of homes are owner-occupied</h2>
          <div className={styles.split}><i style={{ flexGrow: owned }}>{(owned * 100).toFixed(0)}% own</i><i style={{ flexGrow: 1 - owned }}>{((1 - owned) * 100).toFixed(0)}% rent</i></div></>}
        {work.length > 0 && <><h2>{elsewhere !== null ? `${elsewhere.toFixed(0)}% of residents work outside town` : "Where residents work"}</h2>
          {work.map((w) => <div key={w.label} className={styles.meter}><span>{w.label}</span><div><i style={{ width: `${w.value}%`, background: w.color }} /></div><strong>{w.value.toFixed(0)}%</strong></div>)}</>}
        {movers.length > 1 && <><h2>Moving in and out of {migration!.county_name} County</h2>
          <div className={styles.moves}>{movers.map((y) => <div key={y.year} title={`${y.year}: ${y.net_per_1000!.toFixed(1)} per 1,000 households`}><i data-gain={y.net_per_1000! > 0 || undefined} style={{ height: `${(Math.abs(y.net_per_1000!) / moverPeak) * 50}%` }} /><span>{String(y.year).slice(2)}</span></div>)}</div>
          <p className={styles.caption}>Net households per 1,000, by year · above the line, more arrived than left{migration!.arrivals[0] ? ` · most arrivals from ${migration!.arrivals[0].name}` : ""}</p></>}
      </section>}

      {ranked.length > 1 && county && <section id="county" className={`${styles.panel} ${styles.county}`}>
        <h2>{countyRank === 0 ? `The priciest of ${ranked.length} Zillow-covered towns in ${displayName(county)}` : `${ordinal(countyRank + 1)} of ${ranked.length} Zillow-covered towns in ${displayName(county)}`}</h2>
        {ranked.filter((t, i) => i < 6 || i >= ranked.length - 5 || t.id === regionId).map((t) => <div key={t.id} className={styles.townBar} data-own={t.id === regionId || undefined}>
          <span>{t.name}</span><div><i style={{ width: `${(t.value / ranked[0].value) * 100}%` }} /></div><strong>{dollars(t.value)}</strong>
        </div>)}
      </section>}

      {similar && similar.matches.length > 0 && priceRow && <section className={`${styles.panel} ${styles.similar}`}>
        <h2>{similar.matches.length} similar {similar.matches.length === 1 ? "town costs" : "towns cost"} at least {Math.round((1 - similar.cheaper_by) * 100)}% less</h2>
        <div className={styles.towns}>{similar.matches.map((m, i) => { const there = priceRow.values[i + 1], here = priceRow.values[0]; return <Link key={m.region_id} href={regionPath(m.region_id)}><strong>{m.name}</strong>{there !== null && <span>{dollars(there)}</span>}{there !== null && here !== null && <small>{dollars(here - there)} less</small>}</Link>; })}</div>
        <p className={styles.actions}><Link href={`/compare${placesQuery([regionId, ...similar.matches.slice(0, 3).map((m) => m.region_id)])}`}>Compare side by side</Link></p>
      </section>}

      {deepStories.length > 0 && <section id="stories" className={`${styles.panel} ${styles.stories}`}>
        <GoDeeper name={name} stories={deepStories} />
      </section>}

      <footer className={styles.close}>Sources: Zillow, Census Bureau, FEMA, NJ Division of Taxation. <Link href={`${regionPath(regionId)}/report`}>Every figure in the full report</Link> · <Link href="/sources">About the data</Link></footer>
    </main>
  </>;
}
