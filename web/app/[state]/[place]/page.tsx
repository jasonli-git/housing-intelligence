import { reportPageProblemUrl } from "@/lib/reportProblem";
import { stateCrumbs } from "@/lib/states";
import { AffordForward } from "@/components/AffordForward";
import { Glossed } from "@/components/Glossed";
import { Term } from "@/components/Term";
import { placeRouteParams, regionPath, resolvePlace } from "@/lib/placeRoutes";
import { PlacePhoto } from "@/components/PlacePhoto";
import { photoFor } from "@/lib/photos";
import "../../place-photo.css";
import "../../horizon-theme.css";
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
import { api, type PacketLevel, type Region, regionsWithData } from "@/lib/api";
import { indexedComparison } from "@/lib/chartInsights";
import { costInputs, homePrice } from "@/lib/costInputs";
import { formatMetric } from "@/lib/format";
import { pageMetadata, regionTitle } from "@/lib/meta";
import { hasUnplaced, ownClaimsUsable } from "@/lib/hazards";
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
  const [region, packet, summary, explanations] = await Promise.all([
    api.region(regionId),
    api.packet(regionId, WINDOW),
    api.summary(regionId, WINDOW),
    api.explanations(regionId, WINDOW),
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
  const claimsOf = async (id: number, metricIds: string[]) =>
    Promise.all(metricIds.map(async (m) => (await api.observations(id, m))?.observations ?? []));
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
    const newestYear = async () => {
      const id = await stateId();
      const observations = id === null ? [] : ((await api.observations(id, "fema_flood_claims"))?.observations ?? []);
      return observations.length ? Math.max(...observations.map((o) => Number(o.period_end.slice(0, 4)))) : null;
    };
    if (region.level === "municipality") {
      const [[claims, paid, unplaced], newest] = await Promise.all([
        claimsOf(regionId, ["fema_flood_claims", "fema_flood_claims_paid", "fema_flood_claims_unplaced"]),
        newestYear(),
      ]);
      if (ownClaimsUsable(claims, unplaced) || !county) {
        return { claims, paid, unplaced, newest, place: null, unseparable: false };
      }
      const [countyClaims, countyPaid] = await claimsOf(county.region_id, ["fema_flood_claims", "fema_flood_claims_paid"]);
      return {
        claims: countyClaims,
        paid: countyPaid,
        unplaced: [],
        newest,
        place: displayName(county),
        unseparable: hasUnplaced(unplaced),
      };
    }
    const [[claims, paid], newest] = await Promise.all([
      claimsOf(regionId, ["fema_flood_claims", "fema_flood_claims_paid"]),
      newestYear(),
    ]);
    return { claims, paid, unplaced: [], newest, place: null, unseparable: false };
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
  const profile = housingProfile(packet.levels, packet.metrics, uncertainties).filter(
    (item) => item.metric_id !== "acs_population",
  );
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
      </Link><span>Starts in {region.level === "county" ? name : county ? displayName(county) : scopeName(region.state_code)}. You can search all {scopeName(region.state_code)}.</span>
    </p>}
  </QuietDisclosure></>;

  // Counties only (ARCHITECTURE #368): a town's or ZIP's page never shows one.
  const photo = region.level === "county" ? photoFor(region.geoid) : undefined;

  return (
    <>
      <Masthead affordability={affordabilityControl} />
      <AffordForward placeId={region.level === "zip" ? null : regionId} />
      <main id="main-content" tabIndex={-1} className={`shell atlas-page atlas-local horizon-page${quiet ? " quiet-county" : ""}`} data-region-level={region.level}>
      <header className={`page-head${photo ? " has-photo" : ""}`} data-kind={kindOf(region.level)}>
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
            <ComputedBadge />
          </div>
          {/* Every rank names its own cohort now — "12th of 21 NJ counties" — so the
              line that named it once for the whole page is gone (Milestone 28). */}
          {headline && <p className="verdict region-orientation">{headline}</p>}
          {(lead || trade) && (
            <details className="verdict-details orientation-details">
              <summary className="disclose">See the figures behind this <span className="disclose-hint"><span className="when-closed">Details</span><span className="when-open">Hide</span></span></summary>
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
        <div className="actions">
          <nav className="state-jump place-jump" aria-label="On this page">
            <a href={quiet ? "#quiet-cost" : "#place-costs"}><span>What it costs to own and rent</span><i aria-hidden="true">↓</i></a>
            <a href="#place-understand"><span>About this place</span><i aria-hidden="true">↓</i></a>
            {similar && <a href="#place-explore"><span>Cheaper alternatives</span><i aria-hidden="true">↓</i></a>}
          </nav>
        </div>
        {region.level === "county" && countyTowns.length > 0 && (
          <TownRow name={name} towns={countyTowns.map(t => ({ id: t.region_id, href: regionPath(t.region_id), name: countyTowns.filter(o => displayName(o) === displayName(t)).length > 1 && t.name_lsad ? t.name_lsad.replace(/^./, c => c.toUpperCase()) : displayName(t) }))} />
        )}
        {photo && <PlacePhoto geoid={region.geoid} />}
      </header>

      {quiet ? <QuietProfile items={profile} peers={peerNoun(peer_level)} /> : <ProfileTicker
        items={profile}
        title="Housing here"
        ariaLabel={`${name} housing profile`}
        className="region-profile-ticker"
        peerLabel={peerNoun(peer_level)}
      />}

      <div className="region-standard-content">

      <div id="place-costs" className="about-anchor" />
      <QuietAnchor enabled={quiet} id="quiet-cost">
      {cost ? (
        <CostToOwn
          {...cost}
          quiet={quiet}
          guidePlaceId={regionId}
          householdTools={quiet ? householdContent : undefined}
          comparePlaceId={region.level === "county" || region.level === "municipality" ? region.region_id : undefined}
          showHelp={!incomeLimits}
          fhaLimit={fhaLimit}
        />
      ) : (
        // Said rather than left out, so a thinner page reads as designed, not broken: the
        // section a reader looks for first says why it is empty here.
        homePrice(packet.levels) === null && (
          <section className="section cost" aria-labelledby="cost-heading">
            <h2 id="cost-heading">What it costs per month</h2>
            <p className="cost-missing">
              No monthly cost is worked out for {name}. Zillow publishes no home value here,
              and there are too few recent qualifying sales to stand a purchase price on. The
              owner-reported value in the tables is a survey five years old, too old to price a
              mortgage on.
            </p>
          </section>
        )
      )}
      </QuietAnchor>

      <section id="place-next-step" className="local-next-step-group cost-next-strip" aria-label="Your next step">
      <div className="place-next-destinations">
      <section className="place-guide-entry" id="home-checks-heading" aria-labelledby="place-guide-title">
        <StepIcon name="guide" />
        <div><h3 id="place-guide-title">Planning a purchase here?</h3>
          <p>Buying budget, rent or buy, and checks before an offer.</p>
          <Link href={`/guide?place=${regionId}`}>Open the buyer’s guide for {name} <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      <section id="housing-assistance" className="local-housing-help" aria-labelledby="local-help-heading">
        <StepIcon name="listings" />
        <div>
        <h3 id="local-help-heading">Find housing help</h3>
        <p>Affordable homes, vouchers and local housing authorities.</p>
        <Link href="/help">Explore your options <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      </div>
      </section>

      <section id="place-understand" className="local-understand-group" aria-label="About this place">
      <AbstractField kind="architecture" />
      <h2>About this place</h2>
      <nav className="about-toc" aria-label="About this place">
        {consumer ? <a href="#about-picture">The local picture</a> : standing.length > 0 && <a href="#about-picture">How it ranks</a>}
        <a href="#field-notes">The market</a>
        <a href="#about-getting-around">Getting around</a>
        <a href="#about-living-there">Living there</a>
      </nav>

      {!quiet && householdContent}

      {/* What sets the place apart, in three sentences: the model's lead answer, just above
          the computed rankings it is drawn from and does not author (ARCHITECTURE #275,
          #281). "What's changing?" held this place until 2026-10-01; the page's own
          sentences say what changed. */}
      <div id="about-picture" className="about-anchor" />
      <QuietAnchor enabled={quiet} id="quiet-highlights">
      <ConsumerReading reading={consumer} section="what_stands_out" heading={quiet ? "The local picture" : `What stands out in ${name}`} annotation={editorialAnnotation} paperNote={quiet}>
      {standing.length > 0 && (
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
      <ExhibitGallery>
      <h3 className="exhibit-group-head" id="field-notes">The market</h3>
      {!quiet && homeChecks}
      <LearningExhibit kind="The homes that sold">
      <HomeSales name={name} level={region.level} geoid={region.geoid} levels={packet.levels} showLookup={false} portrait={quiet} />
      </LearningExhibit>
      {persistence && <LearningExhibit kind="Against its own history"><HowUnusual name={name} data={persistence} interactive={quiet} /></LearningExhibit>}
      {quiet && paid && answers && <LearningExhibit kind="Prices & paychecks"><section id="local-price-history" data-jump-label="Did paychecks keep up with housing?"><h3>Did paychecks keep up with housing?</h3><PaycheckExhibit metrics={packet.metrics} /><div className="local-paychecks"><p className="local-paychecks-heading">The short answer: <Answer label="Homes" answer={answers.homes} />{answers.rent && <Answer label="Rent" answer={answers.rent} />}</p></div></section></LearningExhibit>}
      <StateContextExhibits topics={["lending"]} name={name} level={region.level} levels={packet.levels} destinations={workDestinations} community={community} />
      <IncomePressure data={pressure} />

      {migration && (
      <QuietDisclosure enabled={false} title="Who is moving here" note="Households moving in and out of the county, from tax returns">
        <LearningExhibit kind="Arrivals & departures"><WhoIsMoving name={name} data={migration} exhibit={quiet} /></LearningExhibit>
      </QuietDisclosure>
      )}
      {construction.some(series=>series.length>0) && <LearningExhibit kind="Building & demolition">
      <HomesAdded
        exhibit={quiet}
        portrait={quiet}
        name={name}
        level={region.level}
        permitted={construction[0]}
        completed={construction[1]}
        demolished={construction[2]}
        net={construction[3]}
        levels={packet.levels}
      />
      </LearningExhibit>}
      {hasIndexedComparison && (
        <section id="trends-exhibits" className="section" aria-labelledby="trends-heading" data-jump-label="Trends">
          <h2 id="trends-heading">Trends</h2>
          <IndexedComparison series={indexedInputs} />
        </section>
      )}
      <h3 className="exhibit-group-head" id="about-getting-around">Getting around</h3>
      <StateContextExhibits topics={["work"]} name={name} level={region.level} levels={packet.levels} destinations={workDestinations} community={community} />
      <LocalEvidenceCharts kind="work" name={name} level={region.level} levels={packet.levels} series={construction} />
      <h3 className="exhibit-group-head" id="about-living-there">Living there</h3>
          <LearningExhibit kind="Ground & water"><GroundAndWater compact name={name} levels={packet.levels} water={water} /></LearningExhibit>
          <LearningExhibit kind="Flood context"><FloodRisk name={name} levels={packet.levels} claims={floodClaims.claims} paid={floodClaims.paid} unplaced={floodClaims.unplaced} newestYear={floodClaims.newest} claimsPlace={floodClaims.place} estimated={region.level === "municipality" && floodClaims.place === null} unseparable={floodClaims.unseparable} /></LearningExhibit>
          <div id="local-property-evidence" className="property-exhibit-anchor"><LearningExhibit kind="Service providers"><Utilities data={utilities} bpuInquiry={bpuInquiry} /></LearningExhibit></div>
      <StateContextExhibits topics={["broadband"]} name={name} level={region.level} levels={packet.levels} destinations={workDestinations} community={community} />
          <CommunityContext exhibits data={community} level={region.level} supporting hideBroadband={region.level === "county"} />
      </ExhibitGallery>
      </section>
      <div id="place-explore">
      <SimilarPlaces name={name} state={region.state_code} data={similar} />
      </div>

      <p className="place-report-line" id="region-detailed-data">
        Want every figure? <Link href={`${regionPath(regionId)}/report`}>The full report</Link> has each measure ranked, its history, sources and downloads.
        {" "}Something look wrong? <a href={reportPageProblemUrl(regionTitle(region), regionPath(regionId))} target="_blank" rel="noopener noreferrer">Report a problem with this page</a>.
      </p>
      </div>
      </main>
    </>
  );
}
