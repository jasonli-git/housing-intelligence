import { type Measure } from "@/components/CountyExplorer";
import { StateFigureNotes } from "@/components/StateFigureNotes";
import { ComputedBadge } from "@/components/ComputedBadge";
import { StateModeWorkspace } from "@/components/StateModeWorkspace";
import { Crumbs, Kind } from "@/components/Crumbs";
import { StateOverview } from "@/components/StateOverview";
import { MoreExpander } from "@/components/MoreExpander";
import { AffordableHousing } from "@/components/AffordableHousing";
import { HomeSales } from "@/components/HomeSales";
import { HomesAdded } from "@/components/HomesAdded";
import { QuietProfile } from "@/components/QuietCounty";
import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import { Masthead } from "@/components/Masthead";
import { api, nationalMortgageRate } from "@/lib/api";
import { formatMetric } from "@/lib/format";
import { groupRows } from "@/lib/groups";
import { periodLabel } from "@/lib/periods";
import { WINDOWS } from "@/lib/windows";
import { definitionOf } from "@/lib/definitions";
import { stateProfile } from "@/lib/stateProfile";
import { stateFigurePeriod } from "@/lib/stateEntry";
import { marginLabel } from "@/lib/uncertainty";
import { constructionYears } from "@/lib/construction";
import "../../new-jersey.css";
import "../../housing-entry.css";
import "../../state-navigation.css";

export const metadata = { title: "New Jersey — Housing", description: "Statewide housing figures, county comparisons and places within your budget in New Jersey." };

// The figure most readers arrive for. It is where the page opens, not a limit on it.
const DEFAULT_MEASURE = "zhvi_sfr";

// The box the map is drawn in. New Jersey is taller than it is wide. Larger since
// Milestone 23: at 420 wide the page read as zoomed out. Since Milestone 16 the outlines
// themselves arrive from `map.json` in the browser, so this is the frame and nothing
// else — the page no longer projects anything.
const MAP_WIDTH = 540;
const MAP_HEIGHT = 580;

// Metrics whose caveat their definition already carries: both FHFA indexes say they are
// published for the state only. The packet's caveat is unchanged; on this page it is
// there for a reader who asks (ARCHITECTURE #146).
const CAVEAT_IN_DEFINITION: ReadonlySet<string> = new Set([
  "fhfa_hpi",
  "fhfa_hpi_all_transactions",
]);

/**
 * The New Jersey page: the state's counties, compared on whichever measure and window
 * the reader picks.
 *
 * Since Milestone 18 this is also the state's own page. `/regions/1` carried two FHFA
 * index values, their caveat and the footer; its figures are here now, and
 * `public/_redirects` sends the old URL to this one (ARCHITECTURE #127).
 *
 * Every published county ranking is fetched at build and handed to the explorer, so the
 * reader's choices are answered in the browser with no request (#126). The outlines are
 * not here at all: the map fetches `map.json` on use, so 48,000 coordinates stay out of
 * this page's payload (#163).
 */
