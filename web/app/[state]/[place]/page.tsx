import { reportPageProblemUrl } from "@/lib/reportProblem";
import { stateCrumbs } from "@/lib/states";
import { placesQuery } from "@/lib/compare";
import { AffordForward } from "@/components/AffordForward";
import { Glossed } from "@/components/Glossed";
import { Term } from "@/components/Term";
import { placeRouteParams, regionPath, resolvePlace } from "@/lib/placeRoutes";
import { PlacePhoto } from "@/components/PlacePhoto";
import { PlaceSectionNav } from "@/components/PlaceSectionNav";
import { PlaceMarketOpening } from "@/components/PlaceMarketOpening";
import { marketPortraitData } from "@/lib/marketPortraitData";
import { makePlaceStoryRecord, PLACE_STORIES, storyHistoryMetrics, type PlaceStoryTopic } from "@/lib/placeStories";
import { stampPlaceStory } from "@/lib/placeStoryData";
import { PlaceStoryGallery } from "@/components/PlaceStoryGallery";
import { PlaceComparisonRail } from "@/components/PlaceComparisonRail";
import { CompactAlternatives } from "@/components/CompactAlternatives";
import { SchoolCheck } from "@/components/SchoolCheck";
import { photoFor } from "@/lib/photos";
import "../../place-photo.css";
import "../../horizon-theme.css";
import styles from "../../place-overview.module.css";
import { TREND_METRICS } from "@/lib/trendMetrics";
import { TownRow } from "@/components/TownRow";
import { notFound } from "next/navigation";
import Link from "next/link";

import { CostToOwn } from "@/components/CostToOwn";
import { ForYourHousehold } from "@/components/ForYourHousehold";
import { StepIcon } from "@/components/StepIcon";
import { LocalEvidenceCharts } from "@/components/LocalEvidenceCharts";
import { IncomePressure } from "@/components/IncomePressure";
import "../../income-pressure.css";
import { AbstractField } from "@/components/AbstractField";
import { HomeSales } from "@/components/HomeSales";
import { HomeChecks } from "@/components/HomeChecks";
import { WhoIsMoving } from "@/components/WhoIsMoving";
import { LearningExhibit } from "@/components/LearningExhibit";
import { StateContextExhibits } from "@/components/StateContextExhibits";
import { ExhibitGallery } from "@/components/ExhibitGallery";
import { PaycheckExhibit } from "@/components/ExhibitCharts";
import { HowUnusual } from "@/components/HowUnusual";
import { FloodRisk } from "@/components/FloodRisk";
import { GettingAround } from "@/components/GettingAround";
import { GroundAndWater } from "@/components/GroundAndWater";
import { SimilarPlaces } from "@/components/SimilarPlaces";
import { Utilities } from "@/components/Utilities";
import { CommunityContext } from "@/components/CommunityContext";
import { HomesAdded } from "@/components/HomesAdded";
import { ComputedBadge } from "@/components/ComputedBadge";
import { GardenStateArtwork } from "@/components/GardenStateArtwork";
import { Crumbs, Kind, kindOf } from "@/components/Crumbs";
import { ConsumerReading } from "@/components/ExplanationPanel";
import { EditorialMetrics } from "@/components/EditorialMetrics";
import { IndexedComparison } from "@/components/IndexedComparison";
import { ProfileTicker } from "@/components/StateProfileTicker";
import { Masthead } from "@/components/Masthead";
import { QuietAnchor, QuietCheckTopics, QuietDisclosure, QuietProfile } from "@/components/QuietCounty";
import { RegionStandOuts } from "@/components/RegionStandOuts";
import { api, artifactUrl, type PacketLevel, type Region, regionsWithData } from "@/lib/api";
import { indexedComparison } from "@/lib/chartInsights";
import { costInputs, homePrice } from "@/lib/costInputs";
import { formatMetric } from "@/lib/format";
import { pageMetadata, regionTitle } from "@/lib/meta";
import { loadFloodStory } from "@/lib/placeFloodStory";
import type { Term as GlossaryTerm } from "@/lib/glossary";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { periodLabel, surveyYears } from "@/lib/periods";
import { standOuts } from "@/lib/standouts";
import { firstEnd } from "@/lib/ranks";
import {
  changeMarginLabel,
  marginLabel,
  NO_MARGIN,
  NO_SAMPLING_ERROR,
  uncertaintiesFrom,
} from "@/lib/uncertainty";
import {
  housingProfile,
  verdictHeadline,
  type PaycheckAnswer,
  paycheckAnswers,
  paychecks,
  tradeoff,
  verdict,
} from "@/lib/verdict";

// The only window published per region, and the only one with explanations
// (`manifest.json` → `windows`). Stated on the page rather than offered as a control,
// because a control with one working option is a promise the data cannot keep
// (ARCHITECTURE #125).
const WINDOW = "5y";


