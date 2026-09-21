import { AffordCta } from "@/components/AffordCta";
import { CountyExplorer, type Measure } from "@/components/CountyExplorer";
import { Kind } from "@/components/Crumbs";
import { HousingBand } from "@/components/HousingBand";
import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import { api } from "@/lib/api";
import { formatMetric } from "@/lib/format";
import { groupRows } from "@/lib/groups";
import { periodLabel } from "@/lib/periods";
import { WINDOWS } from "@/lib/windows";
import { definitionOf } from "@/lib/definitions";
import { stateProfile } from "@/lib/stateProfile";
import "./new-jersey.css";

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
  const [geo, catalog, states] = await Promise.all([
    api.geo("county"),
    api.metrics(),
    api.regions("level=state&state=NJ&limit=1"),
  ]);
  const state = states?.items[0] ?? null;
  const statewide = state ? await api.summary(state.region_id, "5y") : null;

  if (!geo || !catalog) {
    return (
      <main className="shell">
        <h1 className="page-title">New Jersey</h1>
        <p className="meta">
          The API is unreachable, so there is nothing to show. Start it with{" "}
          <code>make api</code>, and check the warehouse is loaded with{" "}
          <code>make pipeline</code>.
        </p>
      </main>
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
    <main className="shell nj-page">
      <header className="page-head nj-head" data-kind="state">
        <div className="region-head-main">
          {population && (
            <aside className="population-summary" aria-label="Population">
              <span className="population-summary-label">Population</span>
              <strong>{formatMetric(population.value, population.unit, population.metric_id)}</strong>
              <span className="population-summary-context">
                <FloatingMetricTerm
                  metricId={population.metric_id}
                  label={`${periodLabel(population.period_end, population.metric_id)} estimate`}
                  definition={definitionOf(population.metric_id)?.what ?? population.label}
                  why={null}
                />
              </span>
            </aside>
          )}
          <Kind kind="state" />
          <h1 className="page-title">New Jersey</h1>
          <p className="nj-intro">The statewide picture. The local differences.</p>
          <p className="nj-deck">Explore housing costs, incomes and change across New Jersey. Start with a measure, then find your place on the map.</p>
          <nav className="nj-jump-links" aria-label="Explore New Jersey">
            <a href="#explorer-heading">Explore the map <span aria-hidden="true">↘</span></a>
            <a href="#nj-afford">Start with your budget <span aria-hidden="true">↗</span></a>
          </nav>
        </div>
      </header>
      <HousingBand items={stateProfile(levels)} title="Across the state" tone="blue" />
      <div className="nj-source-notes">
          {statewideNotes.map((text) => (
            <p key={text} className="table-note">
              {text}
            </p>
          ))}
      </div>

      {initial ? (
        <CountyExplorer
          frame={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
          counties={geo.features.length}
          sections={sections}
          initial={initial}
        />
      ) : (
        <p className="meta">No county rankings are published yet.</p>
      )}
      <section className="nj-next" id="nj-afford" aria-label="Explore affordability">
        <div>
          <p className="eyebrow">From the map to your next move</p>
          <h2>What does this mean for you?</h2>
          <p>A statewide average is a starting point. Compare the places that fit your income, then open a local profile for the costs and trade-offs.</p>
        </div>
        <AffordCta />
      </section>
    </main>
  );
}
