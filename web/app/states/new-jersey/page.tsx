import { Term } from "@/components/Term";
import { PlacePhoto } from "@/components/PlacePhoto";
import "../../place-photo.css";
import type { Metadata } from "next";
import type { Measure } from "@/lib/measures";
import { StateFigureNotes } from "@/components/StateFigureNotes";
import { ComputedBadge } from "@/components/ComputedBadge";
import { StateModeWorkspace } from "@/components/StateModeWorkspace";
import { Crumbs, Kind } from "@/components/Crumbs";
import { StateOverview } from "@/components/StateOverview";
import { PlaceDirectory } from "@/components/PlaceDirectory";
import { PlaceStoryGallery } from "@/components/PlaceStoryGallery";
import { StoryCard } from "@/components/StoryCard";
import { COLLECTIONS } from "@/lib/storyLibrary";
import { STORIES } from "@/lib/stories";
import { makePlaceStoryRecord, PLACE_STORIES, summarizePlaceStory, type PlaceStoryTopic } from "@/lib/placeStories";
import { stampPlaceStory } from "@/lib/placeStoryData";
import { regionPath } from "@/lib/placeRoutes";
import { PlaceSectionNav } from "@/components/PlaceSectionNav";
import layout from "@/components/ExplorationResearch.module.css";
import { HousingMosaic } from "@/components/HousingMosaic";
import { statewideMosaicViews } from "@/lib/housingMosaic";
import { GardenStateArtwork } from "@/components/GardenStateArtwork";
import { MoreExpander } from "@/components/MoreExpander";
import Link from "next/link";
import { Masthead } from "@/components/Masthead";
import { api, artifactUrl, nationalMortgageRate } from "@/lib/api";
import { formatMetric } from "@/lib/format";
import { groupRows } from "@/lib/groups";
import { periodLabel } from "@/lib/periods";
import { WINDOWS } from "@/lib/windows";
import { definitionOf } from "@/lib/definitions";
import { stateFigurePeriod } from "@/lib/stateEntry";
import { marginLabel } from "@/lib/uncertainty";
import { constructionYears } from "@/lib/construction";
import { pageMetadata } from "@/lib/meta";
import "../../new-jersey.css";
import "../../housing-entry.css";
import "../../state-navigation.css";
import "../../horizon-theme.css";
import "../../stories/story-cards.css";
import "../../stories/library.css";

export const metadata: Metadata = pageMetadata({ title: "New Jersey — Housing", description: "Statewide housing figures and places to explore in New Jersey.", path: "/states/new-jersey" });

// Parked pending a future presentation redesign. Preserve the implementation,
// but do not fetch ranking windows or render its controls/table in this build.
const COUNTY_COMPARISON_ENABLED = false;

// Parked for now (owner, 2026-10-29): the table of every statewide figure.
const STATE_EVIDENCE_ENABLED = false;

// The figure most readers arrive for. It is where the page opens, not a limit on it.
const DEFAULT_MEASURE = "zhvi_sfr";

// Metrics whose caveat their definition already carries: both FHFA indexes say they are
// published for the state only. The packet's caveat is unchanged; on this page it is
// there for a reader who asks (ARCHITECTURE #146).
const CAVEAT_IN_DEFINITION: ReadonlySet<string> = new Set([
  "fhfa_hpi",
  "fhfa_hpi_all_transactions",
]);

/**
 * The New Jersey page: statewide figures, county navigation and learning exhibits.
 *
 * Since Milestone 18 this is also the state's own page. `/regions/1` carried two FHFA
 * index values, their caveat and the footer; its figures are here now, and
 * `public/_redirects` sends the old URL to this one (ARCHITECTURE #127).
 *
 * County comparison assembly and components are parked behind the disabled flag.
 * No ranking windows or map geometry are requested while that feature is retired.
 */
