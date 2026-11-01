import Link from "next/link";
import { notFound } from "next/navigation";

import { GoDeeper } from "../../GoDeeper";
import { OwnNumbers } from "../../OwnNumbers";
import { CountyAtlas, type AtlasTown as AtlasTownRow } from "../../CountyAtlas";
import { PosterNav } from "../../PosterNav";
import styles from "../../poster.module.css";
import { ComputedBadge } from "@/components/ComputedBadge";
import { Crumbs } from "@/components/Crumbs";
import { ConsumerReading } from "@/components/ExplanationPanel";
import { Masthead } from "@/components/Masthead";
import { similarGroups } from "@/lib/similar";
import { stateCrumbs } from "@/lib/states";
import { placesQuery } from "@/lib/compare";
import { api, regionsWithData } from "@/lib/api";
import { focusedConsumerAnswer } from "@/lib/citations";
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
import { againstUsual } from "@/lib/persistence";
import { surveyYears } from "@/lib/periods";
import { loadFloodStory } from "@/lib/placeFloodStory";
import { TREND_METRICS } from "@/lib/trendMetrics";
import { marketDistribution } from "@/lib/marketPortrait";
import { marketPortraitData } from "@/lib/marketPortraitData";
import { arc, projector, ringsOf, shapes } from "@/lib/storyMap";
import { leadingDestination } from "@/lib/stories";
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

