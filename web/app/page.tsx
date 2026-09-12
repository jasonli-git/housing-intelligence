import { CountyExplorer, type Measure } from "@/components/CountyExplorer";
import { api } from "@/lib/api";
import { formatMetric } from "@/lib/format";
import { project } from "@/lib/geo";
import { groupRows } from "@/lib/groups";
import { periodLabel } from "@/lib/periods";
import { WINDOWS } from "@/lib/windows";

// The figure most readers arrive for. It is where the page opens, not a limit on it.
const DEFAULT_MEASURE = "zhvi_sfr";

// Box the county outlines are projected into. New Jersey is taller than it is wide.
const MAP_WIDTH = 420;
const MAP_HEIGHT = 560;

/**
 * The New Jersey page: the state's counties, compared on whichever measure and window
 * the reader picks.
 *
 * Since Milestone 18 this is also the state's own page. `/regions/1` carried two FHFA
 * index values, their caveat and the footer; its figures are here now, and
 * `public/_redirects` sends the old URL to this one (ARCHITECTURE #127).
 *
 * Every published county ranking is fetched at build and handed to the explorer, so the
 * reader's choices are answered in the browser with no request (#126). The county
 * outlines are projected here, and only the paths travel to the page.
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
          <code>make api</code>, and check the warehouse is loaded with <code>make pipeline</code>.
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
            const ranking = await api.rankings(metric.metric_id, "county", key, 25);
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
  const statewideNotes = (statewide?.caveat_scopes ?? [])
    .filter((scope) => scope.metric_ids.some((id) => levels.some((l) => l.metric_id === id)))
    .map((scope) => scope.text);

  return (
    <main className="shell">
      <header className="page-head">
        <div>
          <h1 className="page-title">New Jersey</h1>
          <p className="meta">
            The state’s {geo.features.length} counties, compared on the measure and window you
            choose. Every county links to its own page and report.
          </p>
          {levels.length > 0 && (
            <p className="statewide">
              <span className="eyebrow">Statewide</span>
              {levels.map((level) => (
                <span key={level.metric_id}>
                  {level.label} <b>{formatMetric(level.value, level.unit, level.metric_id)}</b>{" "}
                  ({periodLabel(level.period_end, level.metric_id)})
                </span>
              ))}
            </p>
          )}
          {statewideNotes.map((text) => (
            <p key={text} className="table-note">
              {text}
            </p>
          ))}
        </div>
      </header>

      {initial ? (
        <CountyExplorer
          map={project(geo.features, MAP_WIDTH, MAP_HEIGHT)}
          sections={sections}
          initial={initial}
        />
      ) : (
        <p className="meta">No county rankings are published yet.</p>
      )}
    </main>
  );
}
