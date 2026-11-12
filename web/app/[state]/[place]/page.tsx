import { budgetMapHref } from "@/lib/budgetLink";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { glossTree } from "../../_poster/glossTree";
import { MoreTiles } from "../../_poster/MoreTiles";
import { TENURE_SCRIPT, TenureSwitch } from "../../_poster/TenureSwitch";
import { OwnNumbers } from "../../_poster/OwnNumbers";
import { CountyAtlas, type AtlasTown as AtlasTownRow } from "../../_poster/CountyAtlas";
import { PosterNav } from "../../_poster/PosterNav";
import { StoryBars } from "../../_poster/StoryBars";
import "../../place-photo.css";
import styles from "../../_poster/poster.module.css";
import rail from "../../_poster/state.module.css";
import acts from "../../_poster/acts.module.css";
import { ComputedBadge } from "@/components/ComputedBadge";
import { Crumbs } from "@/components/Crumbs";
import { Glossed } from "@/components/Glossed";
import { InlineScript } from "@/components/InlineScript";
import { ConsumerReading } from "@/components/ExplanationPanel";
import { Masthead } from "@/components/Masthead";
import { GardenStateArtwork } from "@/components/GardenStateArtwork";
import { PlacePhoto } from "@/components/PlacePhoto";
import { ThemedShot } from "@/components/ThemedShot";
import { StoryScroller } from "@/components/StoryScroller";
import { similarGroups } from "@/lib/similar";
import { reportPageProblemUrl } from "@/lib/reportProblem";
import { stateCrumbs } from "@/lib/states";
import { placesQuery } from "@/lib/compare";
import { api, regionsWithData, type Region } from "@/lib/api";
import { focusedConsumerAnswer } from "@/lib/citations";
import { ownershipInputs } from "@/lib/budgetScenario";
import { costInputs } from "@/lib/costInputs";
import { formatChange, formatMetric } from "@/lib/format";
import { KIND_LABELS, KIND_MEANINGS, kindOf, type RecordType } from "@/lib/kinds";
import { standOuts } from "@/lib/standouts";
import { pageMetadata, regionTitle } from "@/lib/meta";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { eachMonth } from "@/lib/ownership";
import { comparisonMeasures } from "@/lib/placeComparisons";
import { placeRouteParams, regionPath, resolvePlace } from "@/lib/placeRoutes";
import { makePlaceStoryRecord, PLACE_STORIES, placeStoryHref, storyHistoryMetrics, summarizePlaceStory, type PlaceStoryTopic } from "@/lib/placeStories";
import { stampPlaceStory } from "@/lib/placeStoryData";
import { againstUsual } from "@/lib/persistence";
import { loadFloodStory } from "@/lib/placeFloodStory";
import { TREND_METRICS } from "@/lib/trendMetrics";
import { marketDistribution } from "@/lib/marketPortrait";
import { marketPortraitData } from "@/lib/marketPortraitData";
import { arc, projector, ringsOf, shapes } from "@/lib/storyMap";
import { leadingDestination, STORIES } from "@/lib/stories";
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

/** What kind of figure this is (SPEC principle 11): counted, set, surveyed, calculated or modelled. */
function Chip({ kind }: { kind: RecordType }) {
  return <span className={acts.chip} data-kind={kind} title={KIND_MEANINGS[kind]}>{KIND_LABELS[kind]}</span>;
}

/** Under every exhibit: the kind of figure, then who published it and when. */
function Prov({ kind, children }: { kind?: RecordType | null; children: ReactNode }) {
  return <p className={acts.prov}>{kind && <Chip kind={kind} />}<span>{children}</span></p>;
}

/**
 * Which region pages exist: every region carrying data except the state, whose page
 * folded into the New Jersey page (ARCHITECTURE #127). `output: "export"` writes only
 * what this lists.
 */
export async function generateStaticParams() {
  return placeRouteParams(await regionsWithData());
}