export default async function NewJerseyPage() {
  const [catalog, states, mortgage, countyRegions] = await Promise.all([
    api.metrics(),
    api.regions("level=state&state=NJ&limit=1"),
    nationalMortgageRate(),
    api.regions("level=county&state=NJ&limit=100"),
  ]);
  const state = states?.items[0] ?? null;
  const statewide = state ? await api.summary(state.region_id, "5y") : null;
  const pressure = state ? await api.housingPressure(state.region_id) : null;
  const [packet, destinations, community] = state ? await Promise.all([
    api.packet(state.region_id, "5y"), api.workDestinations(state.region_id), api.community(state.region_id),
  ]) : [null, null, null];
  const construction = await Promise.all(["permits_total_units", "nj_units_certified", "nj_units_demolished", "nj_net_units_added"].map(
    async (metric) => state ? (await api.observations(state.region_id, metric))?.observations ?? [] : [],
  ));

  if (!catalog) {
    return (
      <>
        <Masthead affordability={{ kind: "local" }} />
        <main id="main-content" tabIndex={-1} className="shell">
          <h1 className="page-title">New Jersey</h1>
          <p className="meta">
            New Jersey’s figures are unavailable right now. Please try again later.
          </p>
        </main>
      </>
    );
  }

  const measures = COUNTY_COMPARISON_ENABLED ? (
    await Promise.all(
      catalog.map(async (metric): Promise<Measure | null> => {
        const windows: Measure["windows"] = {};
        await Promise.all(
          WINDOWS.map(async ({ key }) => {
            const ranking = await api.rankings(
              metric.metric_id,
              "county",
              key,
              25,
            );
            const items = ranking?.items ?? [];
            if (items.length === 0) return;
            windows[key] = {
              start: items[0].window_start,
              end: items[0].window_end,
              rows: items.map((item) => ({
                id: item.region_id,
                name: item.name,
                rank: item.rank,
                of: item.of,
                change: item.value,
                latest: item.end_value,
                // The ranks a survey measure's margins leave it (Milestone 28).
                best: item.rank_best ?? null,
                worst: item.rank_worst ?? null,
                // And the margins of its change and its latest value (0018).
                changeMargin: item.margin_of_error ?? null,
                latestMargin: item.end_margin ?? null,
              })),
            };
          }),
        );
        return Object.keys(windows).length > 0
          ? {
              metric_id: metric.metric_id,
              label: metric.label,
              unit: metric.unit,
              direction: metric.direction,
              windows,
            }
          : null;
      }),
    )
  ).filter((measure): measure is Measure => measure !== null) : [];

  // The state's own statewide stories (2026-10-29): the place-story cards the county and
  // town pages show, for the topics with statewide records.
  const storyRecords = state && packet ? (Object.keys(PLACE_STORIES) as PlaceStoryTopic[]).filter(topic => topic !== "past").map(topic => stampPlaceStory(makePlaceStoryRecord(topic,
    { region_id: state.region_id, name: state.name, level: state.level, state_code: state.state_code, geoid: state.geoid }, packet.levels,
    { history: topic === "building" ? ["permits_total_units", "nj_units_certified", "nj_units_demolished", "nj_net_units_added"].map((metricId, i) => ({ metricId, observations: construction[i] })) : [],
      destinations: topic === "commute" ? destinations : null, pressure: topic === "pressure" ? pressure : null,
      community: (topic === "broadband" || topic === "health" || topic === "schools") ? community : null }))).filter(record => summarizePlaceStory(record).available) : [];
  const jersey = COLLECTIONS.find(c => c.id === "jersey")!.stories.flatMap(slug => STORIES.filter(story => story.href === `/stories/${slug}`));
  const sections = groupRows(measures);
  const initial = measures.some((m) => m.metric_id === DEFAULT_MEASURE)
    ? DEFAULT_MEASURE
    : measures[0]?.metric_id;
  const levels = statewide?.levels ?? [];
  const population = levels.find((level) => level.metric_id === "pep_population")
    ?? levels.find((level) => level.metric_id === "acs_population");
  const statewideNotes = (statewide?.caveat_scopes ?? [])
    .filter((scope) =>
      scope.metric_ids.some((id) => levels.some((l) => l.metric_id === id)),
    )
    .filter(
      (scope) => !scope.metric_ids.every((id) => CAVEAT_IN_DEFINITION.has(id)),
    )
    .map((scope) => scope.text);

  return (
    <>
      <Masthead affordability={{ kind: "local" }} />
      <main id="main-content" tabIndex={-1} className={`shell nj-page quiet-county quiet-state horizon-page ${layout.statePage}`} data-region-level="state">
      <header className="page-head nj-head has-photo" data-kind="state">
        <GardenStateArtwork header />
        <div className="region-head-main">
          <Crumbs trail={[{ href: "/", label: "United States" }]} here="New Jersey" hereKind="state" />
          <div className="page-head-eyebrow">
            <Kind kind="state" />
            {population && (
              <aside className="population-badge" aria-label="Population">
                <span className="population-badge-year">
                  <Term id={population.metric_id} definition={`${periodLabel(population.period_end, population.metric_id)} estimate. ${definitionOf(population.metric_id)?.what ?? population.label}`} why={null}>{`${formatMetric(population.value, population.unit, population.metric_id)} residents`}</Term>
                </span>
              </aside>
            )}
          </div>
          <div className="page-title-row">
            <h1 className="page-title">New Jersey</h1>
            <p className="state-nickname">The Garden State</p>
            <ComputedBadge />
          </div>

        </div>
        <PlacePhoto geoid="34" />
      </header>
      <PlaceSectionNav label="State sections" sections={[{id:"state-overview",label:"Housing market"},{id:"state-visual-stories",label:"Visual stories"},{id:"state-data-stories",label:"Statewide data"},{id:"state-county-navigation",label:"Counties"},...(STATE_EVIDENCE_ENABLED ? [{id:"state-detailed-data",label:"Every figure"}] : [])]} />
      <div className="state-chapters">
      <StateOverview hasNotes={statewideNotes.length > 0} levels={levels} mortgage={mortgage} preliminaryYears={constructionYears({ permitted: construction[0], completed: construction[1], demolished: construction[2], net: construction[3] }).filter((row) => row.preliminary).map((row) => row.year)}>
        <HousingMosaic embedded statewide name="New Jersey" views={statewideMosaicViews(packet?.levels ?? [], constructionYears({ permitted: construction[0], completed: construction[1], demolished: construction[2], net: construction[3] }).filter(r => r.preliminary).map(r => r.year))} />
      </StateOverview>
      <section id="state-visual-stories" className="state-chapter" aria-labelledby="state-visual-heading">
        <div className="state-chapter-row"><h2 id="state-visual-heading" className="state-chapter-title">Visual stories</h2><Link href="/stories">All stories <span aria-hidden="true">↗</span></Link></div>
        <p className="state-chapter-lede">Only in New Jersey: the state’s character, drawn from the data.</p>
        <div className="state-story-rail" role="region" aria-label="New Jersey visual stories" tabIndex={0}>{jersey.map(story => <StoryCard key={story.href} story={story} />)}</div>
      </section>
      {storyRecords.length > 0 && <section id="state-data-stories" className="state-chapter" aria-labelledby="state-data-heading">
        <h2 id="state-data-heading" className="state-chapter-title">Statewide data</h2>
        <PlaceStoryGallery records={storyRecords} artifactUrl={artifactUrl} title="Statewide stories" statewide />
      </section>}
      <section id="state-county-navigation" className="state-chapter">
        <PlaceDirectory id="state-counties" className="town-pills" title="Counties" destinations={(countyRegions?.items ?? []).map(county => ({ id: county.region_id, name: county.name, href: regionPath(county.region_id) }))} preview={Infinity} />
      </section>
      </div>
      {COUNTY_COMPARISON_ENABLED && <div id="state-county-comparison" className="nj-explore-anchor" data-jump-label="Compare counties">
          <StateModeWorkspace
            sections={sections}
            initial={initial ?? DEFAULT_MEASURE}
          />
      </div>}
      {STATE_EVIDENCE_ENABLED && <MoreExpander id="state-detailed-data" title="The statewide evidence" sub="Every available state figure, with dates, definitions and sources.">
        <section className="section" aria-labelledby="state-figures-heading">
          <div className="section-head"><h2 id="state-figures-heading">All statewide figures</h2></div>
          <div className="scroll-x" tabIndex={0} role="region" aria-label="Data table, scroll horizontally"><table className="state-figures">
            <thead><tr><th scope="col">Measure</th><th scope="col" className="num">Value</th><th scope="col">Period</th><th scope="col">Source</th></tr></thead>
            <tbody>{levels.map((level) => <tr key={level.metric_id}>
              <th scope="row"><Term id={level.metric_id}>{level.label}</Term></th>
              <td className="num">{formatMetric(level.value, level.unit, level.metric_id)}<small className="state-figure-margin">{marginLabel(level.value, level.margin_of_error ?? null, level.unit, level.metric_id)}</small></td>
              <td>{stateFigurePeriod(level)}</td><td>{level.source_id ?? "Not supplied"}</td>
            </tr>)}</tbody>
          </table></div>
          <p className="table-note">Different measures cover different periods. Statewide sale medians describe sold homes, not the value of every home; construction totals include reporting towns only.</p>
        </section>
      </MoreExpander>}
      {statewideNotes.length > 0 && <StateFigureNotes notes={statewideNotes} />}
      </main>
    </>
  );
}