export default async function NewJerseyPage() {
  const [geo, catalog, states, mortgage, countyRegions] = await Promise.all([
    api.geo("county"),
    api.metrics(),
    api.regions("level=state&state=NJ&limit=1"),
    nationalMortgageRate(),
    api.regions("level=county&state=NJ&has_data=true&limit=100"),
  ]);
  const state = states?.items[0] ?? null;
  const statewide = state ? await api.summary(state.region_id, "5y") : null;
  const housingHelp = state ? await api.affordableHousing(state.region_id) : null;
  const construction = await Promise.all(["permits_total_units", "nj_units_certified", "nj_units_demolished", "nj_net_units_added"].map(
    async (metric) => state ? (await api.observations(state.region_id, metric))?.observations ?? [] : [],
  ));

  if (!geo || !catalog) {
    return (
      <>
        <Masthead affordability={{ kind: "local" }} />
        <main className="shell">
          <h1 className="page-title">New Jersey</h1>
          <p className="meta">
            New Jersey’s figures are unavailable right now. Please try again later.
          </p>
        </main>
      </>
    );
  }

  const measures = (
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
  ).filter((measure): measure is Measure => measure !== null);

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
      <main className="shell nj-page quiet-county quiet-state">
      <header className="page-head nj-head" data-kind="state">
        <div className="region-head-main">
          <Crumbs trail={[{ href: "/", label: "United States" }]} here="New Jersey" hereKind="state" />
          <div className="page-head-eyebrow">
            <Kind kind="state" />
            {population && (
              <aside className="population-badge" aria-label="Population">
                <span className="population-badge-year">
                  <FloatingMetricTerm
                    metricId={population.metric_id}
                    label={`${formatMetric(population.value, population.unit, population.metric_id)} residents`}
                    definition={`${periodLabel(population.period_end, population.metric_id)} estimate. ${definitionOf(population.metric_id)?.what ?? population.label}`}
                    why={null}
                  />
                </span>
              </aside>
            )}
          </div>
          <div className="page-title-row">
            <h1 className="page-title">New Jersey</h1>
            <ComputedBadge />
          </div>
        </div>
        <a className="nj-atlas-entry" href="#nj-explore">
          <span className="nj-atlas-count">{geo.features.length}<span>counties</span></span>
          <span className="nj-atlas-entry-label">Compare places <span aria-hidden="true">↘</span></span>
        </a>
      </header>
      <StateOverview hasNotes={statewideNotes.length > 0} levels={levels} mortgage={mortgage} preliminaryYears={constructionYears({ permitted: construction[0], completed: construction[1], demolished: construction[2], net: construction[3] }).filter((row) => row.preliminary).map((row) => row.year)}>
        <details className="state-extra-figures"><summary>More statewide figures <span aria-hidden="true">＋</span></summary>
          <QuietProfile statewide allMetrics items={stateProfile(levels.filter((level) => ["fhfa_hpi", "fhfa_hpi_all_transactions", "nj_effective_tax_rate", "sr1a_median_price_per_sqft", "sr1a_median_year_built_sold", "water_homes_share_public"].includes(level.metric_id)), statewide?.headlines ?? [])} />
        </details>
      </StateOverview>

      <div id="nj-explore" className="nj-explore-anchor">
        {initial ? (
          <StateModeWorkspace
            frame={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
            counties={geo.features.length}
            countyPages={(countyRegions?.items ?? []).map((county) => ({ id: county.region_id, name: county.name }))}
            sections={sections}
            initial={initial}
          />
        ) : (
          <p className="meta">No county rankings are published yet.</p>
        )}
      </div>
      <MoreExpander id="state-detailed-data" title="The statewide evidence" sub="Sales, building activity and every available state figure, with dates and definitions.">
        <div id="housing-assistance"><AffordableHousing data={housingHelp} /></div>
        <HomeSales name="New Jersey" level="state" geoid="34" levels={levels} showLookup={false} portrait />
        <HomesAdded name="New Jersey" level="state" levels={levels} permitted={construction[0]} completed={construction[1]} demolished={construction[2]} net={construction[3]} portrait />
        <section className="section" aria-labelledby="state-figures-heading">
          <div className="section-head"><h2 id="state-figures-heading">All statewide figures</h2></div>
          <div className="scroll-x"><table className="state-figures">
            <thead><tr><th scope="col">Measure</th><th scope="col" className="num">Value</th><th scope="col">Period</th><th scope="col">Source</th></tr></thead>
            <tbody>{levels.map((level) => <tr key={level.metric_id}>
              <th scope="row"><FloatingMetricTerm metricId={level.metric_id} label={level.label} /></th>
              <td className="num">{formatMetric(level.value, level.unit, level.metric_id)}<small className="state-figure-margin">{marginLabel(level.value, level.margin_of_error ?? null, level.unit, level.metric_id)}</small></td>
              <td>{stateFigurePeriod(level)}</td><td>{level.source_id ?? "Not supplied"}</td>
            </tr>)}</tbody>
          </table></div>
          <p className="table-note">Different measures cover different periods. Statewide sale medians describe sold homes, not the value of every home; construction totals include reporting towns only.</p>
        </section>
      </MoreExpander>
      {statewideNotes.length > 0 && <StateFigureNotes notes={statewideNotes} />}
      </main>
    </>
  );
}