/** What kind of place this is, in the words a reader uses: "Township in Somerset County". */
function placeLine(region: Region & { ancestors: Region[] }): string {
  const county = region.ancestors.find((a) => a.level === "county");
  const state = scopeName(region.state_code);
  if (region.level === "county") return `County in ${state}`;
  if (region.level === "zip") return `ZIP code in ${state}`;
  // TIGER's legal type is what `name_lsad` adds to the name: "Montgomery township".
  const kind = region.name_lsad?.startsWith(`${region.name} `) ? region.name_lsad.slice(region.name.length + 1) : "municipality";
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} in ${county ? displayName(county) : state}`;
}

/** Each place's own title and description (#358), so a tab, a search result and a shared link name the town. */
export async function generateMetadata({ params }: { params: Promise<{ state: string; place: string }> }) {
  const { state, place } = await params;
  const regionId = resolvePlace(state, place);
  const region = regionId === null ? null : await api.region(regionId);
  if (regionId === null || !region) return {};
  return pageMetadata({
    title: `${regionTitle(region)} — Housing`,
    description: `${placeLine(region)}: home values, rents, what it costs to own or rent, and local conditions, with every figure traced to its public source.`,
    path: regionPath(regionId),
  });
}

/** A place page as one poster: every panel makes one point, and the picture makes it. */
export default async function PlacePoster({ params }: { params: Promise<{ state: string; place: string }> }) {
  const { state, place: slug } = await params;
  const regionId = resolvePlace(state, slug);
  if (regionId === null) notFound();
  const [region, packet, summary] = await Promise.all([api.region(regionId), api.packet(regionId, "5y"), api.summary(regionId, "5y")]);
  if (!region || !packet) return <>
    <Masthead affordability={{ kind: "route" }} />
    <main id="main-content" tabIndex={-1} className="shell">
      <h1 className="page-title">Region not found</h1>
      <p className="meta">No region {regionId}, or the API is unreachable. <Link href="/states/new-jersey">Back to New Jersey</Link>.</p>
    </main>
  </>;

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
  const hasReading = !!consumer && !consumer.stale && !!consumer.sections?.length && !!focusedConsumerAnswer(consumer.body, consumer.sections, consumer.binding ?? null, "what_stands_out").answer;
  const readingPanel = hasReading ? <section id="reading" className={`${styles.panel} ${styles.reading}`}>
    <ConsumerReading reading={consumer} section="what_stands_out" heading="What stands out" headingLevel={3} headingHidden paperNote />
  </section> : null;
  const { peer_count, peer_level, peer_scope } = packet.comparisons;
  const headline = verdictHeadline({ name, count: peer_count, noun: peerNoun(peer_level), scope: scopeName(peer_scope) }, packet.metrics, packet.levels, uncertainties);
  const level = (id: string) => packet.levels.find((l) => l.metric_id === id);

  const month = cost ? eachMonth(ownershipInputs({ state: region.state_code, price: cost.home.value, ratePct: cost.rate.value,
    taxYear: cost.tax?.value ?? null, insuranceYear: cost.insurance?.value ?? null, utilitiesMonth: cost.utilities?.month ?? null, rentMonth: cost.rent?.value ?? null })) : null;
  // Zillow's asking rent covers 238 of 564 towns; the Census survey's median covers 499.
  // Where Zillow has none the survey's figure stands in, and every use of it says so.
  const askRow = level("zori_all"), paidRow = level("acs_median_gross_rent");
  const rent = cost?.rent?.value ?? askRow?.value ?? paidRow?.value ?? null;
  const rentIsSurvey = !cost?.rent && !askRow && !!paidRow;
  const line = (key: string) => month?.lines.find((l) => l.key === key)?.value ?? 0;
  const parts = [
    { label: "Mortgage", value: line("mortgage"), color: "var(--series-1)" },
    { label: "Property tax", value: line("tax"), color: "var(--part-2)" },
    { label: "Everything else", value: line("insurance") + line("utilities") + line("upkeep"), color: "var(--part-3)" },
  ].filter((part) => part.value > 0);
  const income = level("acs_median_hh_income")?.value ?? null;
  const shareOfIncome = (monthly: number | null) => (income && monthly ? (monthly * 12) / income * 100 : null);
  const ownShare = shareOfIncome(month?.total ?? null), rentShare = shareOfIncome(rent);

  const obs = history?.observations ?? [];
  const end = obs.at(-1)?.period_end;
  const recent = end ? obs.filter((o) => o.period_end >= `${Number(end.slice(0, 4)) - 10}${end.slice(4)}`).map((o) => o.value) : [];
  // A line fitted to its own range: an area from $0 flattens a decade into a ruler.
  const high = Math.max(...recent), low = Math.min(...recent);
  const trend = recent.map((v, i) => `${(i / Math.max(recent.length - 1, 1)) * 600},${94 - ((v - low) / (high - low || 1)) * 88}`).join(" ");
  const trendYears = end ? [Number(end.slice(0, 4)) - 10, Number(end.slice(0, 4))] : [];

  const strips = STRIPS.flatMap(([id, label]) => {
    const row = level(id);
    const measure = comparisonMeasures(packet.levels, uncertainties, [id])[0];
    return row && measure ? [{ ...measure, id, label, value: formatMetric(row.value, row.unit, id) }] : [];
  });
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
  const fiber = community?.broadband_place?.payload;
  const uninsured = community?.health.find((h) => h.payload.measure === "ACCESS2")?.payload;
  const violations = water?.systems.reduce((sum, w) => sum + w.violations, 0) ?? null;
  const electric = utilities?.providers.find((p) => p.fuel === "electric")?.provider;
  const bedrooms = [["acs_share_0_1_bedrooms", "0–1 bed"], ["acs_share_2_bedrooms", "2 bed"], ["acs_share_3_bedrooms", "3 bed"], ["acs_share_4plus_bedrooms", "4+ bed"]].flatMap(([id, label], i) => { const v = level(id)?.value; return v ? [{ label, value: v * 100, color: ["var(--part-4)", "var(--part-3)", "var(--part-2)", "var(--part-1)"][i] }] : []; });
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
  // Housing help opens on this town's records; a ZIP code or county has no town to search by.
  const helpHref = region.level === "municipality" ? `/affordable-housing?town=${encodeURIComponent(region.name)}` : "/help";
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
  // Each service figure with something to judge it by, where a comparison is published.
  const stateFiber = stateId ? (await api.community(stateId))?.broadband_place?.payload : null;
  const transitPlace = level("transit_any_homes_share") ? await placed("transit_any_homes_share", "", share) : null;
  const than = (position: number) => (position >= 0.5 ? `more than in ${Math.min(Math.round(position * 100), 99)}% of ${unitPlural}` : `less than in ${Math.min(Math.round((1 - position) * 100), 99)}% of ${unitPlural}`);
  const power = utilities?.providers.find((p) => p.fuel === "electric")?.electricity?.payload;
  const facts: { value: string; label: string; note?: string }[] = [
    fiber && fiber.locations > 0 && { value: `${((fiber.fiber / fiber.locations) * 100).toFixed(0)}%`, label: "of locations can get fiber", note: stateFiber && stateFiber.locations > 0 ? `${((stateFiber.fiber / stateFiber.locations) * 100).toFixed(0)}% across ${scopeName(region.state_code)}` : undefined },
    pct("transit_any_homes_share") && { value: pct("transit_any_homes_share")!, label: "of homes near a transit stop", note: transitPlace ? than(transitPlace.position) : undefined },
    siteRate !== null && { value: siteRate.toFixed(1), label: "open site cleanups per 1,000 homes", note: typicalSites !== null ? `the typical ${unitWord} has ${typicalSites.toFixed(1)}` : undefined },
    violations !== null && { value: violations.toLocaleString("en-US"), label: `drinking-water violations, ${water?.first_year}–${water?.last_year}`, note: violations === 0 ? "none on record" : undefined },
    story("utilities")?.rows[0] && { value: story("utilities")!.rows[0].formatted, label: "without power per customer in a year, across the whole utility", note: power?.saidi_normal != null ? `${power.saidi_normal.toFixed(0)} min leaving out major storms` : undefined },
    uninsured?.value != null && { value: `${uninsured.value.toFixed(0)}%`, label: `of adults 18–64 uninsured (county, ${uninsured.year})` },
  ].flatMap((fact) => (fact ? [fact] : []));
  const SHOPS = [["osm_starbucks_count", "Starbucks"], ["osm_dunkin_count", "Dunkin’"], ["osm_wawa_count", "Wawa"], ["osm_quickchek_count", "QuickChek"], ["osm_trader_joes_count", "Trader Joe’s"], ["osm_whole_foods_count", "Whole Foods"], ["osm_pizza_count", "Pizzerias"], ["osm_bagel_count", "Bagel shops"], ["osm_diner_count", "Diners"]];
  const shops = (await Promise.all(SHOPS.map(async ([id, label]) => ({ label, value: (await latest(id))?.value ?? 0 })))).filter((shop) => shop.value > 0);
  const eras = [["acs_share_built_pre_1940", "Before 1940"], ["acs_share_built_1940_1979", "1940–79"], ["acs_share_built_1980_1999", "1980–99"], ["acs_share_built_2000_later", "2000 on"]].flatMap(([id, label]) => { const v = level(id)?.value; return v !== undefined ? [{ label, value: v * 100 }] : []; });
  const eraLead = [...eras].sort((a, b) => b.value - a.value)[0];
  const kinds = [["acs_share_detached", "Detached houses"], ["acs_share_attached", "Attached"], ["acs_share_2_4_units", "2–4 units"], ["acs_share_5_19_units", "5–19 units"], ["acs_share_20plus_units", "20+ units"]].flatMap(([id, label]) => { const v = level(id)?.value; return v ? [{ label, value: v * 100 }] : []; });
  const bills = [["acs_median_electricity", "Electricity", 1], ["acs_median_gas", "Gas", 1], ["acs_median_water_sewer", "Water and sewer", 12]].flatMap(([id, label, per]) => { const v = level(id as string)?.value; return v ? [{ label: label as string, value: v / (per as number) }] : []; });
  const billTotal = bills.reduce((sum, b) => sum + b.value, 0);
  const passed = (mark: number) => obs.find((o) => o.value >= mark)?.period_end.slice(0, 4);
  const milestones = [500000, 1000000].flatMap((mark) => { const year = passed(mark); return year && year !== obs[0]?.period_end.slice(0, 4) ? [`passed ${dollars(mark)} in ${year}`] : []; });
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
  const homeBox = boxes.find((b) => b.id === "zhvi_sfr");
  // The header leads with recorded sales where they exist, so its chart sets the same
  // measure among the same peers, on the log axis the other cohorts use.
  const saleValues = medianSale ? [...(await townValues("sr1a_median_sale_price", medianSale.period_start)).values()].filter((v) => v > 0) : [];
  const saleDist = marketDistribution(saleValues);
  const saleBox: typeof homeBox = medianSale && saleDist && saleDist.max > saleDist.min ? { id: "sr1a_median_sale_price", label: "Sale price", box: saleDist, own: medianSale.value, count: saleValues.length,
    x: (v: number) => (Math.log(v / saleDist.min) / Math.log(saleDist.max / saleDist.min)) * 100, below: saleValues.filter((v) => v < medianSale.value).length / saleValues.length * 100 } : undefined;
  const versusTypical = homeBox ? (homeBox.own / homeBox.box.median - 1) * 100 : null;
  const peers = `${region.state_code} ${peerNoun(peer_level)}`;
  const priceTitle = versusTypical === null ? "The typical home" : `${Math.abs(versusTypical).toFixed(0)}% ${versusTypical >= 0 ? "above" : "below"} the typical ${peers.replace(/ies$/, "y").replace(/s$/, "")}`;
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
  const townRows: AtlasTownRow[] = isCounty ? countyTowns.map((t) => ({ commute: townCommutes.get(t.region_id) ?? null, flood: townFlood.get(t.region_id) ?? null, id: t.region_id, name: countyTowns.filter((o) => displayName(o) === displayName(t)).length > 1 && t.name_lsad ? t.name_lsad.replace(/^./, (c) => c.toUpperCase()) : displayName(t), href: regionPath(t.region_id), sale: townSales.get(t.region_id) ?? null, value: homeByTown.get(t.region_id) ?? null, tax: ownTownRates.get(t.region_id) ?? null, income: townIncomes2.get(t.region_id) ?? null })) : [];
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
  const GROWTH = [["zhvi_sfr", "Home value", "var(--series-1)"], ["zori_all", "Rent", "var(--series-3)"], ["acs_median_hh_income", "Income", "var(--text-secondary)"]] as const;
  const growthRows = GROWTH.flatMap(([id, label, color]) => { const rows = series.find((item) => item.metricId === id)?.observations ?? []; return rows.length >= 2 ? [{ label, color, rows }] : []; });
  const growthStart = growthRows.length > 1 ? growthRows.map((g) => g.rows[0].period_end).sort().at(-1)! : null;
  const growthSeries = growthStart ? growthRows.flatMap((g) => {
    const rows = g.rows.filter((o) => o.period_end >= growthStart);
    return rows.length >= 2 && rows[0].value > 0 ? [{ ...g, points: rows.map((o) => ({ time: Date.parse(o.period_end), index: (o.value / rows[0].value) * 100 })) }] : [];
  }) : [];
  const GW = 640, GH = 220, GL = 4, GR = 8, GT = 12, GB = 8;
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
  const modes = [["acs_commute_drove_alone_share", "Drive alone", "var(--series-1)"], ["acs_commute_transit_share", "Transit", "var(--part-2)"], ["acs_commute_walked_share", "Walk", "var(--part-3)"], ["acs_work_from_home_share", "Work from home", "var(--part-4)"]].flatMap(([id, label, color]) => { const v = level(id)?.value; return v !== undefined ? [{ label, color, value: v * 100 }] : []; });
  const modeOther = Math.max(100 - modes.reduce((sum, m) => sum + m.value, 0), 0);


  // The same rail as the state page, so stories close every level of place alike.
  const storyRail = deepStories.length > 0 ? <section id="stories" className={`${styles.chapter} ${rail.rail}`}>
    <div className={rail.railHead}><h2>Visual stories about {name}</h2><Link href="/stories">All visual stories</Link></div>
    <StoryScroller label={`visual stories about ${name}`}>{deepStories.map((item) => <li key={item.topic}><Link href={item.href} prefetch={false}><ThemedShot name={`stories/${item.slug}`} width={1440} height={900} className={styles.deepCover} /><span>{item.title}</span></Link></li>)}</StoryScroller>
  </section> : null;


  // A county page compares its towns: the map and table first, then only the chapters that
  // are true of the county as a whole. One town in depth is the town poster's job.
  const monthYear = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
  const rentRow = level("zori_all");
  const kind = (id: string) => (level(id)?.record_type as RecordType | null | undefined) ?? kindOf(id);
  // Where a figure sits among its peers: a mark on a line, and the same thing in words.
  const standing = (id: string) => {
    const m = comparisonMeasures(packet.levels, uncertainties, [id])[0];
    if (!m) return { position: null, text: null };
    const of = m.row.of!, below = Math.round(m.position * 100);
    const text = m.position === 1 ? `Highest of ${of} ${unitPlural}` : m.position === 0 ? `Lowest of ${of} ${unitPlural}` : below >= 50 ? `Higher than ${Math.min(below, 99)}% of ${of} ${unitPlural}` : `Lower than ${Math.min(100 - below, 99)}% of ${of} ${unitPlural}`;
    return { position: m.position as number | null, text: text as string | null };
  };
  // The same four figures on every place: price, monthly cost, tax, five-year change. The
  // price is what was recorded where records exist, and Zillow's estimate, labelled, where not.
  const priceLevel = medianSale ?? homeRow;
  const change = packet.metrics.find((m) => m.metric_id === "zhvi_sfr");
  const changePosition = change?.rank && change.of && change.of > 1 ? 1 - (change.rank - 1) / (change.of - 1) : null;
  const figures = [
    priceLevel && { label: medianSale ? "Median home sale price" : "Typical home value", value: money(priceLevel.value), kind: kind(priceLevel.metric_id), ...standing(priceLevel.metric_id), fine: medianSale ? `${medianSale.period_start ? `${monthYear(medianSale.period_start)} to ` : ""}${monthYear(medianSale.period_end)} · NJ deed records` : `${asOf(priceLevel)} · Zillow` },
    month && { label: "Monthly cost to own", value: money(month.total), kind: "calculated" as RecordType, position: null, text: rent !== null ? (rentIsSurvey ? `${money(rent)} median rent tenants pay` : `${money(rent)} to rent the typical rental`) : null, fine: `Typical home, 20% down at ${cost!.rate.value.toFixed(2)}%` },
    taxBill ? { label: "Median yearly property tax", value: money(taxBill.value), kind: kind("modiv_median_tax_bill"), ...standing("modiv_median_tax_bill"), fine: `${taxBill.period_end.slice(0, 4)} · NJ tax records` }
      : rentRow && { label: "Typical monthly rent", value: money(rentRow.value), kind: kind("zori_all"), ...standing("zori_all"), fine: `${asOf(rentRow)} · Zillow` },
    change && { label: `Home value, ${change.window_start.slice(0, 4)} to ${change.window_end.slice(0, 4)}`, value: formatChange(change.pct_change), kind: kind("zhvi_sfr"), position: changePosition,
      text: changePosition === null ? null : changePosition >= 0.5 ? `A bigger change than ${Math.min(Math.round(changePosition * 100), 99)}% of ${change.of} ${unitPlural}` : `A smaller change than ${Math.min(100 - Math.round(changePosition * 100), 99)}% of ${change.of} ${unitPlural}`, fine: "Zillow" },
  ].flatMap((figure) => (figure ? [figure] : []));
  type Figure = { label: string; value: string; kind: RecordType | null | undefined; position: number | null; text: string | null; fine: string };
  const band = (items: Figure[], who?: "buy" | "rent") => items.length > 0 && <dl className={acts.figures} data-for={who} aria-label={`${name} at a glance${who === "rent" ? ", renting" : who === "buy" ? ", buying" : ""}`}>{items.map((f) => <div key={f.label}>
    <dt><Glossed text={f.label} /></dt>
    <dd className={acts.value}>{f.value}</dd>
    {f.text && <dd className={acts.peer}>{f.position !== null && <span className={acts.tick} aria-hidden="true"><i style={{ left: `${f.position * 100}%` }} /></span>}{f.text}</dd>}
    <dd className={acts.fine}>{f.kind && <Chip kind={f.kind} />}{f.fine}</dd>
  </div>)}</dl>;
  const figureBand = band(figures);
  // The renting reader's four: asking rent, what tenants pay, five-year change, cost burden.
  const rentChange = packet.metrics.find((m) => m.metric_id === "zori_all");
  const rentChangePosition = rentChange?.rank && rentChange.of && rentChange.of > 1 ? 1 - (rentChange.rank - 1) / (rentChange.of - 1) : null;
  const burdenRow = level("acs_renter_cost_burden"), vacancyRow = level("acs_rental_vacancy_rate");
  const rentFigures: Figure[] = [
    askRow && { label: "Typical asking rent", value: money(askRow.value), kind: kind("zori_all"), ...standing("zori_all"), fine: `${asOf(askRow)} · Zillow` },
    paidRow && { label: "Median rent tenants pay, with utilities", value: money(paidRow.value), kind: kind("acs_median_gross_rent"), ...standing("acs_median_gross_rent"), fine: `${paidRow.period_end.slice(0, 4)} · Census ACS` },
    rentChange && { label: `Asking rent, ${rentChange.window_start.slice(0, 4)} to ${rentChange.window_end.slice(0, 4)}`, value: formatChange(rentChange.pct_change), kind: kind("zori_all"), position: rentChangePosition,
      text: rentChangePosition === null ? null : rentChangePosition >= 0.5 ? `A bigger change than ${Math.min(Math.round(rentChangePosition * 100), 99)}% of ${rentChange.of} ${unitPlural}` : `A smaller change than ${Math.min(100 - Math.round(rentChangePosition * 100), 99)}% of ${rentChange.of} ${unitPlural}`, fine: "Zillow" },
    burdenRow && { label: "Renters paying over 30% of income", value: `${(burdenRow.value * 100).toFixed(0)}%`, kind: kind("acs_renter_cost_burden"), ...standing("acs_renter_cost_burden"), fine: `${burdenRow.period_end.slice(0, 4)} · Census ACS` },
  ].flatMap((figure) => (figure ? [figure] : []));

  // A place with few figures says so, and names what no source publishes for it.
  const absent = [!medianSale && "recorded home sales", !homeRow && "a Zillow home value", !taxBill && "a median property tax bill", !askRow && !paidRow && "rents"].flatMap((item) => (item ? [item] : []));
  const thinLine = figures.length <= 2 && absent.length > 0 ? <p className={acts.thin}>Few figures are published for {name}. Not available here: {absent.join(", ")}. Small places often have too few sales or survey answers for a source to report. <Link href={`${regionPath(regionId)}/report`}>Everything that is published</Link></p> : null;

  // What stands out: the measures where this place sits at one end of its peers, each
  // handing on to the story that explains it, or to the report where no story does.
  const topicFor = (id: string): PlaceStoryTopic | null => /^(zhvi|zori|acs_median_(hh_income|home_value)|price_to|rent_to|sale_price_to)/.test(id) ? "market" : /^sr1a/.test(id) ? "sales" : /^(chas|acs_(renter|owner)_(cost|severe))/.test(id) ? "pressure" : /^hmda/.test(id) ? "lending"
    : /^(permits|nj_units|nj_net_units|nj_cert|nj_demo)/.test(id) ? "building" : /^(irs|net_migration)/.test(id) ? "migration" : /^(lodes|transit|acs_commute|acs_mean_commute|acs_work_from)/.test(id) ? "commute" : /^acs_(k12|k8|hs)_/.test(id) ? "schools" : /^(fema|njdep_tidal)/.test(id) ? "flood" : /^njdep_sites/.test(id) ? "sites" : /^water_/.test(id) ? "water" : null;
  const inHeader = new Set(["sr1a_median_sale_price", "sr1a_price_lower_quartile", "sr1a_price_upper_quartile", "sr1a_median_sale_price_12m", "modiv_median_tax_bill", "zhvi_sfr", "zhvi_bottom_tier"]);
  const atAnEnd = (detail: string) => (/^the (highest|lowest)/.test(detail) ? 0 : 1);
  // Not news: counts that follow a place's size, and a median year built "changing".
  const dull = /(population|housing_units|year_built|parcels|resident_jobs)/;
  const family = (id: string) => (/tax_rate/.test(id) ? "tax_rate" : /^acs_median_rent_/.test(id) ? "rent_by_size" : id);
  // In the reader's order: money, then risk, then the daily round, then the rest.
  const weight = (id: string) => (/(tax|rent|income|price|zhvi|zori|cost|burden|hmda)/.test(id) ? 0 : /(fema|flood|sites|water_|noise)/.test(id) ? 1 : /(commute|transit|lodes|k12|k8|_hs_|work_from)/.test(id) ? 2 : 3);
  const strict = standOuts(packet, uncertainties).filter((o) => !inHeader.has(o.metric_id) && !dull.test(o.metric_id));
  // The packet's rule is the outer 5%. Where that leaves the strip short, measures whose
  // whole range sits in the outer tenth fill it, worded as a share and never as "the highest". Prices are left out: the header leads with one.
  const near = comparisonMeasures(packet.levels, uncertainties, packet.levels.map((l) => l.metric_id)).filter((m) => (m.low >= 0.9 || m.high <= 0.1) && !inHeader.has(m.row.metric_id) && !dull.test(m.row.metric_id) && !/^(acs_share_|sr1a_|zhvi|acs_median_home_value)|_count$/.test(m.row.metric_id) && m.row.unit !== "count" && !strict.some((o) => o.metric_id === m.row.metric_id))
    .map((m) => ({ metric_id: m.row.metric_id, label: m.label, group: "value" as const, rank: "", figure: m.row.unit === "year" ? String(Math.round(m.row.value)) : formatMetric(m.row.value, m.row.unit, m.row.metric_id), margin: null, detail: m.position >= 0.5 ? `higher than ${Math.min(Math.round(m.position * 100), 99)}% of ${m.row.of}` : `lower than ${Math.min(Math.round((1 - m.position) * 100), 99)}% of ${m.row.of}` }));
  const byReader = <T extends { metric_id: string; detail: string }>(list: T[]) => [...list].sort((a, b) => weight(a.metric_id) - weight(b.metric_id) || atAnEnd(a.detail) - atAnEnd(b.detail));
  // One fill-in per subject, so a building boom is not told twice.
  const outs = [...byReader(strict), ...byReader(near).filter((o, i, all) => all.findIndex((other) => (topicFor(other.metric_id) ?? other.metric_id) === (topicFor(o.metric_id) ?? o.metric_id)) === i)]
    .filter((o, i, all) => all.findIndex((other) => family(other.metric_id) === family(o.metric_id)) === i).slice(0, 3);
  const standStrip = outs.length > 0 && <div className={acts.stand}>
    <h2>What stands out</h2>
    <ul>{outs.map((o) => { const topic = topicFor(o.metric_id), told = topic && story(topic) ? topic : null; return <li key={`${o.metric_id}-${o.group}`}><Link href={told ? placeStoryHref(told, regionId) : `${regionPath(regionId)}/report`} prefetch={false}>
      <strong>{o.figure}</strong>
      <span>{o.label}{o.group === "value" ? "" : ", five-year change"}</span>
      <small>{o.group === "value" ? `${o.detail.charAt(0).toUpperCase()}${o.detail.slice(1)} ${unitPlural}` : `${o.rank} ${unitPlural}`} · {told ? `Story: ${PLACE_STORIES[told].title}` : "In the full report"}</small>
    </Link></li>; })}</ul>
  </div>;

  // The price exhibit: what was recorded first, then the modelled estimate, each labelled.
  const saleStanding = medianSale ? standing("sr1a_median_sale_price").text : null;
  const priceFind = medianSale ? `Homes here sold for a median of ${dollars(medianSale.value)}${saleStanding ? `, ${saleStanding.charAt(0).toLowerCase()}${saleStanding.slice(1)}` : ""}` : `The typical home is valued at ${homeRow ? dollars(homeRow.value) : ""}, ${priceTitle}`;
  const salesFigure = medianSale && q1 && q3 ? <div>
    <p className={acts.sub}>What homes sold for</p>
    <div className={acts.quart}><div><b>{dollars(q1.value)}</b>lower quarter</div><div><b>{dollars(medianSale.value)}</b>median</div><div><b>{dollars(q3.value)}</b>upper quarter</div></div>
    <Prov kind={kind("sr1a_median_sale_price")}>{salesCount ? `${formatMetric(salesCount.value, "count", "sr1a_sales_count")} sales${salesCount.period_start ? `, ${monthYear(salesCount.period_start)} to ${monthYear(salesCount.period_end)}` : ""}` : "Recent sales"}{level("sr1a_median_price_per_sqft") ? ` · ${dollars(level("sr1a_median_price_per_sqft")!.value)} per square foot` : ""}. NJ SR-1A deed records.</Prov>
  </div> : null;
  const estimateFigure = homeRow ? <div>
    <p className={acts.sub}>Zillow’s estimate of the typical home</p>
    <p className={acts.big}>{dollars(homeRow.value)}</p>
    {recent.length > 1 && <>
      <svg className={acts.trend} viewBox="0 0 600 100" preserveAspectRatio="none" role="img" aria-label={`Typical home value from ${trendYears[0]} to ${trendYears[1]}: ${dollars(recent[0])} to ${dollars(recent.at(-1)!)}.`}><polyline points={trend} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
      <p className={acts.ends}><span>{trendYears[0]} · <b>{dollars(recent[0])}</b></span><span>{trendYears[1]} · <b>{dollars(recent.at(-1)!)}</b></span></p>
    </>}
    <Prov kind={kind("zhvi_sfr")}>Zillow Home Value Index, {asOf(homeRow)}{milestones.length ? ` · ${milestones.join(", ")}` : ""}{starter ? ` · starter home ${dollars(starter.value)}` : ""}. The line is drawn to its own range, not from $0.</Prov>
  </div> : null;
  const priceNote = salesFigure && estimateFigure ? <p className={acts.note}>Recorded sales count only the homes that changed hands. Zillow’s figure estimates a typical single-family home, sold or not, so the two differ.</p> : null;

  // Each act closes by handing on: a tool for the question, then the stories behind its figures.
  const tales = (topics: PlaceStoryTopic[]) => { const items = deepStories.filter((item) => topics.includes(item.topic)); return items.length > 0 && <ul className={acts.tales}>{items.map((item) => <li key={item.topic}><Link href={item.href} prefetch={false}>
    <ThemedShot name={`stories/${item.slug}`} width={1440} height={900} className={acts.thumb} />
    <span><strong>{STORIES.find((entry) => entry.href === `/stories/${item.slug}`)?.title ?? item.title}</strong><small>In {name}: {item.headline}</small></span>
  </Link></li>)}</ul>; };
  const said = (items: { value: string; label: string; note?: string }[]) => <dl className={`${acts.rows} ${acts.said}`}>{items.map((item) => <div key={item.label}><dt>{item.label}{item.note && <small>{item.note}</small>}</dt><dd>{item.value}</dd></div>)}</dl>;
  const compareHref = `/compare${placesQuery([regionId, ...(similar?.matches.slice(0, 3).map((m) => m.region_id) ?? [])])}`;
  const reportHref = `${regionPath(regionId)}/report`;
  const taxStanding = taxBill ? standing("modiv_median_tax_bill").text : null;
  const kindLead = [...kinds].sort((a, b) => b.value - a.value)[0];

  // Every ranked measure on one scale, most unusual first, so the outliers lead.
  const profile = [...strips.map((s) => ({ id: s.id as string, label: s.label as string, value: s.value, position: s.position, low: s.low, high: s.high })), ...ground.map((g) => ({ id: g.id, label: g.label, value: g.value, position: g.position, low: g.position, high: g.position }))]
    .sort((a, b) => Math.abs(b.position - 0.5) - Math.abs(a.position - 0.5));
  const profileLead = profile[0];

  const growthTileFor = (title: string) => growthSeries.length > 1 ? <section className={`${acts.tile} ${acts.wide}`}>
        <h3 className={acts.find}>{title}</h3>
        <svg className={styles.scatter} style={{ maxWidth: 720 }} viewBox={`0 0 ${GW} ${GH}`} role="img" aria-label={`${growthSeries.map((g) => `${g.label} ${(g.points.at(-1)!.index - 100).toFixed(0)}%`).join(", ")} since ${growthStart!.slice(0, 4)}.`}>
          <line x1={GL} x2={GW - GR} y1={gy(100)} y2={gy(100)} stroke="currentColor" strokeOpacity="0.4" />
          {growthSeries.map((g) => <polyline key={g.label} points={g.points.map((p) => `${gx(p.time)},${gy(p.index)}`).join(" ")} fill="none" stroke={g.color} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
        </svg>
        <p className={acts.ends}><span>{growthStart!.slice(0, 4)} · <b>0%</b></span><span>{new Date(Math.max(...growthTimes)).getUTCFullYear()}</span></p>
        <ul className={styles.key}>{growthSeries.map((g) => { const last = g.points.at(-1)!; return <li key={g.label}><i style={{ background: g.color }} />{g.label} <b>{last.index >= 100 ? "+" : "−"}{Math.abs(last.index - 100).toFixed(0)}%</b></li>; })}</ul>
        <Prov kind="modelled"><Glossed text={`Each line starts at 0% in ${growthStart!.slice(0, 4)}, the faint rule, in dollars not adjusted for inflation. Zillow; income is the Census ACS five-year survey, so it moves slowly.`} /></Prov>
      </section> : null;
  const rentLine = growthSeries.find((g) => g.label === "Rent");
  const growthTile = growthSeries.length > 1 ? growthTileFor(`${growthLeader.label} grew fastest: up ${(growthLeader.points.at(-1)!.index - 100).toFixed(0)}% since ${growthStart!.slice(0, 4)}`) : null;
  const rentGrowthTile = growthSeries.length > 1 ? growthTileFor(rentLine ? `Asking rent is ${rentLine.points.at(-1)!.index >= 100 ? "up" : "down"} ${Math.abs(rentLine.points.at(-1)!.index - 100).toFixed(0)}% since ${growthStart!.slice(0, 4)}` : `${growthLeader.label} grew fastest: up ${(growthLeader.points.at(-1)!.index - 100).toFixed(0)}% since ${growthStart!.slice(0, 4)}`) : null;
  const billsTile = bills.length > 0 ? <section className={acts.tile}>
        <h3 className={acts.find}>Utilities run about {dollars(billTotal)} a month</h3>
        <StoryBars rows={bills.map((b) => ({ label: b.label, value: b.value, formatted: dollars(b.value) }))} />
        <Prov kind="survey">Typical bills for homes billed for each, Census ACS. Already counted in the cost to own.</Prov>
      </section> : null;
  const pressureTile = pressureStory ? <section className={`${acts.tile} ${acts.wide} ${styles.pressure}`}>
        <h3 className={acts.find}>{pressureStory.headline}</h3>
        <StoryBars rows={pressureStory.rows} />
        <Prov kind="survey"><span data-terms="off">{pressureStory.source}</span>, {pressureStory.period} · {storyLink("pressure")}</Prov>
      </section> : null;
  const paceTile = domNow && domUsual !== null && county ? <section id="pace" className={`${acts.tile} ${acts.wide}`}>
        <h3 className={acts.find}>Homes in {displayName(county)} sit about {Math.round(domNow.value)} days, {Math.abs(domGap) < 3 ? "close to usual" : domGap < 0 ? `${Math.round(-domGap)} faster than usual` : `${Math.round(domGap)} slower than usual`}</h3>
        <svg className={styles.scatter} viewBox={`0 0 ${DW} ${DH}`} role="img" aria-label={`Median days on market in ${displayName(county)} by month, now ${Math.round(domNow.value)} days, usually ${Math.round(domUsual)}.`}>
          <line x1={DL} x2={DW} y1={dy(domUsual)} y2={dy(domUsual)} stroke="currentColor" strokeOpacity="0.6" strokeDasharray="5 4" />
          <text x={DL + 4} y={dy(domUsual) - 6}>Usual, {Math.round(domUsual)} days</text>
          <line x1={DL} x2={DW} y1={dy(0)} y2={dy(0)} stroke="currentColor" strokeOpacity="0.25" />
          <polyline points={domSeries.map((o, i) => `${dx(i)},${dy(o.value)}`).join(" ")} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />
          <circle cx={dx(domSeries.length - 1)} cy={dy(domNow.value)} r="5" fill="var(--series-2)" />
          {domYears.map(({ year, i }) => <text key={year} x={dx(i)} y={DH - 6} textAnchor="middle">{year}</text>)}
        </svg>
        <Prov kind={kindOf("realtor_median_days_on_market")}><Glossed text={`Median days on market, by month${domYearAgo ? ` · ${Math.round(domYearAgo.value)} days a year earlier` : ""}${domRank && countyWaits.length ? ` · ${ordinal(domRank)} quickest of ${countyWaits.length} NJ counties` : ""}. County figures, not this town alone, and they rise and fall with the seasons.`} /> Realtor.com via FRED, {asOf(domNow)}.</Prov>
      </section> : null;
  const priceAct = (salesFigure || estimateFigure) ? <>
    <div className={acts.lead}>
      <h3 className={acts.find}><Glossed text={priceFind} /></h3>
      <div className={acts.cols}>{salesFigure}{estimateFigure}</div>
      {priceNote}
    </div>
    {(growthSeries.length > 1 || paceTile || (ranked.length > 1 && county) || (similar && similar.matches.length > 0 && priceRow)) && <MoreTiles names={[growthSeries.length > 1 && "five-year growth", paceTile && "time to sell", ranked.length > 1 && county && "rank in the county", similar && similar.matches.length > 0 && priceRow && "similar cheaper places"].flatMap((n) => (n ? [n] : []))}>
      {growthTile}
      {paceTile}
      {ranked.length > 1 && county && <section id="county" className={acts.tile}>
        <h3 className={acts.find}>{countyRank === 0 ? `The priciest of ${ranked.length} Zillow-covered towns in ${displayName(county)}` : `${ordinal(countyRank + 1)} of ${ranked.length} Zillow-covered towns in ${displayName(county)}`}</h3>
        {countyFrame && <svg className={acts.mapSmall} viewBox={`0 0 ${countyFrame.width} ${countyFrame.height}`} role="img" aria-label={`Towns in ${displayName(county)} shaded by typical home value, with ${name} outlined.`}>
          {countyShapes.map((shape) => { const shade = priceShade(shape.id); return <path key={shape.id} d={shape.d} fill={shade === null ? "currentColor" : "var(--series-1)"} fillOpacity={shade ?? 0.12} stroke="var(--surface-card)" strokeWidth="0.75"><title>{shape.name}</title></path>; })}
          {countyShapes.filter((shape) => shape.id === regionId).map((shape) => <path key="own" d={shape.d} fill="none" stroke="var(--here)" strokeWidth="2.5" />)}
        </svg>}
        {ranked.filter((t, i) => i < 4 || i >= ranked.length - 2 || t.id === regionId).map((t) => <div key={t.id} className={styles.townBar} data-own={t.id === regionId || undefined}>
          <span>{t.name}</span><div><i style={{ width: `${(t.value / ranked[0].value) * 100}%` }} /></div><strong>{dollars(t.value)}</strong>
        </div>)}
        <Prov kind="modelled">Darker towns cost more; faint towns have no Zillow figure. Zillow, {asOf(homeRow)}. <Link href={regionPath(county.region_id)}>All of {displayName(county)}</Link></Prov>
      </section>}
      {similar && similar.matches.length > 0 && priceRow && <section className={acts.tile}>
        <h3 className={acts.find}>{similar.matches.length} similar {similar.matches.length === 1 ? `${unitWord} costs` : `${unitPlural} cost`} at least {Math.round((1 - similar.cheaper_by) * 100)}% less</h3>
        <div className={acts.similar}>{similar.matches.map((m, i) => { const there = priceRow.values[i + 1], here = priceRow.values[0]; return <Link key={m.region_id} href={regionPath(m.region_id)} prefetch={false}><strong>{m.name}</strong>{there !== null && <span>{dollars(there)}</span>}{there !== null && here !== null && <small>{dollars(here - there)} less</small>}</Link>; })}</div>
        <p className={acts.note}>Alike on the measures the comparison page lists, and cheaper.</p>
      </section>}
    </MoreTiles>}
    <div className={acts.foot}>
      <p className={acts.next}><Link href={compareHref}>Compare {name} side by side</Link><Link href={`/atlas?level=${isZip ? "zip" : "municipality"}&measure=sr1a_median_sale_price&view=latest&place=${regionId}`}>See prices on the map</Link></p>
      {tales(["market", "sales"])}
    </div>
  </> : null;

  const costAct = (month || taxBill || pressureStory || lendingStory) ? <>
    {month && <div id="cost" className={acts.lead}>
      <h3 className={acts.find}>{costTitle}</h3>
      <div className={acts.cols}>
        <div>
          <div className={styles.versus}>
            <div><span>Own</span><strong>{dollars(month.total)}</strong>
              <div className={styles.stack}>{parts.map((p) => <i key={p.label} title={`${p.label}: ${dollars(p.value)}`} style={{ flexGrow: p.value, background: p.color }} />)}</div></div>
            {rent !== null && <div><span>Rent</span><strong>{dollars(rent)}</strong>
              <div className={styles.stack} style={{ width: `${Math.min((rent / month.total) * 100, 100)}%` }}><i style={{ flexGrow: 1, background: "var(--part-4)" }} /></div></div>}
          </div>
          <ul className={styles.key}>{parts.map((p) => <li key={p.label}><i style={{ background: p.color }} />{p.label} {dollars(p.value)}</li>)}</ul>
        </div>
        {ownShare !== null && <div>
          <p className={acts.sub}>{incomeTitle}</p>
          {[["Owning", ownShare], ...(rentShare !== null ? [["Renting", rentShare]] : [])].map(([label, share]) => <div key={label as string} className={styles.meter}>
            <span>{label as string}</span>
            <div><i style={{ width: `${Math.min(share as number, 100)}%` }} /><b style={{ left: "30%" }} /></div>
            <strong>{(share as number).toFixed(0)}%</strong>
          </div>)}
          <p className={acts.note}>The typical home against the median household income, not any one household. The mark is the common 30% guideline.{multiple !== null && lessThanHere !== null ? ` A typical home here costs ${multiple.toFixed(1)} times the typical income, a higher multiple than ${lessThanHere.toFixed(0)}% of ${unitPlural}. ` : " "}{multiple !== null && story("market") && <Link href={placeStoryHref("market", regionId)} prefetch={false}>See every {unitWord} on one chart</Link>}</p>
        </div>}
      </div>
      <Prov kind="calculated">An estimate, not a quote: 20% down at {cost!.rate.value.toFixed(2)}%, {homeRow ? "typical home" : "at a recent sale price"}{rent === null ? "" : rentIsSurvey ? ", against the Census survey’s median rent, which includes long-time tenants" : " and typical rental"}.{month.principal > 0 ? ` About ${dollars(month.principal)} of owning goes into the home.` : ""} Zillow, Census ACS, NJ Division of Taxation, Freddie Mac.</Prov>
    </div>}
    {taxBill && <div id="taxes" className={acts.lead}>
      <h3 className={acts.find}>Property tax is {dollars(taxBill.value)} a year{taxStanding ? `, ${taxStanding.charAt(0).toLowerCase()}${taxStanding.slice(1)}` : ""}</h3>
      <div className={acts.cols}>
        <div>
          <p className={acts.big}>{dollars(taxBill.value / 12)}<small style={{ fontSize: "0.4em", letterSpacing: 0 }}> a month</small></p>
          <p className={acts.note}><Glossed text="Median" /> yearly bill of {dollars(taxBill.value)}{taxRate ? ` at a ${taxRate.value.toFixed(2)}% effective rate` : ""}{taxBillMeasure ? ` · ${ordinal(taxBillMeasure.row.rank!)} highest of ${taxBillMeasure.row.of} ${unitPlural}` : ""}.</p>
          <Prov kind={kind("modiv_median_tax_bill")}>NJ MOD-IV tax records, {taxBill.period_end.slice(0, 4)}.</Prov>
        </div>
        {sameHouseRows.length > 0 && taxRate && <div>
          <p className={acts.sub}>The same {dollars(HOUSE)} house pays {dollars(billFor(taxRate.value))} a year here</p>
          {sameHouseRows.map((row) => <div key={row.key} className={`${styles.townBar} ${acts.sameBar}`} data-own={row.own || undefined}>
            <span>{row.label}</span><div><i style={{ width: `${(row.rate / sameHousePeak) * 100}%` }} /></div><strong>{dollars(billFor(row.rate))}</strong>
          </div>)}
          <p className={acts.note}>{ratio !== null ? `Assessments are ${assessment}: ${ratio.toFixed(0)}% of market value. ` : ""}{revaluedIn ? `Last revaluation ${Math.round(revaluedIn)}. ` : ""}Each town’s effective rate applied to one price, not any home’s actual bill.</p>
          <Prov kind={kind("nj_effective_tax_rate")}>NJ Division of Taxation, {taxRate.period_end.slice(0, 4)}.</Prov>
        </div>}
      </div>
    </div>}
    {(rentSizes.length > 1 || bills.length > 0 || pressureStory || lendingStory) && <MoreTiles names={[rentSizes.length > 1 && "rent by size", bills.length > 0 && "utilities", lendingStory && "mortgages", pressureStory && "cost burden"].flatMap((n) => (n ? [n] : []))}>
      {rentSizes.length > 1 && <section className={acts.tile}>
        <h3 className={acts.find}>Rent by size</h3>
        <StoryBars rows={rentSizes} />
        <Prov kind="survey"><Glossed text="Median" /> gross rent, Census ACS. Lower than the typical market rent above, partly because it includes long-time tenants.</Prov>
      </section>}
      {billsTile}
      {lendingStory && <section className={acts.tile}>
        <h3 className={acts.find}>{lendingStory.headline}</h3>
        <StoryBars rows={lendingStory.rows} />
        {said([level("hmda_denial_rate") && { value: pct("hmda_denial_rate")!, label: "of applications denied" }, level("hmda_median_rate") && { value: `${level("hmda_median_rate")!.value.toFixed(2)}%`, label: "median mortgage rate" }, level("hmda_median_ltv") && { value: `${level("hmda_median_ltv")!.value.toFixed(0)}%`, label: "median loan-to-value" }].flatMap((fact) => (fact ? [fact] : [])))}
        <Prov kind="calculated"><span data-terms="off">{lendingStory.source}</span>, {lendingStory.period} · {storyLink("lending")}</Prov>
      </section>}
      {pressureTile}
    </MoreTiles>}
    <div className={acts.foot}>
      <p className={acts.next}><Link href={`/guide/numbers?place=${regionId}`}>Work it out with your own numbers</Link>{!isZip && <Link href={budgetMapHref({ place: regionId, county: county?.region_id ?? "all" })}>Places within my budget</Link>}{taxBill && <Link href={taxHref}>Look up a property’s tax bill</Link>}<Link href={helpHref}>Housing help</Link></p>
    </div>
  </> : null;

  // The renting reader's first act: asking rent, then what tenants pay, each labelled.
  const fitLine = (values: number[]) => { const hi = Math.max(...values), lo = Math.min(...values); return values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 600},${94 - ((v - lo) / (hi - lo || 1)) * 88}`).join(" "); };
  const rentObs = series.find((item) => item.metricId === "zori_all")?.observations ?? [];
  const rentEnd = rentObs.at(-1)?.period_end;
  const rentRecent = rentEnd ? rentObs.filter((o) => o.period_end >= `${Number(rentEnd.slice(0, 4)) - 10}${rentEnd.slice(4)}`) : [];
  const lower = (text: string | null) => (text ? `, ${text.charAt(0).toLowerCase()}${text.slice(1)}` : "");
  const rentFind = askRow ? `Asking rent is ${dollars(askRow.value)} a month${lower(standing("zori_all").text)}` : paidRow ? `Tenants here pay a median of ${dollars(paidRow.value)} a month${lower(standing("acs_median_gross_rent").text)}` : "";
  const none = (what: string) => <div className={acts.lead}><p className={acts.note}>No {what} is published for {name}. <Link href={reportHref}>Every figure that is, in the full report</Link>.</p></div>;
  const rentAct = (askRow || paidRow) ? <>
    <div className={acts.lead}>
      <h3 className={acts.find}>{rentFind}</h3>
      <div className={acts.cols}>
        {askRow && <div>
          <p className={acts.sub}>Zillow’s estimate of asking rent</p>
          <p className={acts.big}>{dollars(askRow.value)}<small style={{ fontSize: "0.4em", letterSpacing: 0 }}> a month</small></p>
          {rentRecent.length > 1 && <>
            <svg className={acts.trend} viewBox="0 0 600 100" preserveAspectRatio="none" role="img" aria-label={`Typical asking rent from ${rentRecent[0].period_end.slice(0, 4)} to ${rentEnd!.slice(0, 4)}: ${dollars(rentRecent[0].value)} to ${dollars(rentRecent.at(-1)!.value)}.`}><polyline points={fitLine(rentRecent.map((o) => o.value))} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
            <p className={acts.ends}><span>{rentRecent[0].period_end.slice(0, 4)} · <b>{dollars(rentRecent[0].value)}</b></span><span>{rentEnd!.slice(0, 4)} · <b>{dollars(rentRecent.at(-1)!.value)}</b></span></p>
          </>}
          <Prov kind={kind("zori_all")}>Zillow Observed Rent Index, {asOf(askRow)}. The line is drawn to its own range, not from $0.</Prov>
        </div>}
        {paidRow && <div>
          <p className={acts.sub}>What tenants pay now</p>
          <p className={acts.big}>{dollars(paidRow.value)}<small style={{ fontSize: "0.4em", letterSpacing: 0 }}> a month</small></p>
          {rentSizes.length > 1 && <div style={{ marginTop: 14 }}><StoryBars rows={rentSizes} /></div>}
          <Prov kind={kind("acs_median_gross_rent")}><Glossed text="Median" /> gross rent, utilities included, Census ACS five-year survey ending {paidRow.period_end.slice(0, 4)}.</Prov>
        </div>}
      </div>
      <p className={acts.note}>{askRow && paidRow ? "Asking rent is what a new lease costs. The survey’s figure includes long-time tenants and counts utilities, so the two differ." : askRow ? "The Census survey publishes no median rent for this place." : `Zillow publishes no asking rent for ${name}, so this is the Census survey’s figure. It includes long-time tenants, so a new lease usually costs more.`}</p>
    </div>
    {rentGrowthTile && <MoreTiles names={["rent, prices and income since " + growthStart!.slice(0, 4)]}>{rentGrowthTile}</MoreTiles>}
    <div className={acts.foot}>
      <p className={acts.next}><Link href={`${compareHref}&for=rent`}>Compare {name} side by side</Link><Link href="/atlas?level=municipality&measure=zori_all&view=latest">See rents on the map</Link></p>
      {tales(["market"])}
    </div>
  </> : null;

  // The renting reader's second act: rent against income, and who is stretched.
  const rentedShare = owned !== null ? 1 - owned : null;
  const rentCostAct = (rent !== null || pressureTile) ? <>
    {rent !== null && <div className={acts.lead}>
      <h3 className={acts.find}>{rentShare !== null ? `Renting takes ${rentShare.toFixed(0)}% of a typical income here` : `Rent runs ${dollars(rent)} a month`}</h3>
      <div className={acts.cols}>
        <div>
          {rentShare !== null && <div className={styles.meter}><span>Renting</span><div><i style={{ width: `${Math.min(rentShare, 100)}%` }} /><b style={{ left: "30%" }} /></div><strong>{rentShare.toFixed(0)}%</strong></div>}
          <p className={acts.note}>{rentShare !== null ? `${dollars(rent)} a month against the median income of every household, owners included. Renters usually earn less than that, so their own share is usually higher. The mark is the common 30% guideline.` : `${dollars(rent)} a month. No household income is published here to set it against.`}</p>
        </div>
        <div>{said([
          burdenRow && { value: `${(burdenRow.value * 100).toFixed(0)}%`, label: "of renters pay over 30% of their income in rent" },
          rentedShare !== null && { value: `${(rentedShare * 100).toFixed(0)}%`, label: "of homes are rented" },
          vacancyRow && { value: `${(vacancyRow.value * 100).toFixed(1)}%`, label: "of rental homes are vacant" },
          month && { value: dollars(month.total), label: `a month to own the typical home instead, ${(month.total / rent).toFixed(1)} times the rent` },
        ].flatMap((fact) => (fact ? [fact] : [])))}</div>
      </div>
      <Prov kind="calculated">{rentIsSurvey ? "Census survey median rent" : "Zillow asking rent"} against Census ACS income. Shares of renters and homes: Census ACS five-year survey.</Prov>
    </div>}
    {(pressureTile || billsTile) && <MoreTiles names={[pressureTile && "cost burden by income", billsTile && "utilities"].flatMap((n) => (n ? [n] : []))}>
      {pressureTile}
      {billsTile}
    </MoreTiles>}
    <div className={acts.foot}>
      <p className={acts.next}><Link href={helpHref}>Find housing help</Link>{!isZip && <Link href={budgetMapHref({ place: regionId, county: county?.region_id ?? "all", rent: true })}>Places within my budget</Link>}<Link href={`${compareHref}&for=rent`}>Compare rents side by side</Link></p>
    </div>
  </> : null;


  const homesAct = (bedrooms.length > 0 || stock.length > 0 || eras.length > 0 || owned !== null) ? <>
    {(bedrooms.length > 0 || owned !== null || stock.length > 0) && <div id="homes" className={acts.lead}>
      <h3 className={acts.find}>{threePlus > 0 ? `${(threePlus * 100).toFixed(0)}% of homes have three or more bedrooms` : owned !== null ? `${(owned * 100).toFixed(0)}% of homes are owner-occupied` : "The homes here"}</h3>
      <div className={acts.cols}>
        <div>
          {bedrooms.length > 0 && <><div className={styles.stack}>{bedrooms.map((b) => <i key={b.label} title={`${b.label}: ${b.value.toFixed(0)}%`} style={{ flexGrow: b.value, background: b.color }} />)}</div>
            <ul className={styles.key} style={{ marginTop: 8 }}>{bedrooms.map((b) => <li key={b.label}><i style={{ background: b.color }} />{b.label} {b.value.toFixed(0)}%</li>)}</ul></>}
          {owned !== null && <><p className={acts.sub} style={{ marginTop: bedrooms.length > 0 ? 22 : 0 }}>{(owned * 100).toFixed(0)}% of homes are owner-occupied</p>
            <div className={`${styles.split} ${acts.split}`}><i style={{ flexGrow: owned }}>{(owned * 100).toFixed(0)}% own</i><i style={{ flexGrow: 1 - owned }}>{((1 - owned) * 100).toFixed(0)}% rent</i></div></>}
          <Prov kind="survey">Census ACS five-year survey{vacant ? ` · ${pct("acs_vacancy_rate", 1)} of homes vacant${seasonal ? `, ${pct("acs_vacant_seasonal_share")} of those seasonal` : ""}` : ""}.</Prov>
        </div>
        {stock.length > 0 && <div>
          {said(stock)}
          <Prov kind="administrative">NJ MOD-IV tax records, Census Building Permits Survey and NJ DCA.</Prov>
        </div>}
      </div>
    </div>}
    {(eras.length > 0 || kinds.length > 0 || buildingStory || seasonalHomes >= 0.1) && <MoreTiles names={[eras.length > 0 && "age of homes", kinds.length > 0 && "kinds of home", buildingStory && "new building", seasonalHomes >= 0.1 && "seasonal homes"].flatMap((n) => (n ? [n] : []))}>
      {eras.length > 0 && <section className={acts.tile}>
        <h3 className={acts.find}>{eraLead.value.toFixed(0)}% of homes date from {eraLead.label === "Before 1940" ? "before 1940" : eraLead.label === "2000 on" ? "2000 or later" : eraLead.label}</h3>
        <StoryBars rows={eras.map((e) => ({ label: e.label, value: e.value, formatted: `${e.value.toFixed(0)}%` }))} />
        <Prov kind="survey">Census ACS.</Prov>
      </section>}
      {kinds.length > 0 && <section className={acts.tile}>
        <h3 className={acts.find}>{kindLead.value.toFixed(0)}% of homes are {kindLead.label === "Attached" ? "attached houses" : kindLead.label === "Detached houses" ? "detached houses" : `in buildings of ${kindLead.label}`}</h3>
        <StoryBars rows={kinds.map((k) => ({ label: k.label, value: k.value, formatted: `${k.value.toFixed(0)}%` }))} />
        <Prov kind="survey">Census ACS.</Prov>
      </section>}
      {buildingStory && <section className={acts.tile}>
        <h3 className={acts.find}>{buildingStory.headline}</h3>
        <StoryBars rows={buildingStory.rows} />
        <Prov kind="administrative"><span data-terms="off">{buildingStory.source}</span>, {buildingStory.period} · {storyLink("building")}</Prov>
      </section>}
      {seasonalHomes >= 0.1 && <section id="seasonal" className={acts.tile}>
        <h3 className={acts.find}>{(seasonalHomes * 100).toFixed(0)}% of homes here are kept for seasonal use</h3>
        <div className={styles.waffle} role="img" aria-label={`Of every 100 homes, ${homeDots.filter((d) => d === "lived").length} are lived in year-round and ${homeDots.filter((d) => d === "seasonal").length} are seasonal.`}>{homeDots.map((dot, i) => <i key={i} data-kind={dot} style={{ background: dot === "empty" ? "color-mix(in srgb, currentColor 25%, transparent)" : dot === "seasonal" ? "var(--here)" : "var(--series-1)" }} />)}</div>
        <ul className={`${styles.key} ${acts.waffleKey}`}><li><i data-kind="lived" />Lived in</li><li><i data-kind="seasonal" />Seasonal</li><li><i data-kind="empty" />Empty for other reasons</li></ul>
        <Prov kind="survey">Every 100 homes. Census ACS, a five-year survey. “Lived in” means occupied when surveyed; seasonal homes can still be rented in summer.</Prov>
      </section>}
    </MoreTiles>}
    <div className={acts.foot}>
      <p className={acts.next}><Link href={reportHref}>Every housing figure in the full report</Link><Link href={helpHref}>Find affordable housing</Link></p>
    </div>
  </> : null;

  const livingAct = (profile.length > 0 || workBars.length > 0 || privateShare !== null || facts.length > 0 || shops.length > 0) ? <>
    {profile.length > 0 && <div id="ranks" className={acts.lead}>
      <h3 className={acts.find}>{profileLead.label}: {profileLead.position >= 0.5 ? "higher" : "lower"} than {Math.min(Math.round(Math.max(profileLead.position, 1 - profileLead.position) * 100), 99)}% of {peers}</h3>
      <div className={acts.profile}>
        <p className={acts.profileHead} aria-hidden="true"><span /><span><span>Lowest {unitWord}</span><span>Middle</span><span>Highest</span></span><span /></p>
        {profile.map((row) => <div key={row.id}>
          <span>{row.label}</span>
          <div>{row.high > row.low && <u style={{ left: `${row.low * 100}%`, width: `${(row.high - row.low) * 100}%` }} />}<i style={{ left: `${row.position * 100}%` }} /></div>
          <strong>{row.value}</strong>
        </div>)}
      </div>
      <Prov>Each dot is {name} among {peers}, the most unusual measure first. A band is a survey’s margin. Census ACS, FEMA, USGS, NOAA and Microsoft building footprints; shares of homes are calculated here.</Prov>
    </div>}
    {(workBars.length > 0 || privateShare !== null || facts.length > 0 || floodBars.length > 0 || shops.length > 0) && <MoreTiles names={[workBars.length > 0 && "commute", privateShare !== null && "schools", facts.length > 0 && "services and risks", floodBars.length > 0 && "flood claims", shops.length > 0 && "shops"].flatMap((n) => (n ? [n] : []))}>
      {workBars.length > 0 && <section id="workday" className={`${acts.tile} ${acts.wide}`}>
        <h3 className={acts.find}>{elsewhere !== null ? `${elsewhere.toFixed(0)}% of residents work outside ${isZip ? "the ZIP code" : "town"}` : "Where the workday goes"}{leadPlace ? `, most often in ${leadPlace.name}` : ""}</h3>
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
      {privateShare !== null && <section id="schools" className={acts.tile}>
        <h3 className={acts.find}>{((1 - privateShare) * 100).toFixed(0)}% of K–12 students here go to public school</h3>
        <div className={styles.split} style={{ marginBottom: 14 }}><i style={{ flexGrow: 1 - privateShare }}>{((1 - privateShare) * 100).toFixed(0)}% public</i><i style={{ flexGrow: privateShare }}>{(privateShare * 100).toFixed(0)}% private</i></div>
        <StoryBars rows={stages.map((stage) => ({ label: `${stage.label}, private`, value: stage.value, formatted: `${stage.value.toFixed(0)}%` }))} />
        {results.length > 0 && said(results.map((result) => ({ value: `${result.value!.toFixed(0)}%`, label: result.label.replace(": met or exceeded expectations", " met expectations") })))}
        <Prov kind="survey">{districts.length ? `${districts.map((d) => d.name).join(", ")}${resultYear ? `, ${resultYear}` : ""}. ` : ""}Where students live, not where schools are. Charter and vocational schools count as public. Census ACS, NJ Department of Education. · {storyLink("schools")}</Prov>
      </section>}
      {facts.length > 0 && <section id="living" className={acts.tile}>
        <h3 className={acts.find}>Services and risks</h3>
        {said(facts)}
        <Prov>{electric ? `Electricity: ${electric}. ` : ""}FCC, BTS, NJDEP, EPA, NJ BPU and CDC.</Prov>
      </section>}
      {floodBars.length > 0 && <section className={acts.tile}>
        <h3 className={acts.find}>{Math.round(floodBars.reduce((sum, bar) => sum + bar.value, 0)).toLocaleString("en-US")} flood insurance claims in {flood.place ?? name} in 20 years</h3>
        <div className={styles.floodBars} role="img" aria-label={`${Math.round(floodBars.reduce((sum, bar) => sum + bar.value, 0))} insured flood claims from ${floodBars[0].year} to ${floodEnd}.`}>{floodBars.map((bar) => <i key={bar.year} title={`${bar.year}: ${Math.round(bar.value)} claims`} style={{ height: `${Math.max((bar.value / floodPeak) * 100, bar.value > 0 ? 4 : 1)}%` }} />)}</div>
        <p className={styles.boxScale}><span>{floodBars[0].year}</span><span>Peak {Math.round(floodPeak)} in a year</span><span>{floodEnd}</span></p>
        <Prov kind={flood.estimated ? "calculated" : "administrative"}>FEMA flood insurance claims{flood.estimated ? ", estimated for this place from a wider area" : ""}. The newest year is still filling.</Prov>
      </section>}
      {shops.length > 0 && <section className={acts.tile}>
        <h3 className={acts.find}>On the map in {name}</h3>
        {said(shops.map((shop) => ({ value: String(shop.value), label: shop.label })))}
        <Prov kind="administrative">Mapped in OpenStreetMap, so some may be missing.</Prov>
      </section>}
    </MoreTiles>}
    <div className={acts.foot}>
      <p className={acts.next}><Link href="/atlas">Explore these measures on the map</Link><Link href={reportHref}>Every figure, with its source</Link></p>
      {tales(["commute", "flood", "water", "sites", "broadband", "utilities", "health", "migration"])}
    </div>
  </> : null;

  const rentBox = boxes.find((b) => b.id !== "zhvi_sfr");
  const placeChart = (box: typeof homeBox, what: string, who: "buy" | "rent") => box && <figure className={acts.place} data-for={who} role="img" aria-label={`${what}: ${name} ${dollars(box.own)}, median ${dollars(box.box.median)} of ${box.count} ${peers}.`}>
    <figcaption><span>Where {name} sits by {what}, among the {box.count} {peers} with a figure for the same period</span><span>{dollars(box.own)}</span></figcaption>
    <div className={acts.track}><hr /><u style={{ left: `${box.x(box.box.q1)}%`, width: `${box.x(box.box.q3) - box.x(box.box.q1)}%` }} /><b style={{ left: `${box.x(box.box.median)}%` }} /><i style={{ left: `${box.x(box.own)}%` }} /></div>
    <p className={acts.scale}><span>Lowest {dollars(box.box.min)}</span><span>Middle half boxed · median {dollars(box.box.median)}</span><span>Highest {dollars(box.box.max)}</span></p>
  </figure>;

  // The renting reader's opening sentence, by the thirds the home-value sentence uses.
  const rentMeasure = comparisonMeasures(packet.levels, uncertainties, [askRow ? "zori_all" : "acs_median_gross_rent"])[0];
  const third = (lowAt: number, highAt: number) => (lowAt >= 2 / 3 ? "higher than in most of" : highAt <= 1 / 3 ? "lower than in most of" : lowAt >= 1 / 3 && highAt <= 2 / 3 ? "near the middle among" : "difficult to place among");
  const rentPace = rentChange && rentChangePosition !== null ? (rentChange.pct_change < 0 ? "they fell over the past five years" : rentChange.pct_change === 0 ? "they were unchanged over the past five years" : `they rose ${rentChangePosition >= 2 / 3 ? "faster than most" : rentChangePosition <= 1 / 3 ? "more slowly than most" : "at about the typical pace"} over the past five years`) : null;
  const rentHeadline = rentMeasure ? `${askRow ? "Asking rents" : "The rents tenants pay"} in ${name} are ${third(rentMeasure.low, rentMeasure.high)} the ${rentMeasure.row.of} ${unitPlural} ${askRow ? "Zillow covers" : "the Census survey covers"} in ${scopeName(region.state_code)}${askRow && rentPace ? `, and ${rentPace}` : ""}.` : null;

  if (isCounty) {
    const hasCosts = !!(homeRow || month || taxBill), hasMarket = strips.length > 0 || !!pressureStory || !!domNow || !!persistence || movers.length > 1, hasLife = workBars.length > 0 || heatSeries.length > 20 || seasonalHomes >= 0.1;
    const hasRent = !!(rentAct || rentCostAct);
    const countyLinks = [["county", "Towns compared"], ["costs", "Cost to buy or rent"], ["market", "The market"], ["life", "Living here"], ["stories", "Stories"]].filter(([id]) => id === "county" ? !!countyFrame : id === "costs" ? hasCosts || hasRent : id === "market" ? hasMarket : id === "life" ? hasLife : deepStories.length > 0).map(([id, label]) => ({ id, label }));
    let step = 0;
    const head = (title: ReactNode, question: ReactNode) => <div className={acts.actHead}><b>{++step}</b>{title}{question}</div>;
    return glossTree(<>
      <Masthead affordability={{ kind: "route" }} />
      <main id="main-content" tabIndex={-1} className={`${styles.poster} ${styles.compact} ${styles.plain} ${acts.page}`} suppressHydrationWarning>
        <InlineScript html={TENURE_SCRIPT} />
        <Crumbs trail={[{ href: "/", label: "Home" }, ...stateCrumbs(region.state_code)]} here={name} />
        <PosterNav links={countyLinks} view={hasRent} />

        <header className={`${styles.panel} ${styles.hero} ${acts.hero}`} data-kind="county">
          {region.state_code === "NJ" && <GardenStateArtwork header />}
          <div>
            <p className={styles.kicker}>{scopeName(region.state_code)}{level("acs_population") ? ` · ${formatMetric(level("acs_population")!.value, "count", "acs_population")} residents` : ""} · {townRows.length} towns</p>
            <h1>{name}</h1>
            {hasRent && rentHeadline ? <>{headline && <p className={acts.thesis} data-for="buy">{headline}</p>}<p className={acts.thesis} data-for="rent">{rentHeadline}</p></> : headline && <p className={acts.thesis}>{headline}</p>}
            <ComputedBadge />
          </div>
          {frame && town && <svg viewBox={`0 0 ${frame.width} ${frame.height}`} role="img" aria-label={`${name} on a map of ${scopeName(region.state_code)}`}>
            {counties.map((c) => <path key={c.id} d={c.d} fill="currentColor" fillOpacity={c.id === regionId ? 1 : 0.2} />)}
          </svg>}
          <PlacePhoto geoid={region.geoid} />
          {hasRent && <TenureSwitch />}
          {hasRent ? <>{band(figures, "buy")}{band(rentFigures, "rent")}</> : figureBand}
          {standStrip}
        </header>

        {countyFrame && <section id="county" className={acts.act} data-accent="homes">
          {head(<h2>Its {townRows.length} towns</h2>, <p>How do its towns differ?</p>)}
          <div className={`${styles.panel} ${styles.county}`}>
          {townRanges.length > 0 && <div className={styles.ranges}>{townRanges.map((range) => <div key={range.label}><span>{range.label}</span><strong>{range.low} – {range.high}</strong><small>{range.lowName} to {range.highName}</small></div>)}</div>}
          <CountyAtlas name={name} width={countyFrame.width} height={countyFrame.height} shapes={countyShapes.map(({ id, d }) => ({ id, d }))} towns={townRows} />
          </div>
        </section>}

        {(hasCosts || hasRent) && <section id="costs" className={acts.act} data-accent="cost">
          {hasRent ? head(<><h2 data-for="buy">Cost to buy and own</h2><h2 data-for="rent">Cost to rent</h2></>, <><p data-for="buy">What does a home cost here?</p><p data-for="rent">What does renting cost here?</p></>) : head(<h2>Cost to buy and own</h2>, <p>What does a home cost here?</p>)}
          {hasRent && <><div className={acts.sheet} data-for="rent">{rentAct ?? none("rent")}</div>{rentCostAct && <div className={acts.sheet} data-for="rent">{rentCostAct}</div>}</>}
          <div className={styles.chapterGrid} data-for={hasRent ? "buy" : undefined}>
        {homeRow && <section id="price" className={`${styles.panel} ${styles.price}`}>
          <h2><Glossed text={priceFind} /></h2>
          {salesFigure}
          {estimateFigure && <div className={salesFigure ? styles.building : undefined}>{estimateFigure}</div>}
          {priceNote}
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
            <OwnNumbers income={income} guideHref={`/guide/numbers?place=${regionId}`} source={{ state: region.state_code, price: cost!.home.value, ratePct: cost!.rate.value, taxYear: cost!.tax?.value ?? null, insuranceYear: cost!.insurance?.value ?? null, utilitiesMonth: cost!.utilities?.month ?? null, rentMonth: cost!.rent?.value ?? null }} />
          </details>
          <p className={styles.actions}><Link href={`/guide?place=${regionId}`}>Buyer’s guide</Link><Link href={budgetMapHref({ county: regionId })}>Places within my budget</Link><Link href={helpHref}>Housing help</Link></p>
        </section>}
        {taxBill && <section id="tax" className={`${styles.panel} ${styles.tax}`}>
          <h2>Property tax adds {dollars(taxBill.value / 12)} a month</h2>
          <p className={styles.giant}>{dollars(taxBill.value)}</p>
          <p className={styles.caption}><Glossed text="Median" /> yearly bill{taxRate ? ` · ${taxRate.value.toFixed(2)}% effective rate` : ""}{taxBillMeasure ? ` · ${ordinal(taxBillMeasure.row.rank!)} highest of ${taxBillMeasure.row.of}` : ""}</p>
          {sameHouseRows.length > 0 && taxRate && <div className={styles.building}>
            <p className={acts.sub}>The same {dollars(HOUSE)} house pays {dollars(billFor(taxRate.value))} a year here</p>
            {sameHouseRows.map((row) => <div key={row.key} className={`${styles.townBar} ${acts.sameBar}`} data-own={row.own || undefined}>
              <span>{row.label}</span><div><i style={{ width: `${(row.rate / sameHousePeak) * 100}%` }} /></div><strong>{dollars(billFor(row.rate))}</strong>
            </div>)}
            <Prov kind={kind("nj_effective_tax_rate")}>Each place’s effective rate applied to one price, not any home’s actual bill. NJ Division of Taxation, {taxRate.period_end.slice(0, 4)}.</Prov>
          </div>}
        </section>}
          </div>
        </section>}

        {hasMarket && <section id="market" className={acts.act} data-accent="price">
          {head(<h2>The market</h2>, <p>How does it compare, and where is it heading?</p>)}
          <div className={styles.chapterGrid}>
        {strips.length > 0 && <section id="ranks" className={`${styles.panel} ${styles.rank}`}>
          <h2>Among {scopeName(peer_scope)} {peerNoun(peer_level)}</h2>
          {strips.map((s) => <div key={s.id} className={styles.strip}>
            <span>{s.label}</span>
            <div><u style={{ left: `${s.low * 100}%`, width: `${(s.high - s.low) * 100}%` }} /><i style={{ left: `${s.position * 100}%` }} /></div>
            <strong>{s.value}</strong>
          </div>)}
        </section>}
        {pressureStory && <section id="affordability" className={`${styles.panel} ${styles.pressure}`}>
          <h2>{pressureStory.headline}</h2>
          <StoryBars rows={pressureStory.rows} />
          <p className={styles.caption}><span data-terms="off">{pressureStory.source}</span>, {pressureStory.period} · {storyLink("pressure")}</p>
        </section>}
          {domNow && domUsual !== null && <section className={`${styles.panel} ${styles.pace}`}><h2>Homes sit {Math.round(domNow.value)} days, {Math.abs(domGap) < 3 ? "close to usual" : domGap < 0 ? `${Math.round(-domGap)} faster than usual` : `${Math.round(domGap)} slower than usual`}</h2><MiniLine values={domSeries.map((o) => o.value)} base={domUsual} /><p className={styles.caption}>{domRank ? `${ordinal(domRank)} quickest of ${countyWaits.length} counties. ` : ""}Realtor.com via FRED, {asOf(domNow)}</p></section>}
          {persistence && <section className={`${styles.panel} ${styles.unusual}`}><h2>Prices against incomes: {againstUsual(persistence.vs_median!)} usual</h2><MiniBars values={persistence.series.map((p) => p.vs_median)} /><p className={styles.caption}>{persistence.first_year}–{persistence.last_year}. FHFA and Census</p></section>}
          {movers.length > 1 && <section className={`${styles.panel} ${styles.moving}`}><h2>Moving in and out</h2><div className={styles.moves}>{movers.map((y) => <div key={y.year} title={`${y.year}: ${y.net_per_1000!.toFixed(1)} per 1,000 households`}><i data-gain={y.net_per_1000! > 0 || undefined} style={{ height: `${(Math.abs(y.net_per_1000!) / moverPeak) * 50}%` }} /><span>{String(y.year).slice(2)}</span></div>)}</div><p className={styles.caption}>Net households per 1,000; above the line, more arrived{migration!.arrivals[0] ? `. Most from ${migration!.arrivals[0].name}` : ""}</p></section>}
          </div>
        </section>}

        {hasLife && <section id="life" className={acts.act} data-accent="life">
          {head(<h2>Living here</h2>, <p>What is daily life like across the county?</p>)}
          <div className={styles.chapterGrid}>
        {workBars.length > 0 && <section id="workday" className={`${styles.panel} ${styles.workday}`}>
          <h2>{elsewhere !== null ? `${(100 - elsewhere).toFixed(0)}% of residents’ jobs are in the county` : "Where the workday goes"}{leadPlace ? `, led by ${leadPlace.name}` : ""}</h2>
          {modes.length > 0 && <div className={styles.commute}>
            <div className={styles.stack}>{modes.map((mode) => <i key={mode.label} title={`${mode.label}: ${mode.value.toFixed(0)}%`} style={{ flexGrow: mode.value, background: mode.color }} />)}{modeOther > 0 && <i title={`Other: ${modeOther.toFixed(0)}%`} style={{ flexGrow: modeOther, background: "var(--tick)" }} />}</div>
            <ul className={styles.key}>{modes.map((mode) => <li key={mode.label}><i style={{ background: mode.color }} />{mode.label} {mode.value.toFixed(0)}%</li>)}</ul>
          </div>}
          {workBars.slice(0, 4).map((d) => <div key={d.name} className={styles.townBar}><span>{d.name}</span><div><i style={{ width: `${(d.share / workPeak) * 100}%` }} /></div><strong>{(d.share * 100).toFixed(0)}%</strong></div>)}
        </section>}
          {heatSeries.length > 20 && <section className={`${styles.panel} ${styles.heat}`}><h2>{Math.round(heatNow)} days over 90°F a year, {heatNow >= heatBase ? "up" : "down"} from {Math.round(heatBase)}</h2><MiniBars values={heatSeries.map((o) => o.value)} recent={10} /><p className={styles.caption}>Since {yearOf(heatSeries[0])}, latest ten in orange. NOAA</p></section>}
        {seasonalHomes >= 0.1 && <section className={`${styles.panel} ${styles.seasonal}`}>
          <h2>{(seasonalHomes * 100).toFixed(0)}% of homes are kept for seasonal use</h2>
          <div className={styles.waffle} role="img" aria-label={`Of every 100 homes, ${homeDots.filter((d) => d === "lived").length} are lived in year-round and ${homeDots.filter((d) => d === "seasonal").length} are seasonal.`}>{homeDots.map((dot, i) => <i key={i} data-kind={dot} />)}</div>
          <ul className={styles.key}><li><i data-kind="lived" />Lived in</li><li><i data-kind="seasonal" />Seasonal</li><li><i data-kind="empty" />Other empty</li></ul>
        </section>}
          </div>
        </section>}

        {storyRail}

        {readingPanel && <div className={acts.reading}>{readingPanel}</div>}

        <footer className={styles.close}>Dashed labels mark estimates; solid ones mark records and official figures. Sources: Zillow, Census Bureau, NJ Division of Taxation, FEMA, NOAA, FHFA and Realtor.com. <Link href={`${regionPath(regionId)}/report`}>Every figure in the full report</Link> · <Link href={`/guide?place=${regionId}`}>Buyer’s guide</Link> · <a href={reportPageProblemUrl(regionTitle(region), regionPath(regionId))} target="_blank" rel="noopener noreferrer">Report a problem with this page</a></footer>
      </main>
    </>);
  }

  const actList = ([
    { id: "values", accent: "price", nav: "Prices and rents", title: "Home prices", question: "What do homes cost here?", body: priceAct, rent: { title: "Rents", question: "What does renting cost here?", body: rentAct } },
    { id: "owning", accent: "cost", nav: "Monthly cost", title: "Monthly cost", question: "What would it cost me each month?", body: costAct, rent: { title: "Monthly cost", question: "What would rent take each month?", body: rentCostAct } },
    { id: "housing", accent: "homes", nav: "Homes and people", title: "Homes and people", question: "What kind of housing is here?", body: homesAct, rent: null },
    { id: "area", accent: "life", nav: "Living here", title: "Living here", question: "What is daily life like?", body: livingAct, rent: null },
  ]).filter((act) => act.body !== null || !!act.rent?.body);

  return glossTree(<>
    <Masthead affordability={{ kind: "route" }} />
    <main id="main-content" tabIndex={-1} className={`${styles.poster} ${styles.compact} ${acts.page}`} suppressHydrationWarning>
      <InlineScript html={TENURE_SCRIPT} />
      <Crumbs trail={[{ href: "/", label: "Home" }, ...stateCrumbs(region.state_code), ...(county ? [{ href: regionPath(county.region_id), label: displayName(county) }] : [])]} here={name} />
      <PosterNav links={actList.map(({ id, nav }) => ({ id, label: nav }))} view />

      <header className={`${styles.panel} ${styles.hero} ${acts.hero}`} data-kind={isZip ? "zip" : "town"}>
        {region.state_code === "NJ" && <GardenStateArtwork header />}
        <div>
          <p className={styles.kicker}>{county ? `${displayName(county)}, ` : ""}{scopeName(region.state_code)}{level("acs_population") ? ` · ${formatMetric(level("acs_population")!.value, "count", "acs_population")} residents` : ""}</p>
          <h1>{name}</h1>
          {rentHeadline ? <>{headline && <p className={acts.thesis} data-for="buy">{headline}</p>}<p className={acts.thesis} data-for="rent">{rentHeadline}</p></> : headline && <p className={acts.thesis}>{headline}</p>}
          <ComputedBadge />
        </div>
        {frame && town && <svg viewBox={`0 0 ${frame.width} ${frame.height}`} role="img" aria-label={`${name} on a map of ${scopeName(region.state_code)}`}>
          {counties.map((c) => <path key={c.id} d={c.d} fill="currentColor" fillOpacity={c.id === county?.region_id ? 0.55 : 0.2} />)}
          <circle cx={town.centre[0]} cy={town.centre[1]} r="8" fill="var(--here)" stroke="var(--hero-kind)" strokeWidth="2" />
        </svg>}
        <TenureSwitch />
        {placeChart(saleBox ?? homeBox, saleBox ? "median sale price" : "typical home value", "buy")}
        {placeChart(rentBox, "typical asking rent", "rent")}
        {band(figures, "buy")}
        {band(rentFigures, "rent")}
        {thinLine}
        {standStrip}
      </header>

      {actList.map(({ id, accent, title, question, body, rent: renting }, i) => <section key={id} id={id} className={acts.act} data-accent={accent}>
        <div className={acts.actHead}><b>{i + 1}</b>
          {renting ? <><h2 data-for="buy">{title}</h2><h2 data-for="rent">{renting.title}</h2><p data-for="buy">{question}</p><p data-for="rent">{renting.question}</p></> : <><h2>{title}</h2><p>{question}</p></>}
        </div>
        <div className={acts.sheet}>{renting ? <><div data-for="buy">{body ?? none("sale price or home value")}</div><div data-for="rent">{renting.body ?? none("rent")}</div></> : body}</div>
        {id === "area" && <>
      {county && contextFacts.length > 0 && <details id="county-context" className={`${styles.panel} ${styles.context} ${acts.context}`}>
        <summary><span><strong>{`${displayName(county)} context`}</strong><small>{`The wider market, published by county, not ${name} alone`}</small></span><span className={styles.contextFacts}>{contextFacts.map((fact) => <span key={fact}>{fact}</span>)}</span></summary>
      {heatSeries.length > 20 && county && <section className={styles.contextItem}>
        <h2>{displayName(county)} now passes 90°F about {Math.round(heatNow)} days a year, {heatNow >= heatBase ? "up" : "down"} from {Math.round(heatBase)}</h2>
        <svg className={styles.scatter} viewBox={`0 0 ${HW} ${HH}`} role="img" aria-label={`Days over 90 degrees in ${displayName(county)} each year since ${yearOf(heatSeries[0])}. The last ten years average ${Math.round(heatNow)} days, against ${Math.round(heatBase)} from 1951 to 1980.`}>
          {heatSeries.map((o, i) => <rect key={o.period_end} x={HL + i * barW} y={hy(o.value)} width={Math.max(barW - 1, 1)} height={hy(0) - hy(o.value)} fill={i >= heatSeries.length - 10 ? "var(--series-2)" : "currentColor"} fillOpacity={i >= heatSeries.length - 10 ? 1 : 0.35}><title>{`${yearOf(o)}: ${Math.round(o.value)} days`}</title></rect>)}
          <line x1={HL} x2={HW} y1={hy(heatBase)} y2={hy(heatBase)} stroke="currentColor" strokeDasharray="5 4" />
          <text x={HL + 4} y={hy(heatBase) - 6}>1951–80 average, {Math.round(heatBase)} days</text>
          {heatSeries.filter((o) => yearOf(o) % 20 === 0).map((o) => <text key={o.period_end} x={HL + heatSeries.indexOf(o) * barW} y={HH - 6} textAnchor="middle">{yearOf(o)}</text>)}
        </svg>
        <p className={styles.caption}>Days over 90°F each year; orange is the latest ten, the average in the title{heatRank && allHeat.length ? ` · ${ordinal(heatRank)} hottest of ${allHeat.length} NJ counties` : ""}. A county average, not this town’s readings from NOAA nClimGrid-Daily.{ground.find((g) => g.id === "tree_canopy_homes_share") ? ` Shade: ${ground.find((g) => g.id === "tree_canopy_homes_share")!.value} tree canopy over ${name}’s homes.` : ""}</p>
      </section>}

      {persistence && county && <section className={styles.contextItem}>
        <h2>Against incomes, {displayName(county)} homes are {againstUsual(persistence.vs_median!)} their usual level</h2>
        <svg className={styles.scatter} viewBox={`0 0 ${UW} ${UH}`} role="img" aria-label={`Home prices against income in ${displayName(county)} from ${persistence.first_year} to ${persistence.last_year}, above or below the usual level.`}>
          {persistence.series.map((p) => { const top = Math.min(uY(p.vs_median), uY(0)); return <rect key={p.year} x={UP + (p.year - persistence.first_year) * uStep + 1} y={top} width={Math.max(uStep - 2, 1)} height={Math.max(Math.abs(uY(p.vs_median) - uY(0)), 1)} fill={p.year === persistence.last_year ? "var(--series-2)" : "currentColor"} fillOpacity={p.year === persistence.last_year ? 1 : p.vs_median > 0 ? 0.55 : 0.25}><title>{`${p.year}: ${againstUsual(p.vs_median)} the usual level`}</title></rect>; })}
          <line x1={UP} x2={UW - UP} y1={uY(0)} y2={uY(0)} stroke="currentColor" />
          <text x={UP} y={UH - 6}>{persistence.first_year}</text>
          <text x={UW - UP} y={UH - 6} textAnchor="end">{persistence.last_year}</text>
        </svg>
        <p className={styles.caption}>{persistence.vs_median_low !== null && persistence.vs_median_high !== null ? `Likely between ${againstUsual(persistence.vs_median_low)} and ${againstUsual(persistence.vs_median_high)}. ` : ""}The line is the usual level, the middle of {persistence.years} years{persistence.peak_year ? `; the peak was ${persistence.peak_year}` : ""}. County figures through {persistence.last_year}, not this town. FHFA and Census SAIPE. · <Link href="/stories/is-today-unusual">Full story</Link></p>
      </section>}

        {movers.length > 1 && <div className={styles.contextItem}><h2>Moving in and out of {migration!.county_name} County</h2>
          <div className={styles.moves}>{movers.map((y) => <div key={y.year} title={`${y.year}: ${y.net_per_1000!.toFixed(1)} per 1,000 households`}><i data-gain={y.net_per_1000! > 0 || undefined} style={{ height: `${(Math.abs(y.net_per_1000!) / moverPeak) * 50}%` }} /><span>{String(y.year).slice(2)}</span></div>)}</div>
          <p className={styles.caption}>Net households per 1,000, by year · above the line, more arrived than left{migration!.arrivals[0] ? ` · most arrivals from ${migration!.arrivals[0].name}` : ""}</p></div>}
      </details>}
        </>}
      </section>)}

      {readingPanel && <div className={acts.reading}>{readingPanel}</div>}

      <footer className={styles.close}>Dashed labels mark estimates; solid ones mark records and official figures. Sources: Zillow, Census Bureau, FEMA, NJ Division of Taxation. <Link href={reportHref}>Every figure in the full report</Link> · <a href={reportPageProblemUrl(regionTitle(region), regionPath(regionId))} target="_blank" rel="noopener noreferrer">Report a problem with this page</a></footer>
    </main>
  </>);
}