function MiniLine({ values, base }: { values: number[]; base?: number }) {
  const low = Math.min(...values, base ?? Infinity), high = Math.max(...values, base ?? -Infinity), span = high - low || 1;
  const y = (v: number) => 68 - ((v - low) / span) * 64;
  return <svg viewBox="0 0 200 72" preserveAspectRatio="none" aria-hidden="true">
    {base !== undefined && <line x1="0" x2="200" y1={y(base)} y2={y(base)} stroke="currentColor" strokeOpacity="0.4" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
    <polyline points={values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 200},${y(v)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function MiniBars({ values, recent = 1 }: { values: number[]; recent?: number }) {
  const low = Math.min(...values, 0), high = Math.max(...values, 0), span = high - low || 1, y = (v: number) => 70 - ((v - low) / span) * 68, w = 200 / Math.max(values.length, 1);
  return <svg viewBox="0 0 200 72" preserveAspectRatio="none" aria-hidden="true">
    {values.map((v, i) => <rect key={i} x={i * w} width={Math.max(w - 0.6, 0.6)} y={Math.min(y(v), y(0))} height={Math.max(Math.abs(y(v) - y(0)), 0.5)} fill={i >= values.length - recent ? "var(--series-2)" : "currentColor"} fillOpacity={i >= values.length - recent ? 1 : 0.5} />)}
  </svg>;
}

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

/** Places link to their mockups, so a reader can move around without leaving the trial. */
const mockupPath = (id: number | string) => `/mockup${regionPath(id)}`;

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

  // A ZIP code crosses town lines, so its county comes from the migration crosswalk.
  const isZip = region.level === "zip";
  const zipCounty = isZip ? (await api.migration(regionId))?.county_id : undefined;
  // On a county's own page the county is the place itself, so its panels are not "context".
  const isCounty = region.level === "county";
  const county = isCounty ? region : region.ancestors.find((a) => a.level === "county") ?? (zipCounty ? await api.region(zipCounty) : null);
  const unitWord = isZip ? "ZIP code" : isCounty ? "county" : "town";
  const unitPlural = isCounty ? "counties" : `${unitWord}s`;
  const [cost, history, countyGeo, townGeo, siblings] = await Promise.all([
    costInputs(region.state_code, region.level, packet.levels, packet.metrics),
    api.observations(regionId, "zhvi_sfr"),
    api.geo("county", region.state_code, 0.002),
    api.geo("municipality", region.state_code, 0.0005),
    county && !isZip ? api.regions(`level=municipality&parent_id=${county.region_id}&limit=1000`) : null,
  ]);
  const name = displayName(region);
  const uncertainties = uncertaintiesFrom(summary);

  // The model's reading is allowed to be absent, as on the current page: no reading, no panel.
  const explanations = await api.explanations(regionId, "5y");
  const consumer = explanations?.explanations?.find((r) => r.audience === "consumer") ?? null;
  const hasReading = !!consumer?.sections?.length && !!focusedConsumerAnswer(consumer.body, consumer.sections, consumer.binding ?? null, "what_stands_out").answer;
  const readingPanel = hasReading ? <section id="reading" className={`${styles.panel} ${styles.reading}`}>
    <ConsumerReading reading={consumer} section="what_stands_out" heading="What stands out" headingLevel={3} headingHidden paperNote />
  </section> : null;
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
  const towns = (await api.regions(`state=${region.state_code}&level=${region.level}&limit=1000`))?.items ?? [];
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
  const violations = water?.systems.reduce((sum, w) => sum + w.violations, 0) ?? null;
  const electric = utilities?.providers.find((p) => p.fuel === "electric")?.provider;
  const facts = [
    fiber && fiber.locations > 0 && { value: `${((fiber.fiber / fiber.locations) * 100).toFixed(0)}%`, label: "of locations can get fiber" },
    pct("transit_any_homes_share") && { value: pct("transit_any_homes_share")!, label: "of homes near a transit stop" },
    siteRate !== null && { value: siteRate.toFixed(1), label: `open site cleanups per 1,000 homes${typicalSites !== null ? ` (typical ${unitWord} ${typicalSites.toFixed(1)})` : ""}` },
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
  // The same $500,000 house at each town's effective rate. Rates above 6 are the mutual
  // housing towns, whose small assessments are no guide to a house bought outright.
  const HOUSE = 500_000;
  const billFor = (rate: number) => (rate / 100) * HOUSE;
  const rates = new Map([...(await townValues("nj_effective_tax_rate", taxRate?.period_start))].filter(([, rate]) => rate > 0 && rate <= 6));
  const stateRates = [...rates.values()].sort((a, b) => a - b);
  // Counties compare among counties, so a county's own towns are read separately.
  const ownTownRates = isCounty && taxRate ? new Map((await Promise.all(Array.from({ length: Math.ceil(countyTowns.length / 100) }, (_, i) => api.marketObservations("nj_effective_tax_rate", countyTowns.slice(i * 100, i * 100 + 100).map((t) => t.region_id), taxRate.period_start))))
    .flatMap((part) => part?.regions.flatMap((r) => r.series.map((p) => [r.region_id, p.value] as const)) ?? [])) : rates;
  const countyRates = countyTowns.flatMap((t) => { const rate = ownTownRates.get(t.region_id); if (rate !== undefined && (rate <= 0 || rate > 6)) return []; return rate === undefined ? [] : [{ id: t.region_id, name: displayName(t), rate }]; }).sort((a, b) => a.rate - b.rate);
  const sameHouseRows = taxRate && taxRate.value <= 6 && stateRates.length ? [
    { key: "own", label: name, rate: taxRate.value, own: true },
    ...(countyRates.length > 1 && countyRates[0].id !== regionId ? [{ key: "low", label: `${countyRates[0].name}, lowest in county`, rate: countyRates[0].rate, own: false }] : []),
    ...(countyRates.length > 1 && countyRates.at(-1)!.id !== regionId ? [{ key: "high", label: `${countyRates.at(-1)!.name}, highest in county`, rate: countyRates.at(-1)!.rate, own: false }] : []),
    { key: "state", label: `Typical NJ ${unitWord}`, rate: stateRates[Math.floor(stateRates.length / 2)], own: false },
  ] : [];
  const sameHousePeak = Math.max(...sameHouseRows.map((row) => row.rate), 0.01);
  const ratio = level("nj_director_ratio")?.value ?? null;
  const assessment = ratio === null ? null : ratio >= 95 ? "current" : ratio >= 85 ? "slipping" : "overdue";
  const revaluedIn = (await latest("nj_revaluation_year"))?.value ?? null;
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
  const homeShare = level(isCounty ? "lodes_work_home_county_share" : "lodes_work_same_town_share");
  const elsewhere = homeShare ? (1 - homeShare.value) * 100 : null;
  const countyRank = ranked.findIndex((t) => t.id === regionId);

  const storyLink = (topic: PlaceStoryTopic) => <Link href={placeStoryHref(topic, regionId)}>Full story</Link>;
  const pressureStory = story("pressure"), lendingStory = story("lending"), buildingStory = story("building");
  const STORY_GROUP: Record<string, string> = { market: "Money", sales: "Money", pressure: "Money", lending: "Money", building: "Homes", utilities: "Homes", water: "Surroundings", flood: "Surroundings", sites: "Surroundings", broadband: "Surroundings", commute: "People", migration: "People", schools: "People", health: "People" };
  const deepStories = records.flatMap(({ topic }) => { const found = story(topic); return found ? [{ topic, title: PLACE_STORIES[topic].title, headline: found.headline, source: found.source, href: placeStoryHref(topic, regionId), slug: PLACE_STORIES[topic].slug, group: STORY_GROUP[topic] ?? "Homes" }] : []; });

  const placeGeo = isZip ? await api.geo("zip", region.state_code, 0.0005) : isCounty ? countyGeo : townGeo;
  const townFeature = placeGeo?.features.find((f) => f.properties.region_id === regionId);
  const frame = countyGeo ? projector(countyGeo.features.flatMap((f) => ringsOf(f.geometry)), 180, 4) : null;
  const counties = countyGeo && frame ? shapes(countyGeo.features, 180, frame).shapes : [];
  const town = townFeature && frame ? shapes([townFeature], 180, frame).shapes[0] : null;

  // Where students go: the survey counts by where children live, so charter, vocational and
  // choice schools sit inside "public". District results are shown only where one covers the town.
  const privateShare = level("acs_k12_private_share")?.value ?? null;
  const stages = [["acs_k8_private_share", "Kindergarten to grade 8"], ["acs_hs_private_share", "Grades 9 to 12"]].flatMap(([id, label]) => { const row = level(id); return row ? [{ id, label, value: row.value * 100, margin: uncertainties.value.get(id)?.margin ?? null }] : []; });
  const districts = (community?.districts ?? []).map((d) => ({ name: d.boundary.payload.name, share: d.boundary.payload.approximate_share }));
  const results = community?.districts.length === 1 ? (community.districts[0].performance?.payload.indicators ?? []).filter((i) => i.value !== null) : [];
  const resultYear = community?.districts[0]?.performance?.payload.school_year;

  // Winter-empty homes: shown only where seasonal homes are a real share of the town.
  const seasonalHomes = vacant && seasonal ? vacant.value * seasonal.value : 0;
  const homeDots = Array.from({ length: 100 }, (_, i) => {
    const year = Math.round((1 - (vacant?.value ?? 0)) * 100), held = Math.round(seasonalHomes * 100);
    return i < year ? "lived" : i < year + held ? "seasonal" : "empty";
  });

  // Income and home value: every town on one log-log chart, where each multiple is a straight line.
  const incomeRow = level("acs_median_hh_income"), valueRow = level("acs_median_home_value");
  const [townIncomes, townValuesAcs] = await Promise.all([townValues("acs_median_hh_income", incomeRow?.period_start), townValues("acs_median_home_value", valueRow?.period_start)]);
  const pairs = [...townIncomes].flatMap(([id, inc]) => { const val = townValuesAcs.get(id); return inc > 0 && val && val > 0 ? [{ id, income: inc, value: val }] : []; });
  const multiple = incomeRow && valueRow && incomeRow.value > 0 ? valueRow.value / incomeRow.value : null;
  const SW = 640, SH = 340, SL = 58, SB = 28, ST = 10, SR = 12;
  const logRange = (values: number[]) => [Math.log(Math.min(...values) * 0.95), Math.log(Math.max(...values) * 1.05)] as const;
  const [x0, x1] = pairs.length ? logRange(pairs.map((p) => p.income)) : [0, 1];
  const [y0, y1] = pairs.length ? logRange(pairs.map((p) => p.value)) : [0, 1];
  const sx = (v: number) => SL + ((Math.log(v) - x0) / (x1 - x0)) * (SW - SL - SR);
  const sy = (v: number) => SH - SB - ((Math.log(v) - y0) / (y1 - y0)) * (SH - SB - ST);
  const surveyPeriod = incomeRow ? surveyYears(incomeRow.period_start, incomeRow.period_end) : "";
  const moneyTick = (v: number) => (v >= 1e6 ? `$${v / 1e6}M` : `$${v / 1e3}K`);
  const xTicks = [50000, 100000, 200000, 400000].filter((v) => Math.log(v) > x0 && Math.log(v) < x1);
  const yTicks = [200000, 500000, 1000000, 2000000].filter((v) => Math.log(v) > y0 && Math.log(v) < y1);
  const multipleLine = (k: number) => { const a = Math.max(Math.exp(x0), Math.exp(y0) / k), b = Math.min(Math.exp(x1), Math.exp(y1) / k); return { a, b, k }; };
  const lessThanHere = multiple !== null && pairs.length ? (pairs.filter((p) => p.value / p.income < multiple).length / pairs.length) * 100 : null;

  // How long homes sit: published by county, so a town reads its county's market. Each month
  // is set against the county's own usual wait, and the latest against other counties.
  const domSeries = county ? (await api.observations(county.region_id, "realtor_median_days_on_market"))?.observations ?? [] : [];
  const domNow = domSeries.at(-1);
  const domSorted = domSeries.map((o) => o.value).sort((a, b) => a - b);
  const domUsual = domSorted.length ? domSorted[Math.floor(domSorted.length / 2)] : null;
  const domYearAgo = domNow ? domSeries.find((o) => o.period_end.slice(0, 7) === `${Number(domNow.period_end.slice(0, 4)) - 1}${domNow.period_end.slice(4, 7)}`) : undefined;
  const countyWaits = domNow ? (await Promise.all((countyGeo?.features ?? []).map(async (f) => (await api.observations(f.properties.region_id, "realtor_median_days_on_market"))?.observations.at(-1)))).flatMap((o) => (o && o.period_end === domNow.period_end ? [o.value] : [])).sort((a, b) => a - b) : [];
  const domRank = domNow ? countyWaits.findIndex((v) => v >= domNow.value) + 1 : 0;
  const DW = 640, DH = 220, DL = 34, DB = 24;
  const domPeak = Math.max(...domSeries.map((o) => o.value), 1);
  const dx = (i: number) => DL + (i / Math.max(domSeries.length - 1, 1)) * (DW - DL - 8);
  const dy = (v: number) => DH - DB - (v / domPeak) * (DH - DB - 8);
  const domYears = domSeries.flatMap((o, i) => (o.period_end.slice(5, 7) === "01" && Number(o.period_end.slice(0, 4)) % 2 === 0 ? [{ year: o.period_end.slice(0, 4), i }] : []));
  const domGap = domNow && domUsual ? domNow.value - domUsual : 0;

  // Summer heat: by county, against the thirty years from 1951 as the story does.
  const heatFor = async (id: number) => (await api.observations(id, "nclimgrid_days_over_90"))?.observations ?? [];
  const yearOf = (o: { period_end: string }) => Number(o.period_end.slice(0, 4));
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1);
  const heatRecent = (rows: { period_end: string; value: number }[]) => mean(rows.slice(-10).map((o) => o.value));
  const heatSeries = county ? await heatFor(county.region_id) : [];
  const heatBase = mean(heatSeries.filter((o) => yearOf(o) <= 1980).map((o) => o.value));
  const heatNow = heatRecent(heatSeries);
  const allHeat = heatSeries.length ? (await Promise.all((countyGeo?.features ?? []).map(async (f) => heatRecent(await heatFor(f.properties.region_id))))).filter((v) => v > 0).sort((a, b) => b - a) : [];
  const heatRank = allHeat.findIndex((v) => v <= heatNow) + 1;
  const HW = 640, HH = 200, HB = 24, HL = 30;
  const heatPeak = Math.max(...heatSeries.map((o) => o.value), 1);
  const hy = (v: number) => HH - HB - (v / heatPeak) * (HH - HB - 8);
  const barW = (HW - HL) / Math.max(heatSeries.length, 1);

  // Is today unusual: prices against incomes, against the county's own history. A county
  // figure, withheld by the source where the series is too thin.
  const countyHistory = county ? await api.persistence(county.region_id) : null;
  const persistence = countyHistory && !countyHistory.withheld && countyHistory.vs_median !== null && countyHistory.series.length > 5 ? countyHistory : null;
  const UW = 640, UH = 200, UP = 24;
  const uSpan = persistence ? Math.max(...persistence.series.map((p) => Math.abs(p.vs_median)), 1) : 1;
  const uStep = persistence ? (UW - UP * 2) / (persistence.last_year - persistence.first_year + 1) : 1;
  const uY = (v: number) => (UH - 24) / 2 - (v / uSpan) * ((UH - 24) / 2 - 8);

  const contextFacts = [
    domNow && `${Math.round(domNow.value)} days to sell`,
    heatSeries.length > 20 && `${Math.round(heatNow)} days over 90°F`,
    persistence && `${againstUsual(persistence.vs_median!)} usual prices`,
    movers.length > 1 && `${movers.at(-1)!.net_per_1000! > 0 ? "+" : ""}${movers.at(-1)!.net_per_1000!.toFixed(1)} net moves per 1,000`,
  ].flatMap((fact) => (fact ? [fact] : []));

  // The workday: where residents' jobs are, as lines from the town on the state's map.
  const WORK_W = 340;
  const workFrame = countyGeo ? projector(countyGeo.features.flatMap((f) => ringsOf(f.geometry)), WORK_W, 8) : null;
  const workCounties = countyGeo && workFrame ? shapes(countyGeo.features, WORK_W, workFrame).shapes : [];
  const townCentre = townFeature && workFrame ? shapes([townFeature], WORK_W, workFrame).shapes[0].centre : null;
  const outside = (destinations?.destinations ?? []).filter((d) => d.region_id !== regionId);
  const leadPlace = destinations ? leadingDestination(destinations.destinations, regionId) : null;
  const FIXED: Record<string, [number, number]> = { "New York City": [-73.98, 40.72], Philadelphia: [-75.16, 39.95] };
  const workBars = outside.slice(0, 6);
  const workPeak = Math.max(...workBars.map((d) => d.share), 0.01);
  const workLines = workFrame && townCentre ? workBars.flatMap((d) => {
    const feature = d.region_id ? townGeo?.features.find((f) => f.properties.region_id === d.region_id) : undefined;
    const to = feature ? shapes([feature], WORK_W, workFrame).shapes[0].centre : FIXED[d.name] ? workFrame.point(FIXED[d.name]) : null;
    return to ? [{ name: d.name, d: arc(townCentre, to), to, weight: 1 + (d.share / workPeak) * 3 }] : [];
  }) : [];

  // A county page leads with its towns: every one, by what has actually sold, so towns
  // Zillow does not cover still count.
  const readTowns = async (id: string, row?: { period_start: string }) => (isCounty && row ? new Map((await Promise.all(Array.from({ length: Math.ceil(countyTowns.length / 100) }, (_, i) => api.marketObservations(id, countyTowns.slice(i * 100, i * 100 + 100).map((t) => t.region_id), row.period_start))))
    .flatMap((part) => part?.regions.flatMap((r) => r.series.map((p) => [r.region_id, p.value] as const)) ?? [])) : new Map<number, number>());
  const [townSales, townIncomes2, townCommutes, townFlood] = await Promise.all([readTowns("sr1a_median_sale_price", level("sr1a_median_sale_price")), readTowns("acs_median_hh_income", incomeRow), readTowns("acs_mean_commute_minutes", level("acs_mean_commute_minutes")), readTowns("fema_flood_homes_share", level("fema_flood_homes_share"))]);
  const homeByTown = new Map(ranked.map((t) => [t.id, t.value]));
  const townRows: AtlasTownRow[] = isCounty ? countyTowns.map((t) => ({ commute: townCommutes.get(t.region_id) ?? null, flood: townFlood.get(t.region_id) ?? null, id: t.region_id, name: countyTowns.filter((o) => displayName(o) === displayName(t)).length > 1 && t.name_lsad ? t.name_lsad.replace(/^./, (c) => c.toUpperCase()) : displayName(t), href: mockupPath(t.region_id), sale: townSales.get(t.region_id) ?? null, value: homeByTown.get(t.region_id) ?? null, tax: ownTownRates.get(t.region_id) ?? null, income: townIncomes2.get(t.region_id) ?? null })) : [];
  const bySale = townRows.filter((t) => t.sale !== null).sort((a, b) => b.sale! - a.sale!);
  const byTax = townRows.filter((t) => t.tax !== null && t.tax > 0 && t.tax <= 6).sort((a, b) => a.tax! - b.tax!);
  const byIncome = townRows.filter((t) => t.income !== null).sort((a, b) => a.income! - b.income!);
  const townRanges = [
    bySale.length > 1 && { label: "Recent sale", low: dollars(bySale.at(-1)!.sale!), lowName: bySale.at(-1)!.name, high: dollars(bySale[0].sale!), highName: bySale[0].name },
    byTax.length > 1 && { label: "Tax rate", low: `${byTax[0].tax!.toFixed(2)}%`, lowName: byTax[0].name, high: `${byTax.at(-1)!.tax!.toFixed(2)}%`, highName: byTax.at(-1)!.name },
    byIncome.length > 1 && { label: "Household income", low: dollars(byIncome[0].income!), lowName: byIncome[0].name, high: dollars(byIncome.at(-1)!.income!), highName: byIncome.at(-1)!.name },
  ].flatMap((range) => (range ? [range] : []));

  // Town prices across the county: darker is dearer, by rank, so one costly town cannot wash out the rest.
  const countyIds = new Set(countyTowns.map((t) => t.region_id));
  const countyFeatures = townGeo?.features.filter((f) => countyIds.has(f.properties.region_id)) ?? [];
  const countyFrame = countyFeatures.length ? projector(countyFeatures.flatMap((f) => ringsOf(f.geometry)), 360, 6) : null;
  const countyShapes = countyFrame ? shapes(countyFeatures, 360, countyFrame).shapes : [];
  const shadeOrder = isCounty ? bySale : ranked;
  const priceShade = (id: number) => { const i = shadeOrder.findIndex((t) => t.id === id); return i < 0 ? null : 1 - (i / Math.max(shadeOrder.length - 1, 1)) * 0.8; };

  // Rent by size, from the survey's gross rents.
  const rentSizes = [["acs_median_rent_studio", "Studio"], ["acs_median_rent_1br", "1 bedroom"], ["acs_median_rent_2br", "2 bedrooms"], ["acs_median_rent_3br", "3 bedrooms"], ["acs_median_rent_4br", "4+ bedrooms"]].flatMap(([id, label]) => { const row = level(id); return row ? [{ label, value: row.value, formatted: dollars(row.value) }] : []; });

  // Home values, rent and income from one starting date, indexed so unlike units share an axis.
  const GROWTH = [["zhvi_sfr", "Home value", "var(--series-1)"], ["zori_all", "Rent", "var(--series-2)"], ["acs_median_hh_income", "Income", "var(--series-3)"]] as const;
  const growthRows = GROWTH.flatMap(([id, label, color]) => { const rows = series.find((item) => item.metricId === id)?.observations ?? []; return rows.length >= 2 ? [{ label, color, rows }] : []; });
  const growthStart = growthRows.length > 1 ? growthRows.map((g) => g.rows[0].period_end).sort().at(-1)! : null;
  const growthSeries = growthStart ? growthRows.flatMap((g) => {
    const rows = g.rows.filter((o) => o.period_end >= growthStart);
    return rows.length >= 2 && rows[0].value > 0 ? [{ ...g, points: rows.map((o) => ({ time: Date.parse(o.period_end), index: (o.value / rows[0].value) * 100 })) }] : [];
  }) : [];
  const GW = 640, GH = 240, GL = 40, GR = 124, GT = 12, GB = 24;
  const growthTimes = growthSeries.flatMap((g) => g.points.map((p) => p.time));
  const growthHigh = Math.max(...growthSeries.flatMap((g) => g.points.map((p) => p.index)), 100);
  const growthLow = Math.min(...growthSeries.flatMap((g) => g.points.map((p) => p.index)), 100);
  const gx = (time: number) => GL + ((time - Math.min(...growthTimes)) / Math.max(Math.max(...growthTimes) - Math.min(...growthTimes), 1)) * (GW - GL - GR);
  const gy = (index: number) => GH - GB - ((index - growthLow) / Math.max(growthHigh - growthLow, 1)) * (GH - GB - GT);
  const growthLeader = [...growthSeries].sort((a, b) => b.points.at(-1)!.index - a.points.at(-1)!.index)[0];

  // Flood claims by year, with years of no claim drawn as zero. The newest year is still filling.
  const floodByYear = new Map(flood.claims.map((o) => [Number(o.period_end.slice(0, 4)), o.value]));
  const floodEnd = flood.newest ?? Math.max(...floodByYear.keys(), 0);
  const floodBars = floodByYear.size ? Array.from({ length: 20 }, (_, i) => { const year = floodEnd - 19 + i; return { year, value: floodByYear.get(year) ?? 0 }; }) : [];
  const floodPeak = Math.max(...floodBars.map((bar) => bar.value), 1);

  // How residents get to work; the remainder is everything the survey groups as other.
  const modes = [["acs_commute_drove_alone_share", "Drive alone", "var(--series-1)"], ["acs_commute_transit_share", "Transit", "var(--series-2)"], ["acs_commute_walked_share", "Walk", "var(--series-3)"], ["acs_work_from_home_share", "Work from home", "var(--text-secondary)"]].flatMap(([id, label, color]) => { const v = level(id)?.value; return v !== undefined ? [{ label, color, value: v * 100 }] : []; });
  const modeOther = Math.max(100 - modes.reduce((sum, m) => sum + m.value, 0), 0);

  const navLinks = ([
    ["reading", "AI highlights", hasReading], ["price", "Home prices", !!homeRow], ["cost", "Monthly costs", !!month], ["tax", "Property tax", !!taxBill], ["ranks", "Compared to NJ", strips.length > 0],
    ["affordability", "Affordability", !!pressureStory], ["living", "Daily life", facts.length > 0], ["workday", "Jobs & schools", workBars.length > 0 || privateShare !== null],
    ["county-context", isCounty ? "Market trends" : "County trends", contextFacts.length > 0], ["surroundings", "Surroundings", ground.length > 0], ["county", isCounty ? "Its towns" : "Nearby towns", isCounty ? townRows.length > 1 : ranked.length > 1], ["stories", "Stories", deepStories.length > 0],
  ] as const).filter(([, , shown]) => shown).map(([id, label]) => ({ id, label }));
  // The towns come first on a county page, so their link does too.
  const orderedLinks = isCounty ? [...navLinks.filter((l) => l.id === "reading" || l.id === "county"), ...navLinks.filter((l) => l.id !== "reading" && l.id !== "county")] : navLinks;

  const townsPanel = ranked.length > 1 && county ? <section id="county" className={`${styles.panel} ${styles.county}`}>
        <h2>{countyRank === 0 ? `The priciest of ${ranked.length} Zillow-covered towns in ${displayName(county)}` : `${ordinal(countyRank + 1)} of ${ranked.length} Zillow-covered towns in ${displayName(county)}`}</h2>
        {countyFrame && <svg className={styles.countyMap} viewBox={`0 0 ${countyFrame.width} ${countyFrame.height}`} role="img" aria-label={`Towns in ${displayName(county)} shaded by typical home value, with ${name} outlined.`}>
          {countyShapes.map((shape) => { const shade = priceShade(shape.id); return <path key={shape.id} d={shape.d} fill={shade === null ? "currentColor" : "var(--series-1)"} fillOpacity={shade ?? 0.12} stroke="var(--county-line)" strokeWidth="0.75"><title>{shape.name}</title></path>; })}
          {countyShapes.filter((shape) => shape.id === regionId).map((shape) => <path key="own" d={shape.d} fill="none" stroke="var(--series-2)" strokeWidth="2.5" />)}
        </svg>}
        {countyFrame && <p className={styles.caption}>Darker towns cost more. Faint towns have no Zillow figure.</p>}
        {ranked.filter((t, i) => i < 6 || i >= ranked.length - 5 || t.id === regionId).map((t) => <div key={t.id} className={styles.townBar} data-own={t.id === regionId || undefined}>
          <span>{t.name}</span><div><i style={{ width: `${(t.value / ranked[0].value) * 100}%` }} /></div><strong>{dollars(t.value)}</strong>
        </div>)}
      </section> : null;

  // A county is the same infographic at a smaller scale: the colour panels of a town poster,
  // packed into a grid of short cards around one working map of its towns.
  if (isCounty) {
    const countyLinks = orderedLinks.filter((l) => ["reading", "county", "price", "cost", "tax", "ranks", "county-context", "affordability", "workday", "stories"].includes(l.id));
    return <>
      <Masthead affordability={{ kind: "route" }} simple />
      <main id="main-content" tabIndex={-1} className={`${styles.poster} ${styles.compact}`}>
        <Crumbs trail={[{ href: "/", label: "Home" }, ...stateCrumbs(region.state_code)]} here={name} />
        <PosterNav links={countyLinks} />

        <header className={`${styles.panel} ${styles.hero}`}>
          <div>
            <p className={styles.kicker}>{scopeName(region.state_code)}{level("acs_population") ? ` · ${formatMetric(level("acs_population")!.value, "count", "acs_population")} residents` : ""} · {townRows.length} towns</p>
            <h1>{name}</h1>
            {headline && <p className={styles.headline}>{headline}</p>}
            <ComputedBadge />
          </div>
          {frame && town && <svg viewBox={`0 0 ${frame.width} ${frame.height}`} role="img" aria-label={`${name} on a map of ${scopeName(region.state_code)}`}>
            {counties.map((c) => <path key={c.id} d={c.d} fill="currentColor" fillOpacity={c.id === regionId ? 1 : 0.2} />)}
          </svg>}
        </header>

        {readingPanel}

        {countyFrame && <section id="county" className={`${styles.panel} ${styles.county}`}>
          <h2>Its {townRows.length} towns</h2>
          {townRanges.length > 0 && <div className={styles.ranges}>{townRanges.map((range) => <div key={range.label}><span>{range.label}</span><strong>{range.low} – {range.high}</strong><small>{range.lowName} to {range.highName}</small></div>)}</div>}
          <CountyAtlas name={name} width={countyFrame.width} height={countyFrame.height} shapes={countyShapes.map(({ id, d }) => ({ id, d }))} towns={townRows} />
        </section>}

        {homeRow && <section id="price" className={`${styles.panel} ${styles.price}`}>
          <h2>The typical home, {priceTitle}</h2>
          <p className={styles.giant}>{formatMetric(homeRow.value, homeRow.unit, homeRow.metric_id)}</p>
          {recent.length > 1 && <svg className={styles.area} viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="Typical home value over the last ten years">
            <polygon points={`0,200 ${area} 600,200`} fill="currentColor" fillOpacity="0.16" />
            <polyline points={area} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </svg>}
          <p className={styles.caption}>Last ten years, from {dollars(recent[0] ?? 0)}. Zillow, {asOf(homeRow)}</p>
          {medianSale && q1 && q3 && <div className={styles.sales}>
            <div className={styles.saleBar}><span><b>{dollars(q1.value)}</b>lower quarter</span><span><b>{dollars(medianSale.value)}</b>median sale</span><span><b>{dollars(q3.value)}</b>upper quarter</span></div>
            <p className={styles.caption}>{salesCount ? `${formatMetric(salesCount.value, "count", "sr1a_sales_count")} recent sales` : "Recent sales"}{level("sr1a_median_price_per_sqft") ? ` · ${dollars(level("sr1a_median_price_per_sqft")!.value)} per square foot` : ""}{starter ? ` · starter home ${dollars(starter.value)}` : ""}</p>
          </div>}
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
          <p className={styles.caption}>An estimate, with 20% down at {cost!.rate.value.toFixed(2)}%.</p>
          <details className={styles.tool}>
            <summary>Use your own numbers</summary>
            <OwnNumbers income={income} guideHref={`/guide?place=${regionId}`} source={{ state: region.state_code, price: cost!.home.value, ratePct: cost!.rate.value, taxYear: cost!.tax?.value ?? null, insuranceYear: cost!.insurance?.value ?? null, utilitiesMonth: cost!.utilities?.month ?? null, rentMonth: cost!.rent?.value ?? null }} />
          </details>
          <p className={styles.actions}><Link href={`/guide?place=${regionId}`}>Buyer’s guide</Link><Link href={`/afford?place=${regionId}&county=${regionId}`}>Places within my budget</Link><Link href="/help">Housing help</Link></p>
        </section>}

        {taxBill && <section id="tax" className={`${styles.panel} ${styles.tax}`}>
          <h2>Property tax adds {dollars(taxBill.value / 12)} a month</h2>
          <p className={styles.giant}>{dollars(taxBill.value)}</p>
          <p className={styles.caption}>Median yearly bill{taxRate ? ` · ${taxRate.value.toFixed(2)}% effective rate` : ""}{taxBillMeasure ? ` · ${ordinal(taxBillMeasure.row.rank!)} highest of ${taxBillMeasure.row.of}` : ""}</p>
        </section>}

        {strips.length > 0 && <section id="ranks" className={`${styles.panel} ${styles.rank}`}>
          <h2>Among {scopeName(peer_scope)} {peerNoun(peer_level)}</h2>
          {strips.map((s) => <div key={s.id} className={styles.strip}>
            <span>{s.label}</span>
            <div><u style={{ left: `${s.low * 100}%`, width: `${(s.high - s.low) * 100}%` }} /><i style={{ left: `${s.position * 100}%` }} /></div>
            <strong>{s.value}</strong>
          </div>)}
        </section>}

        {ownShare !== null && <section className={`${styles.panel} ${styles.income}`}>
          <h2>{incomeTitle}</h2>
          {[["Owning", ownShare], ...(rentShare !== null ? [["Renting", rentShare]] : [])].map(([label, share]) => <div key={label as string} className={styles.meter}>
            <span>{label as string}</span>
            <div><i style={{ width: `${Math.min(share as number, 100)}%` }} /><b style={{ left: "30%" }} /></div>
            <strong>{(share as number).toFixed(0)}%</strong>
          </div>)}
          <p className={styles.caption}>The mark is the common 30% guideline.</p>
        </section>}

        {(domNow || heatSeries.length > 20 || persistence || movers.length > 1) && <div id="county-context" className={styles.trends}>
          {domNow && domUsual !== null && <section className={`${styles.panel} ${styles.pace}`}><h2>Homes sit {Math.round(domNow.value)} days, {Math.abs(domGap) < 3 ? "close to usual" : domGap < 0 ? `${Math.round(-domGap)} faster than usual` : `${Math.round(domGap)} slower than usual`}</h2><MiniLine values={domSeries.map((o) => o.value)} base={domUsual} /><p className={styles.caption}>{domRank ? `${ordinal(domRank)} quickest of ${countyWaits.length} counties. ` : ""}Realtor.com via FRED, {asOf(domNow)}</p></section>}
          {heatSeries.length > 20 && <section className={`${styles.panel} ${styles.heat}`}><h2>{Math.round(heatNow)} days over 90°F a year, {heatNow >= heatBase ? "up" : "down"} from {Math.round(heatBase)}</h2><MiniBars values={heatSeries.map((o) => o.value)} recent={10} /><p className={styles.caption}>Since {yearOf(heatSeries[0])}, latest ten in orange. NOAA</p></section>}
          {persistence && <section className={`${styles.panel} ${styles.unusual}`}><h2>Prices against incomes: {againstUsual(persistence.vs_median!)} usual</h2><MiniBars values={persistence.series.map((p) => p.vs_median)} /><p className={styles.caption}>{persistence.first_year}–{persistence.last_year}. FHFA and Census</p></section>}
          {movers.length > 1 && <section className={`${styles.panel} ${styles.moving}`}><h2>Moving in and out</h2><div className={styles.moves}>{movers.map((y) => <div key={y.year} title={`${y.year}: ${y.net_per_1000!.toFixed(1)} per 1,000 households`}><i data-gain={y.net_per_1000! > 0 || undefined} style={{ height: `${(Math.abs(y.net_per_1000!) / moverPeak) * 50}%` }} /><span>{String(y.year).slice(2)}</span></div>)}</div><p className={styles.caption}>Net households per 1,000; above the line, more arrived{migration!.arrivals[0] ? `. Most from ${migration!.arrivals[0].name}` : ""}</p></section>}
        </div>}

        {pressureStory && <section id="affordability" className={`${styles.panel} ${styles.pressure}`}>
          <h2>{pressureStory.headline}</h2>
          <StoryBars rows={pressureStory.rows} />
          <p className={styles.caption}>{pressureStory.source}, {pressureStory.period} · {storyLink("pressure")}</p>
        </section>}

        {eras.length > 0 && <section className={`${styles.panel} ${styles.era}`} data-wide={seasonalHomes < 0.1 || undefined}>
          <h2>{eraLead.value.toFixed(0)}% of homes date from {eraLead.label === "Before 1940" ? "before 1940" : eraLead.label === "2000 on" ? "2000 or later" : eraLead.label}</h2>
          <StoryBars rows={eras.map((e) => ({ label: e.label, value: e.value, formatted: `${e.value.toFixed(0)}%` }))} />
          <p className={styles.caption}>Census ACS</p>
        </section>}

        {seasonalHomes >= 0.1 && <section className={`${styles.panel} ${styles.seasonal}`}>
          <h2>{(seasonalHomes * 100).toFixed(0)}% of homes are kept for seasonal use</h2>
          <div className={styles.waffle} role="img" aria-label={`Of every 100 homes, ${homeDots.filter((d) => d === "lived").length} are lived in year-round and ${homeDots.filter((d) => d === "seasonal").length} are seasonal.`}>{homeDots.map((dot, i) => <i key={i} data-kind={dot} />)}</div>
          <ul className={styles.key}><li><i data-kind="lived" />Lived in</li><li><i data-kind="seasonal" />Seasonal</li><li><i data-kind="empty" />Other empty</li></ul>
        </section>}

        {workBars.length > 0 && <section id="workday" className={`${styles.panel} ${styles.workday}`}>
          <h2>{elsewhere !== null ? `${(100 - elsewhere).toFixed(0)}% of residents’ jobs are in the county` : "Where the workday goes"}{leadPlace ? `, led by ${leadPlace.name}` : ""}</h2>
          {modes.length > 0 && <div className={styles.commute}>
            <div className={styles.stack}>{modes.map((mode) => <i key={mode.label} title={`${mode.label}: ${mode.value.toFixed(0)}%`} style={{ flexGrow: mode.value, background: mode.color }} />)}{modeOther > 0 && <i title={`Other: ${modeOther.toFixed(0)}%`} style={{ flexGrow: modeOther, background: "var(--tick)" }} />}</div>
            <ul className={styles.key}>{modes.map((mode) => <li key={mode.label}><i style={{ background: mode.color }} />{mode.label} {mode.value.toFixed(0)}%</li>)}</ul>
          </div>}
          {workBars.slice(0, 4).map((d) => <div key={d.name} className={styles.townBar}><span>{d.name}</span><div><i style={{ width: `${(d.share / workPeak) * 100}%` }} /></div><strong>{(d.share * 100).toFixed(0)}%</strong></div>)}
        </section>}

        {privateShare !== null && <section id="schools" className={`${styles.panel} ${styles.schools}`}>
          <h2>{((1 - privateShare) * 100).toFixed(0)}% of K–12 students go to public school</h2>
          <div className={styles.split}><i style={{ flexGrow: 1 - privateShare }}>{((1 - privateShare) * 100).toFixed(0)}%</i><i style={{ flexGrow: privateShare }}>{(privateShare * 100).toFixed(0)}%</i></div>
          <p className={styles.caption}>Public, then private. Census ACS.</p>
        </section>}

        {owned !== null && <section id="people" className={`${styles.panel} ${styles.people}`}>
          <h2>{(owned * 100).toFixed(0)}% of homes are owner-occupied</h2>
          <div className={styles.split}><i style={{ flexGrow: owned }}>{(owned * 100).toFixed(0)}%</i><i style={{ flexGrow: 1 - owned }}>{((1 - owned) * 100).toFixed(0)}%</i></div>
          <p className={styles.caption}>Owners, then renters. Census ACS.</p>
        </section>}

        {deepStories.length > 0 && <nav id="stories" className={`${styles.panel} ${styles.stories}`} aria-label="Stories"><strong>Go deeper</strong>{deepStories.map((item) => <Link key={item.topic} href={item.href}>{item.title}</Link>)}</nav>}

        <footer className={styles.close}>Sources: Zillow, Census Bureau, NJ Division of Taxation, FEMA, NOAA, FHFA and Realtor.com. <Link href={`${regionPath(regionId)}/report`}>Every figure in the full report</Link> · <Link href="/sources">About the data</Link> · <Link href={`/guide?place=${regionId}`}>Buyer’s guide</Link> · Mockup: <Link href={regionPath(regionId)}>current page</Link></footer>
      </main>
    </>;
  }

  return <>
    <Masthead affordability={{ kind: "route" }} simple />
    <main id="main-content" tabIndex={-1} className={styles.poster}>
      <Crumbs trail={[{ href: "/", label: "Home" }, ...stateCrumbs(region.state_code), ...(county && !isCounty ? [{ href: mockupPath(county.region_id), label: displayName(county) }] : [])]} here={name} />
      <PosterNav links={orderedLinks} />

      <header className={`${styles.panel} ${styles.hero}`}>
        <div>
          <p className={styles.kicker}>{county && !isCounty ? `${displayName(county)}, ` : ""}{scopeName(region.state_code)}{level("acs_population") ? ` · ${formatMetric(level("acs_population")!.value, "count", "acs_population")} residents` : ""}</p>
          <h1>{name}</h1>
          {headline && <p className={styles.headline}>{headline}</p>}
          <ComputedBadge />
        </div>
        {frame && town && <svg viewBox={`0 0 ${frame.width} ${frame.height}`} role="img" aria-label={`${name} on a map of ${scopeName(region.state_code)}`}>
          {counties.map((c) => <path key={c.id} d={c.d} fill="currentColor" fillOpacity={c.id === county?.region_id ? 0.55 : 0.2} />)}
          <circle cx={town.centre[0]} cy={town.centre[1]} r="8" fill="var(--series-2)" stroke="var(--poster-hero)" strokeWidth="2" />
        </svg>}
      </header>

      {readingPanel}

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
        <p className={styles.caption}>Box: the middle half of {unitPlural}. Line: the median. Ends: lowest and highest. Dot: {name}. Spacing is proportional, not linear. Zillow, {asOf(homeRow)}.</p>
      </section>}

      {growthSeries.length > 1 && <section className={`${styles.panel} ${styles.growth}`}>
        <h2>{growthLeader.label} grew fastest: up {(growthLeader.points.at(-1)!.index - 100).toFixed(0)}% since {growthStart!.slice(0, 4)}</h2>
        <svg className={styles.scatter} viewBox={`0 0 ${GW} ${GH}`} role="img" aria-label={`${growthSeries.map((g) => `${g.label} ${(g.points.at(-1)!.index - 100).toFixed(0)}%`).join(", ")} since ${growthStart!.slice(0, 4)}.`}>
          <line x1={GL} x2={GW - GR} y1={gy(100)} y2={gy(100)} stroke="currentColor" strokeOpacity="0.4" />
          <text x={GL - 6} y={gy(100) + 4} textAnchor="end">0%</text>
          {growthSeries.map((g) => { const last = g.points.at(-1)!; return <g key={g.label}><polyline points={g.points.map((p) => `${gx(p.time)},${gy(p.index)}`).join(" ")} fill="none" stroke={g.color} strokeWidth="2.5" strokeLinejoin="round" /><text x={gx(last.time) + 8} y={gy(last.index) + 4}>{`${g.label} ${last.index >= 100 ? "+" : ""}${(last.index - 100).toFixed(0)}%`}</text></g>; })}
          <text x={GL} y={GH - 6}>{growthStart!.slice(0, 4)}</text>
          <text x={GW - GR} y={GH - 6} textAnchor="end">{new Date(Math.max(...growthTimes)).getUTCFullYear()}</text>
        </svg>
        <p className={styles.caption}>Each line starts at 0% in {growthStart!.slice(0, 4)}, in dollars not adjusted for inflation. Zillow and Census ACS; income is a five-year survey, so it moves slowly.</p>
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
        {rentSizes.length > 1 && <div className={styles.building}><h3>Rent by size</h3><StoryBars rows={rentSizes} /><p className={styles.caption}>Median gross rent, Census ACS. Lower than the typical market rent above, partly because it includes long-time tenants.</p></div>}
        <details className={styles.tool}>
          <summary>Use your own numbers</summary>
          <OwnNumbers income={income} guideHref={`/guide?place=${regionId}`} source={{ state: region.state_code, price: cost!.home.value, ratePct: cost!.rate.value, taxYear: cost!.tax?.value ?? null, insuranceYear: cost!.insurance?.value ?? null, utilitiesMonth: cost!.utilities?.month ?? null, rentMonth: cost!.rent?.value ?? null }} />
        </details>
        <p className={styles.actions}><Link href={`/guide?place=${regionId}`}>Buyer’s guide</Link>{!isZip && <Link href={`/afford?place=${regionId}&county=${county?.region_id ?? "all"}`}>Places within my budget</Link>}<Link href="/help">Housing help</Link></p>
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

      {multiple !== null && pairs.length > 10 && <section id="ratio" className={`${styles.panel} ${styles.ratio}`}>
        <h2>A typical home here costs {multiple.toFixed(1)} times the typical income</h2>
        <svg className={styles.scatter} viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label={`Every New Jersey ${unitWord} by median household income and median home value. ${name} is ${multiple.toFixed(1)} times income, more than ${lessThanHere?.toFixed(0)}% of ${unitPlural}.`}>
          {yTicks.map((tick) => <g key={tick}><line x1={SL} x2={SW - SR} y1={sy(tick)} y2={sy(tick)} stroke="currentColor" strokeOpacity="0.12" /><text x={SL - 8} y={sy(tick) + 4} textAnchor="end">{moneyTick(tick)}</text></g>)}
          {xTicks.map((tick) => <text key={tick} x={sx(tick)} y={SH - 8} textAnchor="middle">{moneyTick(tick)}</text>)}
          {[3, 5].map((k) => { const { a, b } = multipleLine(k); return <g key={k}><line x1={sx(a)} y1={sy(a * k)} x2={sx(b)} y2={sy(b * k)} stroke="currentColor" strokeOpacity="0.6" strokeDasharray="5 4" /><text x={sx(b) - 4} y={sy(b * k) + 14} textAnchor="end">{k}× income</text></g>; })}
          {pairs.filter((p) => p.id !== regionId).map((p) => <circle key={p.id} cx={sx(p.income)} cy={sy(p.value)} r="2.5" fill="currentColor" fillOpacity="0.28" />)}
          <circle cx={sx(incomeRow!.value)} cy={sy(valueRow!.value)} r="7" fill="var(--series-2)" stroke="var(--on-dot)" strokeWidth="2" />
          <text className={styles.scatterName} x={sx(incomeRow!.value) - 12} y={sy(valueRow!.value) - 10} textAnchor="end">{name}</text>
        </svg>
        <p className={styles.caption}>Every dot is a New Jersey {unitWord}: median household income across, median owner-reported home value up. A higher multiple than {lessThanHere?.toFixed(0)}% of {unitPlural}. Both axes are proportional. Census ACS, {surveyPeriod}. · <Link href={placeStoryHref("market", regionId)}>Full story</Link></p>
      </section>}

      {taxBill && <section id="tax" className={`${styles.panel} ${styles.tax}`}>
        <h2>Property tax adds {dollars(taxBill.value / 12)} a month</h2>
        <p className={styles.giant}>{dollars(taxBill.value)}</p>
        <p className={styles.caption}>Median yearly bill{taxRate ? ` · ${taxRate.value.toFixed(2)}% effective rate` : ""}{taxBillMeasure ? ` · ${ordinal(taxBillMeasure.row.rank!)} highest of ${taxBillMeasure.row.of} ${unitPlural}` : ""}</p>
        <p className={styles.actions}><Link href={taxHref}>Look up a property</Link></p>
      </section>}

      {sameHouseRows.length > 0 && taxRate && <section className={`${styles.panel} ${styles.sameHouse}`}>
        <h2>The same {dollars(HOUSE)} house pays {dollars(billFor(taxRate.value))} a year here</h2>
        {sameHouseRows.map((row) => <div key={row.key} className={styles.townBar} data-own={row.own || undefined}>
          <span>{row.label}</span><div><i style={{ width: `${(row.rate / sameHousePeak) * 100}%` }} /></div><strong>{dollars(billFor(row.rate))}</strong>
        </div>)}
        <p className={styles.caption}>{ratio !== null ? `Assessments are ${assessment}: ${ratio.toFixed(0)}% of market value. ` : ""}{revaluedIn ? `Last revaluation ${Math.round(revaluedIn)}. ` : ""}{isCounty ? "Each effective rate" : "Each town’s effective rate"} applied to one price, not any home’s actual bill. NJ Division of Taxation, {taxRate.period_end.slice(0, 4)}.</p>
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

      {pressureStory && <section id="affordability" className={`${styles.panel} ${styles.pressure}`}>
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
        {floodBars.length > 0 && <div className={styles.building}>
          <h3>Flood claims in {flood.place ?? name}, last 20 years{flood.estimated ? " (estimated)" : ""}</h3>
          <div className={styles.floodBars} role="img" aria-label={`${Math.round(floodBars.reduce((sum, bar) => sum + bar.value, 0))} insured flood claims from ${floodBars[0].year} to ${floodEnd}.`}>{floodBars.map((bar) => <i key={bar.year} title={`${bar.year}: ${Math.round(bar.value)} claims`} style={{ height: `${Math.max((bar.value / floodPeak) * 100, bar.value > 0 ? 4 : 1)}%` }} />)}</div>
          <p className={styles.boxScale}><span>{floodBars[0].year}</span><span>Peak {Math.round(floodPeak)} in a year</span><span>{floodEnd}</span></p>
        </div>}
        <p className={styles.caption}>{electric ? `Electricity: ${electric}. ` : ""}NJ Education, FCC, BTS, FEMA, NJDEP, EPA and CDC.</p>
      </section>}

      {(bedrooms.length > 0 || stock.length > 0) && <section id="homes" className={`${styles.panel} ${styles.homes}`}>
        <h2>{threePlus > 0 ? `${(threePlus * 100).toFixed(0)}% of homes have three or more bedrooms` : "The homes here"}</h2>
        {bedrooms.length > 0 && <><div className={styles.stack}>{bedrooms.map((b) => <i key={b.label} title={`${b.label}: ${b.value.toFixed(0)}%`} style={{ flexGrow: b.value, background: b.color }} />)}</div>
          <ul className={styles.key}>{bedrooms.map((b) => <li key={b.label}><i style={{ background: b.color }} />{b.label} {b.value.toFixed(0)}%</li>)}</ul></>}
        <div className={styles.facts}>{stock.map((fact) => <div key={fact.label}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}</div>
        {buildingStory && <div className={styles.building}><h3>{buildingStory.headline}</h3><StoryBars rows={buildingStory.rows} /><p className={styles.caption}>{buildingStory.source}, {buildingStory.period} · {storyLink("building")}</p></div>}
      </section>}

      {workBars.length > 0 && <section id="workday" className={`${styles.panel} ${styles.workday}`}>
        <h2>{elsewhere !== null ? (isCounty ? `${(100 - elsewhere).toFixed(0)}% of residents’ jobs are in the county` : `${elsewhere.toFixed(0)}% of residents work outside ${isZip ? "the ZIP code" : "town"}`) : "Where the workday goes"}{leadPlace ? (isCounty ? `, led by ${leadPlace.name}` : `, most often in ${leadPlace.name}`) : ""}</h2>
        {modes.length > 0 && <div className={styles.commute}>
          <div className={styles.stack}>{modes.map((mode) => <i key={mode.label} title={`${mode.label}: ${mode.value.toFixed(0)}%`} style={{ flexGrow: mode.value, background: mode.color }} />)}{modeOther > 0 && <i title={`Other: ${modeOther.toFixed(0)}%`} style={{ flexGrow: modeOther, background: "var(--tick)" }} />}</div>
          <ul className={styles.key}>{modes.map((mode) => <li key={mode.label}><i style={{ background: mode.color }} />{mode.label} {mode.value.toFixed(0)}%</li>)}{modeOther > 0 && <li><i style={{ background: "var(--tick)" }} />Other {modeOther.toFixed(0)}%</li>}</ul>
        </div>}
        <div className={styles.workLayout}>
          {workFrame && townCentre && <svg viewBox={`0 0 ${workFrame.width} ${workFrame.height}`} role="img" aria-label={`Lines from ${name} to where its residents work`}>
            {workCounties.map((c) => <path key={c.id} d={c.d} fill="currentColor" fillOpacity="0.14" />)}
            {workLines.map((line) => <g key={line.name}><path d={line.d} fill="none" stroke="var(--series-2)" strokeWidth={line.weight} strokeLinecap="round" /><circle cx={line.to[0]} cy={line.to[1]} r="3" fill="var(--series-2)" /></g>)}
            <circle cx={townCentre[0]} cy={townCentre[1]} r="6" fill="var(--series-1)" stroke="currentColor" strokeWidth="1.5" />
          </svg>}
          <div>{workBars.map((d) => <div key={d.name} className={styles.townBar}><span>{d.name}</span><div><i style={{ width: `${(d.share / workPeak) * 100}%` }} /></div><strong>{(d.share * 100).toFixed(0)}%</strong></div>)}
            <p className={styles.caption}>Share of {destinations!.total_jobs.toLocaleString("en-US")} jobs held by residents, {destinations!.year} · Census LODES · lines show the mapped places.</p>
          </div>
        </div>
      </section>}

      {privateShare !== null && <section id="schools" className={`${styles.panel} ${styles.schools}`}>
        <h2>{((1 - privateShare) * 100).toFixed(0)}% of K–12 students here go to public school</h2>
        <div className={styles.split}><i style={{ flexGrow: 1 - privateShare }}>{((1 - privateShare) * 100).toFixed(0)}% public</i><i style={{ flexGrow: privateShare }}>{(privateShare * 100).toFixed(0)}% private</i></div>
        <StoryBars rows={stages.map((stage) => ({ label: `${stage.label}, private`, value: stage.value, formatted: `${stage.value.toFixed(0)}%` }))} />
        {results.length > 0 && <div className={styles.facts}>{results.map((result) => <div key={result.id}><strong>{result.value!.toFixed(0)}%</strong><span>{result.label.replace(": met or exceeded expectations", " met expectations")}</span></div>)}</div>}
        <p className={styles.caption}>{districts.length ? `${districts.map((d) => d.name).join(", ")}${resultYear ? `, ${resultYear}` : ""}. ` : ""}Where students live, not where schools are. Charter and vocational schools count as public. Census ACS, NJ Department of Education. · {storyLink("schools")}</p>
      </section>}

      {seasonalHomes >= 0.1 && <section id="seasonal" className={`${styles.panel} ${styles.seasonal}`}>
        <h2>{(seasonalHomes * 100).toFixed(0)}% of homes here are kept for seasonal use</h2>
        <div className={styles.waffle} role="img" aria-label={`Of every 100 homes, ${homeDots.filter((d) => d === "lived").length} are lived in year-round and ${homeDots.filter((d) => d === "seasonal").length} are seasonal.`}>{homeDots.map((dot, i) => <i key={i} data-kind={dot} />)}</div>
        <ul className={styles.key}><li><i data-kind="lived" />Lived in</li><li><i data-kind="seasonal" />Seasonal</li><li><i data-kind="empty" />Empty for other reasons</li></ul>
        <p className={styles.caption}>Every 100 homes. Census ACS, a five-year survey. “Lived in” means occupied when surveyed; seasonal homes can still be rented in summer.</p>
      </section>}

      {county && contextFacts.length > 0 && <details id="county-context" className={`${styles.panel} ${styles.context}`}>
        <summary><span><strong>{isCounty ? "Market trends" : `${displayName(county)} context`}</strong><small>{isCounty ? "Pace of sales, heat, prices against incomes, and moves" : `The wider market, published by county, not ${name} alone`}</small></span><span className={styles.contextFacts}>{contextFacts.map((fact) => <span key={fact}>{fact}</span>)}</span></summary>
      {domNow && domUsual !== null && county && <section className={styles.contextItem}>
        <h2>Homes in {displayName(county)} sit about {Math.round(domNow.value)} days, {Math.abs(domGap) < 3 ? "close to usual" : domGap < 0 ? `${Math.round(-domGap)} faster than usual` : `${Math.round(domGap)} slower than usual`}</h2>
        <svg className={styles.scatter} viewBox={`0 0 ${DW} ${DH}`} role="img" aria-label={`Median days on market in ${displayName(county)} by month, now ${Math.round(domNow.value)} days, usually ${Math.round(domUsual)}.`}>
          <line x1={DL} x2={DW} y1={dy(domUsual)} y2={dy(domUsual)} stroke="currentColor" strokeOpacity="0.6" strokeDasharray="5 4" />
          <text x={DL + 4} y={dy(domUsual) - 6}>Usual, {Math.round(domUsual)} days</text>
          <line x1={DL} x2={DW} y1={dy(0)} y2={dy(0)} stroke="currentColor" strokeOpacity="0.25" />
          <polyline points={domSeries.map((o, i) => `${dx(i)},${dy(o.value)}`).join(" ")} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />
          <circle cx={dx(domSeries.length - 1)} cy={dy(domNow.value)} r="5" fill="var(--series-2)" />
          {domYears.map(({ year, i }) => <text key={year} x={dx(i)} y={DH - 6} textAnchor="middle">{year}</text>)}
        </svg>
        <p className={styles.caption}>Median days on market, by month{domYearAgo ? ` · ${Math.round(domYearAgo.value)} days a year earlier` : ""}{domRank && countyWaits.length ? ` · ${ordinal(domRank)} quickest of ${countyWaits.length} NJ counties` : ""}. {isCounty ? "These" : "County figures, not this town alone, and they"} rise and fall with the seasons. Realtor.com via FRED, {asOf(domNow)}.</p>
      </section>}

      {heatSeries.length > 20 && county && <section className={styles.contextItem}>
        <h2>{displayName(county)} now passes 90°F about {Math.round(heatNow)} days a year, {heatNow >= heatBase ? "up" : "down"} from {Math.round(heatBase)}</h2>
        <svg className={styles.scatter} viewBox={`0 0 ${HW} ${HH}`} role="img" aria-label={`Days over 90 degrees in ${displayName(county)} each year since ${yearOf(heatSeries[0])}. The last ten years average ${Math.round(heatNow)} days, against ${Math.round(heatBase)} from 1951 to 1980.`}>
          {heatSeries.map((o, i) => <rect key={o.period_end} x={HL + i * barW} y={hy(o.value)} width={Math.max(barW - 1, 1)} height={hy(0) - hy(o.value)} fill={i >= heatSeries.length - 10 ? "var(--series-2)" : "currentColor"} fillOpacity={i >= heatSeries.length - 10 ? 1 : 0.35}><title>{`${yearOf(o)}: ${Math.round(o.value)} days`}</title></rect>)}
          <line x1={HL} x2={HW} y1={hy(heatBase)} y2={hy(heatBase)} stroke="currentColor" strokeDasharray="5 4" />
          <text x={HL + 4} y={hy(heatBase) - 6}>1951–80 average, {Math.round(heatBase)} days</text>
          {heatSeries.filter((o) => yearOf(o) % 20 === 0).map((o) => <text key={o.period_end} x={HL + heatSeries.indexOf(o) * barW} y={HH - 6} textAnchor="middle">{yearOf(o)}</text>)}
        </svg>
        <p className={styles.caption}>Days over 90°F each year; orange is the latest ten, the average in the title{heatRank && allHeat.length ? ` · ${ordinal(heatRank)} hottest of ${allHeat.length} NJ counties` : ""}. {isCounty ? "A county average" : "A county average, not this town’s readings"} from NOAA nClimGrid-Daily.{ground.find((g) => g.id === "tree_canopy_homes_share") ? ` Shade: ${ground.find((g) => g.id === "tree_canopy_homes_share")!.value} tree canopy over ${name}’s homes.` : ""}</p>
      </section>}

      {persistence && county && <section className={styles.contextItem}>
        <h2>Against incomes, {displayName(county)} homes are {againstUsual(persistence.vs_median!)} their usual level</h2>
        <svg className={styles.scatter} viewBox={`0 0 ${UW} ${UH}`} role="img" aria-label={`Home prices against income in ${displayName(county)} from ${persistence.first_year} to ${persistence.last_year}, above or below the usual level.`}>
          {persistence.series.map((p) => { const top = Math.min(uY(p.vs_median), uY(0)); return <rect key={p.year} x={UP + (p.year - persistence.first_year) * uStep + 1} y={top} width={Math.max(uStep - 2, 1)} height={Math.max(Math.abs(uY(p.vs_median) - uY(0)), 1)} fill={p.year === persistence.last_year ? "var(--series-2)" : "currentColor"} fillOpacity={p.year === persistence.last_year ? 1 : p.vs_median > 0 ? 0.55 : 0.25}><title>{`${p.year}: ${againstUsual(p.vs_median)} the usual level`}</title></rect>; })}
          <line x1={UP} x2={UW - UP} y1={uY(0)} y2={uY(0)} stroke="currentColor" />
          <text x={UP} y={UH - 6}>{persistence.first_year}</text>
          <text x={UW - UP} y={UH - 6} textAnchor="end">{persistence.last_year}</text>
        </svg>
        <p className={styles.caption}>{persistence.vs_median_low !== null && persistence.vs_median_high !== null ? `Likely between ${againstUsual(persistence.vs_median_low)} and ${againstUsual(persistence.vs_median_high)}. ` : ""}The line is the usual level, the middle of {persistence.years} years{persistence.peak_year ? `; the peak was ${persistence.peak_year}` : ""}. {isCounty ? `Through ${persistence.last_year}.` : `County figures through ${persistence.last_year}, not this town.`} FHFA and Census SAIPE. · <Link href="/stories/is-today-unusual">Full story</Link></p>
      </section>}

        {movers.length > 1 && <div className={styles.contextItem}><h2>Moving in and out of {migration!.county_name} County</h2>
          <div className={styles.moves}>{movers.map((y) => <div key={y.year} title={`${y.year}: ${y.net_per_1000!.toFixed(1)} per 1,000 households`}><i data-gain={y.net_per_1000! > 0 || undefined} style={{ height: `${(Math.abs(y.net_per_1000!) / moverPeak) * 50}%` }} /><span>{String(y.year).slice(2)}</span></div>)}</div>
          <p className={styles.caption}>Net households per 1,000, by year · above the line, more arrived than left{migration!.arrivals[0] ? ` · most arrivals from ${migration!.arrivals[0].name}` : ""}</p></div>}
      </details>}

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

      {ground.length > 0 && <section id="surroundings" className={`${styles.panel} ${styles.ground}`}>
        <h2>{groundLead.label}: {groundLead.position >= 0.5 ? "higher" : "lower"} than {Math.round(Math.max(groundLead.position, 1 - groundLead.position) * 100)}% of {peers}</h2>
        <p className={styles.caption}>Around the homes, lowest {unitPlural} on the left, highest on the right.</p>
        {ground.map((g) => <div key={g.id} className={styles.strip}><span>{g.label}</span><div><i style={{ left: `${g.position * 100}%` }} /></div><strong>{g.value}</strong></div>)}
      </section>}

      {shops.length > 0 && !isCounty && <section className={`${styles.panel} ${styles.street}`}>
        <h2>On the map in {name}</h2>
        <div className={styles.facts}>{shops.map((shop) => <div key={shop.label}><strong>{shop.value}</strong><span>{shop.label}</span></div>)}</div>
        <p className={styles.caption}>Mapped in OpenStreetMap, so some may be missing.</p>
      </section>}

      {(work.length > 0 || owned !== null) && <section id="people" className={`${styles.panel} ${styles.people}`}>
        {owned !== null && <><h2>{(owned * 100).toFixed(0)}% of homes are owner-occupied</h2>
          <div className={styles.split}><i style={{ flexGrow: owned }}>{(owned * 100).toFixed(0)}% own</i><i style={{ flexGrow: 1 - owned }}>{((1 - owned) * 100).toFixed(0)}% rent</i></div></>}
      </section>}

      {townsPanel}

      {similar && similar.matches.length > 0 && priceRow && <section className={`${styles.panel} ${styles.similar}`}>
        <h2>{similar.matches.length} similar {similar.matches.length === 1 ? `${unitWord} costs` : `${unitPlural} cost`} at least {Math.round((1 - similar.cheaper_by) * 100)}% less</h2>
        <div className={styles.towns}>{similar.matches.map((m, i) => { const there = priceRow.values[i + 1], here = priceRow.values[0]; return <Link key={m.region_id} href={mockupPath(m.region_id)} prefetch={false}><strong>{m.name}</strong>{there !== null && <span>{dollars(there)}</span>}{there !== null && here !== null && <small>{dollars(here - there)} less</small>}</Link>; })}</div>
        <p className={styles.actions}><Link href={`/compare${placesQuery([regionId, ...similar.matches.slice(0, 3).map((m) => m.region_id)])}`}>Compare side by side</Link></p>
      </section>}

      {deepStories.length > 0 && <section id="stories" className={`${styles.panel} ${styles.stories}`}>
        <GoDeeper name={name} stories={deepStories} />
      </section>}

      <footer className={styles.close}>Sources: Zillow, Census Bureau, FEMA, NJ Division of Taxation. <Link href={`${regionPath(regionId)}/report`}>Every figure in the full report</Link> · <Link href="/sources">About the data</Link> · Mockup: <Link href={regionPath(regionId)}>current page</Link></footer>
    </main>
  </>;
}