/**
 * Which region pages exist: every region carrying data except the state, whose page
 * folded into the New Jersey page (ARCHITECTURE #127).
 *
 * Under `output: "export"` this is what tells Next how many pages to write; without it
 * a dynamic segment has no enumeration and the export fails. Tracts are excluded by
 * `has_data` rather than by naming levels, so a source that starts publishing at tract
 * level would add those pages automatically instead of silently omitting them.
 */
export async function generateStaticParams() {
  const regions = await regionsWithData();
  return placeRouteParams(regions);
}

/**
 * Each place's own title and description (#358), so a browser tab, a search result and a
 * shared link name the town rather than "Housing — United States" on every page.
 */
export async function generateMetadata({ params }: { params: Promise<{ state: string; place: string }> }) {
  const { state, place: slug } = await params;
  const regionId = resolvePlace(state, slug);
  if (regionId === null) return {};
  const region = await api.region(regionId);
  if (!region) return {};
  const place = regionTitle(region);
  return pageMetadata({
    title: `${place} — Housing`,
    description:
      `${placeLine(region)}: home values, rents, what it costs to own or rent, and local ` +
      "conditions, with every figure traced to its public source.",
    path: regionPath(regionId),
  });
}

/** What kind of place this is, in the words a reader uses: "Township in Somerset County". */
function placeLine(region: Region & { ancestors: Region[] }): string {
  const county = region.ancestors.find((a) => a.level === "county");
  const state = scopeName(region.state_code);
  if (region.level === "county") return `County in ${state}`;
  if (region.level === "zip") return `ZIP code in ${state}`;
  // TIGER's legal type is what `name_lsad` adds to the name: "Montgomery township".
  const kind = region.name_lsad?.startsWith(`${region.name} `)
    ? region.name_lsad.slice(region.name.length + 1)
    : "municipality";
  const where = county ? `${displayName(county)}` : state;
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} in ${where}`;
}

/**
 * The population's date and uncertainty, defined in its badge. An ACS five-year estimate
 * is not a count on a date; the badge's change and its sampling caveat belong together.
 */
function asOfTerm(
  population: PacketLevel,
  compared: boolean,
  valueMargin: string | null,
  changeMargin: string | null,
): GlossaryTerm {
  const year = periodLabel(population.period_end);
  const marginNote = valueMargin === NO_SAMPLING_ERROR
    ? "For this area, the Census Bureau uses its population estimates rather than a survey sample. There is no sampling error, but this is still an estimate."
    : valueMargin === NO_MARGIN
      ? "A sampling margin is not available for this estimate."
      : valueMargin?.startsWith("±")
        ? `The published 90% sampling margin is ${valueMargin} people.`
        : "";
  const changeMarginNote = changeMargin === NO_MARGIN
    ? "A sampling margin is not available for the five-year change."
    : changeMargin === NO_SAMPLING_ERROR && valueMargin !== NO_SAMPLING_ERROR
      ? "The five-year change has no sampling error."
      : changeMargin?.startsWith("±")
        ? `The five-year change has a 90% sampling margin of ${changeMargin}.`
        : "";
  return {
    key: "population-as-of",
    title: `As of ${year}`,
    phrases: [],
    definition:
      `The Census Bureau’s American Community Survey population figure covers ` +
      `${surveyYears(population.period_start, population.period_end)}. ` +
      (compared ? "The change compares it with the figure five years earlier. " : "") +
      [marginNote, changeMarginNote].filter(Boolean).join(" "),
  };
}

function changeWords(pct: number): string {
  if (pct === 0) return "unchanged";
  return `${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}%`;
}

/** One short answer to "Did paychecks keep up?": "Homes No". */
function Answer({ label, answer }: { label: string; answer: PaycheckAnswer }) {
  return (
    <span className="answer" data-answer={answer}>
      <span className="k">{label}</span>
      <b>{answer}</b>
    </span>
  );
}

/**
 * A region page, laid out answer first (Milestone 23, layout B, the owner's choice): the
 * head and its verdict, what it costs per month, where the region stands out, and what its
 * housing is like — then separate disclosures for the automated summary and the full data.
 * The stand-outs lead in place of the tables because they are the tables' news; the tables
 * are one click away, and remembered open for a reader who opens them.
 */
export default async function RegionPage({
  params,
}: {
  // Next 16 makes route params a promise; awaiting is required, not optional.
  params: Promise<{ state: string; place: string }>;
}) {
  const { state, place: slug } = await params;
  const regionId = resolvePlace(state, slug);
  if (regionId === null) notFound();

  // The explanations are fetched alongside the data and are allowed to be absent: the
  // dashboard is fully usable with no AI layer at all, so a missing one renders nothing
  // rather than an error or an empty slot (SPEC: the platform stays useful without it).
  const [region, packet, summary, explanations, revised] = await Promise.all([
    api.region(regionId),
    api.packet(regionId, WINDOW),
    api.summary(regionId, WINDOW),
    api.explanations(regionId, WINDOW),
    api.regionRevisions(regionId),
  ]);

  if (!region || !packet) {
    return (
      <>
        <Masthead affordability={{ kind: "route" }} />
        <main id="main-content" tabIndex={-1} className="shell">
          <h1 className="page-title">Region not found</h1>
          <p className="meta">
            No region {regionId}, or the API is unreachable. <Link href="/states/new-jersey">Back to New Jersey</Link>.
          </p>
        </main>
      </>
    );
  }

  // Flood claims: exact by county and ZIP code; a town's estimated from FEMA's block
  // groups (#354), and its county's instead where FEMA's codes leave too many of its
  // claims unplaceable between it and a neighbour (`ownClaimsUsable`).
  const floodClaimsFor = async () => {
    const county = region.ancestors.find((a) => a.level === "county") ?? null;
    // The dataset's newest year, still filling, is the state's: a county, town or ZIP code
    // may have had no claim since years before (`claimsSummary`). A ZIP code has no
    // ancestors, so the state is found by its code.
    const stateId = async () =>
      region.level === "state"
        ? region.region_id
        : (region.ancestors.find((a) => a.level === "state")?.region_id ??
          (await api.regions(`level=state`))?.items.find((r) => r.state_code === region.state_code)?.region_id ??
          null);
    return loadFloodStory(region,county?{region_id:county.region_id,name:displayName(county)}:null,await stateId(),async(id,metric)=>(await api.observations(id,metric))?.observations??[]);
  };
  // BPU's reports came by public-records request (#370); the note says so beside them.
  const bpuInquiry = (await api.freshness())?.sources.find((s) => s.source_id === "nj_bpu_reports")?.inquiries?.at(-1);

  const [series, cost, incomeLimits, construction, floodClaims, water, utilities, workDestinations, similar, community, migration, persistence, pressure] = await Promise.all([
    Promise.all(
      TREND_METRICS.map(async ({ metricId, short }) => ({
        metricId,
        short,
        observations: (await api.observations(regionId, metricId))?.observations ?? [],
      })),
    ),
    costInputs(region.state_code, region.level, packet.levels, packet.metrics),
    api.incomeLimits(regionId),
    // Milestone 39: permits beside DCA's completions and demolitions, year by year.
    Promise.all(
      ["permits_total_units", "nj_units_certified", "nj_units_demolished", "nj_net_units_added"].map(
        async (metricId) => (await api.observations(regionId, metricId))?.observations ?? [],
      ),
    ),
    // Milestone 40: flood claims paid by year, and the water systems serving the place.
    floodClaimsFor(),
    api.waterSystems(regionId),
    api.utilities(regionId),
    // Milestone 45: where residents work.
    api.workDestinations(regionId),
    // Milestone 46: towns like this one but cheaper; a town's only.
    region.level === "municipality" || region.level === "zip" ? api.similarPlaces(regionId) : Promise.resolve(null),
    api.community(regionId),
    // Milestone 50: who moves in and out of the place's county.
    api.migration(regionId),
    // Milestone 52: today's price-to-income against the county's own history.
    region.level === "county" ? api.persistence(regionId) : Promise.resolve(null),
    api.housingPressure(regionId),
  ]);
  // A town or ZIP reads HUD's county Fair Market Rents from its county's packet: HUD sets
  // them for the county's area, and only a county page carries them (Milestone 35).
  const countyLevels =
    incomeLimits && incomeLimits.county_id !== regionId
      ? ((await api.packet(incomeLimits.county_id, WINDOW))?.levels ?? [])
      : [];
  // FHA's county limit (Milestone 48): a county's own packet, or a town's or ZIP's county.
  const fhaLevel = [...packet.levels, ...countyLevels].find((l) => l.metric_id === "hud_fha_limit_1unit");
  const fhaLimit = fhaLevel ? { value: fhaLevel.value, year: Number(fhaLevel.period_end.slice(0, 4)) } : null;
  const trends = series.filter((s) => s.observations.length >= 2);
  const indexedInputs = trends.map(({ metricId, short, observations }) => ({
    metricId,
    label: short,
    points: observations.map((o) => ({ date: o.period_end, value: o.value })),
  }));

  const name = displayName(region);
  const quiet = ["county", "municipality", "zip"].includes(region.level);
  // Deliberately one town for local review, not a platform-wide hierarchy decision.
  const marketFirst = region.state_code === "NJ" && region.geoid === "3402160900";
  const marketCohorts = marketFirst ? await marketPortraitData(region.state_code, packet.levels) : [];
  const placeStoryRecords = marketFirst ? (Object.keys(PLACE_STORIES) as PlaceStoryTopic[]).filter(topic => topic !== "past").map(topic => stampPlaceStory(makePlaceStoryRecord(topic,
    { region_id: regionId, name: region.name, level: region.level, state_code: region.state_code, geoid: region.geoid }, packet.levels,
    { metrics: topic === "market" ? packet.metrics : [],
      history: topic === "market" ? series : topic === "building" ? storyHistoryMetrics(topic).map((metricId, i) => ({ metricId, observations: construction[i] })) : [],
      water: topic === "water" ? water : null, destinations: topic === "commute" ? workDestinations : null,
      pressure: topic === "pressure" ? pressure : null, migration: topic === "migration" ? migration : null,
      flood:topic === "flood" ? floodClaims:null, utilities:topic === "utilities" ? utilities:null, utilityInquiry:topic === "utilities" ? bpuInquiry:null, community:(topic === "broadband" || topic === "health") ? community:null }))) : [];
  const county = region.ancestors.find((a) => a.level === "county");
  // The consumer reading alone since 2026-10-01: the analyst reading is retired
  // (ARCHITECTURE #275), and a file published before then that still carries one is
  // not shown.
  const readings = explanations?.explanations ?? [];
  const consumer = readings.find((r) => r.audience === "consumer") ?? null;
  const population = packet.levels.find((l) => l.metric_id === "acs_population");
  const populationChange = packet.metrics.find((m) => m.metric_id === "acs_population");
  const { peer_count, peer_level, peer_scope } = packet.comparisons;

  // The answers above the tables (Milestone 17), each from figures the tables carry.
  const peers = { name, count: peer_count, noun: peerNoun(peer_level), scope: scopeName(peer_scope) };
  // Each figure's margin and rank range, from the summary rather than the packet
  // (Milestone 28), so no reading goes stale before Milestone 30 takes them in.
  const uncertainties = uncertaintiesFrom(summary);
  const populationChangeMargin = populationChange
    ? changeMarginLabel(
        uncertainties.change.get(populationChange.metric_id)?.margin ?? null,
        populationChange.metric_id,
      )
    : null;
  const populationMargin = population
    ? marginLabel(
        population.value,
        uncertainties.value.get(population.metric_id)?.margin ?? null,
        population.unit,
        population.metric_id,
      )
    : null;
  const lead = verdict(peers, packet.metrics, packet.levels, uncertainties);
  const headline = verdictHeadline(peers, packet.metrics, packet.levels, uncertainties);
  const paid = paychecks(packet.metrics);
  const answers = paycheckAnswers(packet.metrics);
  const trade = tradeoff(peers, packet.levels, uncertainties);
  // Population is promoted to the page head, where it can orient the reader without
  // repeating the same figure in the compact housing profile immediately below.
  // A shown figure that changed after first publication carries when, and what it
  // first said (ARCHITECTURE #410).
  const revisedBy = new Map((revised?.figures ?? []).map((f) => [f.metric_id, f]));
  const profile = housingProfile(packet.levels, packet.metrics, uncertainties)
    .filter((item) => item.metric_id !== "acs_population")
    .map((item) => {
      const change = revisedBy.get(item.metric_id);
      const level = packet.levels.find((l) => l.metric_id === item.metric_id);
      return change && level && level.period_start === change.period_start
        ? { ...item, updated: { from: formatMetric(change.first_value, level.unit, level.metric_id), on: change.last_revised_on } }
        : item;
    });
  const standing = standOuts(packet, uncertainties);
  const editorialItems = quiet ? [
    ["acs_renter_cost_burden","Renters spending over 30% of income on housing"],
    ["acs_homeownership_rate","Occupied homes owned by their residents"],
    ["acs_vacancy_rate","Homes standing empty, including seasonal homes"],
  ].flatMap(([id,label])=>{
    const editorialFigure=packet.levels.find(l=>l.metric_id===id);
    if(!editorialFigure) return [];
    return [<div key={id} className="editorial-metric-content">
    <span className="quiet-label">From the data</span>
    <strong>{formatMetric(editorialFigure.value, editorialFigure.unit, editorialFigure.metric_id)}</strong>
    <span>{label}</span>
    <small>Census <Glossed text="ACS" /> · {surveyYears(editorialFigure.period_start, editorialFigure.period_end)}</small>
    <small>{uncertainties.value.get(editorialFigure.metric_id)?.margin != null ? `90% margin: ${marginLabel(editorialFigure.value, uncertainties.value.get(editorialFigure.metric_id)!.margin, editorialFigure.unit, editorialFigure.metric_id)}` : "Sampling margin unavailable"}</small>
    </div>];
  }) : [];
  const editorialAnnotation = editorialItems.length>0 ? <EditorialMetrics items={editorialItems}/> : null;
  const changePreview = standing.find((item) => item.group === "leads")
    ?? standing.find((item) => item.group === "lags");
  const valuePreview = standing.find((item) => item.group === "value" && item.metric_id !== changePreview?.metric_id)
    ?? standing.find((item) => item.group === "value");
  const changePreviewMetric = packet.metrics.find((metric) => metric.metric_id === changePreview?.metric_id);
  const standoutMeasureCount = new Set(standing.map((item) => item.metric_id)).size;
  const hasIndexedComparison = indexedComparison(indexedInputs) !== null;

  const affordabilityControl = region.level === "county"
    ? { kind: "local" as const, fallbackHref: `/afford?place=${regionId}` }
    : region.level === "zip"
      ? {
          kind: "disabled" as const,
          reason: "Affordability mode is not available for ZIP code profiles",
        }
      : { kind: "route" as const };

  const homeChecks = <QuietDisclosure enabled={quiet} title="Before choosing a home" note="Flood, schools, internet, tax & more — check the property">
    <section className="local-page-group" aria-labelledby="home-checks-heading">
      <h2 id="home-checks-heading">Before choosing a home</h2>
      {quiet && <QuietCheckTopics />}
      <div className="local-checks-grid">
        <FloodRisk name={name} levels={packet.levels} claims={floodClaims.claims} paid={floodClaims.paid}
          unplaced={floodClaims.unplaced} newestYear={floodClaims.newest} claimsPlace={floodClaims.place}
          estimated={region.level === "municipality" && floodClaims.place === null}
          unseparable={floodClaims.unseparable} />
        <GroundAndWater name={name} levels={packet.levels} water={water} />
        <Utilities data={utilities} bpuInquiry={bpuInquiry} />
        <GettingAround name={name} level={region.level} levels={packet.levels} destinations={workDestinations} />
        <CommunityContext data={community} level={region.level} />
      </div>
      <p className="sales-note tax-way-in">
        <Link href={region.level === "municipality" ? `/tax?town=${region.geoid}` : "/tax"}>Look up a property here</Link>: its assessment and last year’s
        tax, found by its address, or by block and lot with its town.
      </p>
      <p className="sales-note guide-way-in">
        <Link href={`/guide?place=${regionId}`}>Buyer’s guide for {name}</Link>: what it would cost you, whether renting
        costs less, and what to check before an offer.
      </p>
      <HomeChecks levels={packet.levels} taxHref={region.level === "municipality" ? `/tax?town=${region.geoid}` : "/tax"} />
    </section>
  </QuietDisclosure>;
  const countyTowns = region.level === "county" ? (await api.regions(`level=municipality&parent_id=${regionId}&limit=1000`))?.items ?? [] : [];

  const householdContent = <><QuietDisclosure enabled={quiet} title="Your income & nearby places" icon={<StepIcon name="budget" />} note="Compare your income with local benchmarks and explore alternatives.">
    <ForYourHousehold state={region.state_code} regionName={name} limits={incomeLimits} levels={packet.levels} countyLevels={countyLevels}
      margins={new Map([...uncertainties.value].map(([metric, u]) => [metric, u.margin]))} />
    {region.level !== "zip" && <p className="household-next">
      <StepIcon name="budget" /><Link href={`/afford?place=${regionId}&county=${region.level === "county" ? regionId : county?.region_id ?? "all"}`}>
        {region.level === "county" ? "Find towns within my budget" : "Compare nearby towns"} <span aria-hidden="true">→</span>
      </Link><span>Starts in {region.level === "county" ? name : county ? displayName(county) : scopeName(region.state_code)}{`. You can search all ${scopeName(region.state_code)}.`}</span>
    </p>}
  </QuietDisclosure></>;

  // Counties only (ARCHITECTURE #368): a town's or ZIP's page never shows one.
  const photo = region.level === "county" ? photoFor(region.geoid) : undefined;
  const housingContext = !marketFirst && quiet && profile.length > 0 ? <QuietProfile items={profile} peers={peerNoun(peer_level)} /> : null;
  const sections = [
    { id: "place-overview", label: "Overview" },
    ...(marketFirst ? [{ id: "place-market", label: "Market at a glance" }] : []),
    ...(countyTowns.length ? [{ id: "county-towns", label: "Towns" }] : []),
    { id: quiet ? "quiet-cost" : "place-costs", label: "Costs" },
    ...(marketFirst ? [{ id: "place-understand", label: "About this place" }] : []),
    ...(!marketFirst ? [{ id: "field-notes", label: "Market" }] : []),
    ...(!marketFirst ? [{ id: "about-getting-around", label: "Getting around" }] : []),
    ...(!marketFirst ? [{ id: "about-living-there", label: "Living there" }] : []),
    ...(similar ? [{ id: "place-explore", label: "Alternatives" }] : []),
  ];

  return (
    <>
      <Masthead affordability={affordabilityControl} />
      <AffordForward placeId={region.level === "zip" ? null : regionId} />
      <main id="main-content" tabIndex={-1} className={`shell atlas-page atlas-local horizon-page ${styles.page}${quiet ? " quiet-county" : ""}${marketFirst ? ` ${styles.fiveSections}` : ""}`} data-region-level={region.level}>
      <header id="place-overview" className={`page-head${photo ? " has-photo" : ""}`} data-kind={kindOf(region.level)}>
        {quiet && region.state_code === "NJ" && <GardenStateArtwork header />}
        <div className="region-head-main">
          <Crumbs
            trail={[
              { href: "/", label: "United States" },
              ...stateCrumbs(region.state_code),
              ...(county ? [{ href: regionPath(county.region_id), label: displayName(county) }] : []),
            ]}
            here={name}
            hereKind={kindOf(region.level)}
          />
          <div className="page-head-eyebrow">
            <Kind kind={kindOf(region.level)} />
            {population && (
              <aside className="population-badge" aria-label="Population">
                <span className="population-badge-year">
                  <Term id={population.metric_id} definition={`${periodLabel(population.period_end)} estimate. ${populationChange ? `${changeWords(populationChange.pct_change)} over ${periodLabel(populationChange.window_start)}–${periodLabel(populationChange.window_end)}. ` : ""}${asOfTerm(
                      population,
                      Boolean(populationChange),
                      populationMargin,
                      populationChangeMargin,
                    ).definition}`} why={null}>{`${formatMetric(population.value, population.unit, population.metric_id)} residents`}</Term>
                </span>
              </aside>
            )}
            <Link className="eyebrow-report" href={`${regionPath(regionId)}/report`}>Full report <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="page-title-row">
            <h1 className="page-title">{name}</h1>
            <div className="place-title-actions"><ComputedBadge /><Link className="place-compare" aria-label={`Compare ${name} with other places`} href={`/compare${placesQuery([regionId])}`}>Compare this place <span aria-hidden="true">↗</span></Link></div>
          </div>
          {/* Every rank names its own cohort now — "12th of 21 NJ counties" — so the
              line that named it once for the whole page is gone (Milestone 28). */}
          {(headline || lead || trade) && (
            <details className="verdict-details orientation-details">
              <summary className="disclose">{marketFirst ? "More market context" : "Market context and figures"} <span className="disclose-hint"><span className="when-closed">Details</span><span className="when-open">Hide</span></span></summary>
              {headline && <p className="verdict region-orientation">{headline}</p>}
              {lead && <p className="verdict-more">{lead}</p>}
              {trade && <p className="verdict-more">{trade}</p>}
            </details>
          )}
          {/* The short answers in the line, the sentences behind them a click away: the
              answer is what a reader came for, the working what some go on to. */}
          {!quiet && paid && answers && (
            <details className="verdict-details">
              <summary className="disclose">
                <span className="verdict-details-label">Did paychecks keep up?</span>
                <Answer label="Homes" answer={answers.homes} />
                {answers.rent && <Answer label="Rent" answer={answers.rent} />}
                <span className="disclose-hint">
                  <span className="when-closed">Details</span>
                  <span className="when-open">Hide</span>
                </span>
              </summary>
              <p className="verdict-more">{paid}</p>
            </details>
          )}
        </div>
        {region.level === "county" && countyTowns.length > 0 && (
          <TownRow name={name} towns={countyTowns.map(t => ({ id: t.region_id, href: regionPath(t.region_id), name: countyTowns.filter(o => displayName(o) === displayName(t)).length > 1 && t.name_lsad ? t.name_lsad.replace(/^./, c => c.toUpperCase()) : displayName(t) }))} />
        )}
        {photo && <PlacePhoto geoid={region.geoid} />}
      </header>

      <PlaceSectionNav sections={sections} />

      {!quiet && <ProfileTicker
        items={profile}
        title="Housing here"
        ariaLabel={`${name} housing profile`}
        className="region-profile-ticker"
        peerLabel={peerNoun(peer_level)}
      />}

      <div className="region-standard-content">

      {marketFirst && profile.length > 0 && <section id="place-housing-profile" className={styles.housingProfile} aria-labelledby="place-housing-profile-heading">
        <h2 id="place-housing-profile-heading">Housing at a glance</h2>
        <QuietProfile items={profile} peers={peerNoun(peer_level)} />
      </section>}

      {marketFirst && <PlaceMarketOpening levels={packet.levels} metrics={packet.metrics}
        uncertainties={uncertainties} peers={peers} ownId={regionId} cohorts={marketCohorts} histories={series}
        reportHref={`${regionPath(regionId)}/report`}
        revisions={new Map([...revisedBy].flatMap(([id, change]) => {
          const row = packet.levels.find(l => l.metric_id === id && l.period_start === change.period_start);
          return row ? [[id, { from: formatMetric(change.first_value, row.unit, id), on: change.last_revised_on }] as const] : [];
        }))} />}

      <div id="place-costs" className="about-anchor" />
      <QuietAnchor enabled={quiet} id="quiet-cost">
      {cost ? (
        <CostToOwn
          {...cost}
          quiet={quiet}
          compactOverview
          overviewContext={housingContext}
          guidePlaceId={regionId}
          householdTools={quiet ? householdContent : undefined}
          comparePlaceId={region.level === "county" || region.level === "municipality" ? region.region_id : undefined}
          showHelp={!incomeLimits}
          fhaLimit={fhaLimit}
        />
      ) : (
        // Said rather than left out, so a thinner page reads as designed, not broken: the
        // section a reader looks for first says why it is empty here.
          <section className="section cost" aria-labelledby="cost-heading">
            <h2 id="cost-heading">What it costs per month</h2>
            {homePrice(packet.levels) === null ? <p className="cost-missing">
              No monthly cost is worked out for {name}. Zillow publishes no home value here,
              and there are too few recent qualifying sales to stand a purchase price on. The
              owner-reported value in the tables is a survey five years old, too old to price a
              mortgage on.
            </p> : <p className="cost-missing">The current mortgage benchmark is unavailable, so a monthly ownership estimate is not shown for {name}.</p>}
          </section>
      )}
      </QuietAnchor>
      {!cost && housingContext}

      <section id="place-understand" className="local-understand-group" aria-label="About this place">
      <QuietAnchor enabled={marketFirst} id="place-about-frame">
      <h2>About this place</h2>

      {!quiet && householdContent}

      {/* What sets the place apart, in three sentences: the model's lead answer, just above
          the computed rankings it is drawn from and does not author (ARCHITECTURE #275,
          #281). "What's changing?" held this place until 2026-10-01; the page's own
          sentences say what changed. */}
      <div id="about-picture" className="about-anchor" />
      <QuietAnchor enabled={quiet} id="quiet-highlights">
      <ConsumerReading reading={consumer} section="what_stands_out" heading={quiet ? "The local picture" : `What stands out in ${name}`} annotation={editorialAnnotation} paperNote={quiet}>
      {!marketFirst && standing.length > 0 && (
        <details className="standouts-disclosure">
          <summary>
            <span className="standouts-disclosure-copy">
              <span className="standouts-disclosure-kicker">Computed rankings</span>
              <strong>Explore the ranked measures</strong>
              <span className="standouts-previews">
                {changePreview && changePreviewMetric && (
                  <span className="standouts-preview">
                    <span className="standouts-preview-basis">5-year change</span>
                    <b>{changePreview.label}</b>
                    <span>{changePreview.rank} · {firstEnd("change", changePreviewMetric.direction)}</span>
                  </span>
                )}
                {valuePreview && (
                  <span className="standouts-preview">
                    <span className="standouts-preview-basis">Current value</span>
                    <b>{valuePreview.label}</b>
                    <span>{valuePreview.detail}</span>
                  </span>
                )}
              </span>
            </span>
            <span className="standouts-disclosure-cue">
              <span className="when-closed">Explore {standoutMeasureCount} {standoutMeasureCount === 1 ? "measure" : "measures"} →</span>
              <span className="when-open">Close ↑</span>
            </span>
          </summary>
          <RegionStandOuts
            name={name}
            peers={`${scopeName(peer_scope)}’s ${peer_count} ${peerNoun(peer_level)}`}
            items={standing}
          />
          <p className="standouts-report-link"><Link href={`${regionPath(regionId)}/report#report-measures`}>See all of them in the full report →</Link></p>
        </details>
      )}
      </ConsumerReading>
      </QuietAnchor>
      {marketFirst && <div className={styles.placeData}>
        <PlaceComparisonRail name={name} peers={`${scopeName(peer_scope)} ${peerNoun(peer_level)}`} levels={packet.levels} uncertainties={uncertainties} reportHref={`${regionPath(regionId)}/report`} revisions={new Map(profile.flatMap(item=>item.updated?[[item.metric_id,item.updated] as const]:[]))}/>
        <PlaceStoryGallery records={placeStoryRecords} artifactUrl={artifactUrl} />
      </div>}
      <ExhibitGallery>
      {!marketFirst && <>
      <h3 className="exhibit-group-head" id="field-notes">The market</h3>
      {!quiet && homeChecks}
      <LearningExhibit kind="The homes that sold">
      <HomeSales name={name} level={region.level} geoid={region.geoid} levels={packet.levels} showLookup={false} portrait={quiet} concise />
      </LearningExhibit>
      <IncomePressure data={pressure} concise />
      <details className="place-evidence-group" id="more-market-evidence">
        <summary><h3>More market evidence</h3><span>Trends, financing, migration and building</span></summary>
        <div className="place-evidence-body">
      {persistence && <LearningExhibit kind="Against its own history"><HowUnusual name={name} data={persistence} interactive={quiet} /></LearningExhibit>}
      <div className="place-exhibit-pair">
      {!marketFirst && quiet && paid && answers && <LearningExhibit kind="Prices & paychecks"><section id="local-price-history" data-jump-label="Did paychecks keep up with housing?"><h3>Prices and income</h3><PaycheckExhibit metrics={packet.metrics} /><div className="local-paychecks"><p className="local-paychecks-heading">The short answer: <Answer label="Homes" answer={answers.homes} />{answers.rent && <Answer label="Rent" answer={answers.rent} />}</p></div></section></LearningExhibit>}
      <StateContextExhibits concise topics={["lending"]} name={name} level={region.level} levels={packet.levels} destinations={workDestinations} community={community} />
      </div>


      {migration && (
      <QuietDisclosure enabled={false} title="Who is moving here" note="Households moving in and out of the county, from tax returns">
        <LearningExhibit kind="Arrivals & departures"><WhoIsMoving name={name} data={migration} exhibit={quiet} concise /></LearningExhibit>
      </QuietDisclosure>
      )}
      {construction.some(series=>series.length>0) && <LearningExhibit kind="Building & demolition">
      <HomesAdded
        exhibit={quiet}
        portrait={quiet}
        concise
        name={name}
        level={region.level}
        permitted={construction[0]}
        completed={construction[1]}
        demolished={construction[2]}
        net={construction[3]}
        levels={packet.levels}
      />
      </LearningExhibit>}
      {!marketFirst && hasIndexedComparison && (
        <section id="trends-exhibits" className="section" aria-labelledby="trends-heading" data-jump-label="Trends">
          <h2 id="trends-heading">Trends</h2>
          <IndexedComparison series={indexedInputs} />
        </section>
      )}
        </div>
      </details>
      </>}
      {!marketFirst && <StateContextExhibits concise topics={["work"]} name={name} level={region.level} levels={packet.levels} destinations={workDestinations} community={community} />}
      {!marketFirst && <LocalEvidenceCharts kind="work" name={name} level={region.level} levels={packet.levels} series={construction} />}
      {!marketFirst && <details className="place-evidence-group" id="about-living-there">
        <summary><h3>Living there</h3><span>{marketFirst ? "Schools, public safety and health" : "Water, flood, services and community"}</span></summary>
        <div className="place-evidence-body">
          {!marketFirst && <>
          <LearningExhibit kind="Ground & water"><GroundAndWater compact name={name} levels={packet.levels} water={water} scope={marketFirst ? "sites" : "all"} /></LearningExhibit>
          <LearningExhibit kind="Flood context"><FloodRisk name={name} levels={packet.levels} claims={floodClaims.claims} paid={floodClaims.paid} unplaced={floodClaims.unplaced} newestYear={floodClaims.newest} claimsPlace={floodClaims.place} estimated={region.level === "municipality" && floodClaims.place === null} unseparable={floodClaims.unseparable} /></LearningExhibit>
          <div id="local-property-evidence" className="property-exhibit-anchor"><LearningExhibit kind="Service providers"><Utilities data={utilities} bpuInquiry={bpuInquiry} /></LearningExhibit></div>
      <StateContextExhibits concise topics={["broadband"]} name={name} level={region.level} levels={packet.levels} destinations={workDestinations} community={community} />
          </>}
          <CommunityContext exhibits data={community} level={region.level} supporting hideBroadband={marketFirst || region.level === "county"} />
        </div>
      </details>}
      </ExhibitGallery>
      </QuietAnchor>
      {marketFirst && <div className={styles.homeChecks}>
        <SchoolCheck data={community} reportHref={`${regionPath(regionId)}/report`}/>
        <p id="place-address-checks-heading" className={styles.homeGuide}>Checking a specific home? <Link href={`/guide?place=${regionId}#guide-checks-heading`}>Open the buyer’s guide →</Link></p>
      </div>}
      </section>
      <div id="place-explore">
      {marketFirst ? <CompactAlternatives name={name} data={similar}/> : <SimilarPlaces name={name} state={region.state_code} data={similar} />}
      </div>

      <p className="place-report-line" id="region-detailed-data">
        Want every figure? <Link href={`${regionPath(regionId)}/report`}>The full report</Link> has each measure ranked, its history, sources and downloads.
        {marketFirst && <> <Link href={`${regionPath(regionId)}/report#report-community`}>Public-safety reporting & sources →</Link></>}
        {" "}Something look wrong? <a href={reportPageProblemUrl(regionTitle(region), regionPath(regionId))} target="_blank" rel="noopener noreferrer">Report a problem with this page</a>.
      </p>
      </div>
      </main>
    </>
  );
}
