import Link from "next/link";

import { CurrentValues } from "@/components/CurrentValues";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Definition, Glossed } from "@/components/Glossed";
import { Ledger, TableNotes } from "@/components/Ledger";
import { TrendChart } from "@/components/TrendChart";
import { api, type PacketLevel, type PacketMetric, type Region, regionsWithData } from "@/lib/api";
import { placeCaveats, scopesFor } from "@/lib/caveats";
import { formatMetric } from "@/lib/format";
import type { Term } from "@/lib/glossary";
import { groupRows } from "@/lib/groups";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { periodLabel, surveyYears } from "@/lib/periods";

// The only window published per region, and the only one with explanations
// (`manifest.json` → `windows`). Stated on the page rather than offered as a control,
// because a control with one working option is a promise the data cannot keep
// (ARCHITECTURE #125).
const WINDOW = "5y";

// The series worth plotting on a region page, in the order a reader wants them.
const TREND_METRICS = ["zhvi_sfr", "zori_all", "acs_median_hh_income"];

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
  return regions.filter((r) => r.level !== "state").map((r) => ({ id: String(r.region_id) }));
}

/** What kind of place this is, in the words a reader uses: "Township in Somerset County". */
function placeLine(region: Region & { ancestors: Region[] }): string {
  const county = region.ancestors.find((a) => a.level === "county");
  if (region.level === "county") return "County in New Jersey";
  if (region.level === "zip") return "ZIP code in New Jersey";
  // TIGER's legal type is what `name_lsad` adds to the name: "Montgomery township".
  const kind = region.name_lsad?.startsWith(`${region.name} `)
    ? region.name_lsad.slice(region.name.length + 1)
    : "municipality";
  const where = county ? `${displayName(county)}` : "New Jersey";
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} in ${where}`;
}

/**
 * The population's date, defined where it is stated. An ACS five-year estimate is not a
 * count on a date, so the term names the survey years and what the change compares.
 */
function asOfTerm(population: PacketLevel, compared: boolean): Term {
  const year = periodLabel(population.period_end);
  return {
    key: "population-as-of",
    title: `As of ${year}`,
    phrases: [],
    definition:
      `The Census Bureau’s American Community Survey five-year estimate for the survey ` +
      `years ${surveyYears(population.period_start, population.period_end)}` +
      (compared ? ". The change compares it with the estimate five years earlier." : "."),
  };
}

function changeWords(pct: number): string {
  if (pct === 0) return "unchanged";
  return `${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}%`;
}

function findSeries(metrics: PacketMetric[], levels: PacketLevel[], metricId: string) {
  return metrics.find((m) => m.metric_id === metricId) ?? levels.find((l) => l.metric_id === metricId);
}

export default async function RegionPage({
  params,
}: {
  // Next 16 makes route params a promise; awaiting is required, not optional.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const regionId = Number(id);

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
      <main className="shell">
        <h1 className="page-title">Region not found</h1>
        <p className="meta">
          No region {id}, or the API is unreachable. <Link href="/">Back to New Jersey</Link>.
        </p>
      </main>
    );
  }

  const series = await Promise.all(
    TREND_METRICS.map(async (metricId) => ({
      metricId,
      observations: (await api.observations(regionId, metricId))?.observations ?? [],
    })),
  );
  const trends = series.filter((s) => s.observations.length >= 2);

  const name = displayName(region);
  const county = region.ancestors.find((a) => a.level === "county");
  const readings = explanations?.explanations ?? [];
  const population = packet.levels.find((l) => l.metric_id === "acs_population");
  const populationChange = packet.metrics.find((m) => m.metric_id === "acs_population");
  const { peer_count, peer_level, peer_scope } = packet.comparisons;

  // One set per page: each glossary term is marked the first time it appears.
  const defined = new Set<string>();
  const order = <T extends { metric_id: string }>(rows: T[]) =>
    groupRows(rows).flatMap((section) => section.rows.map((row) => row.metric_id));
  const placement = placeCaveats(
    [order(packet.metrics), order(packet.levels)],
    scopesFor(packet.caveats, summary?.caveat_scopes ?? []),
  );
  const [changes, values] = placement.tables;

  return (
    <main className="shell">
      <header className="page-head">
        <div>
          <p className="crumbs">
            <Link href="/">New Jersey</Link>
            {county && (
              <>
                {" / "}
                <Link href={`/regions/${county.region_id}`}>{displayName(county)}</Link>
              </>
            )}
          </p>
          <h1 className="page-title">{name}</h1>
          <p className="meta">
            {placeLine(region)}
            {population && (
              <>
                {" · "}
                {formatMetric(population.value, population.unit, population.metric_id)} people{" "}
                <Definition term={asOfTerm(population, Boolean(populationChange))}>
                  as of {periodLabel(population.period_end)}
                </Definition>
                {populationChange && `, ${changeWords(populationChange.pct_change)}`}
              </>
            )}
            {" · "}every figure ranked against {scopeName(peer_scope)}’s {peer_count}{" "}
            {peerNoun(peer_level)}
          </p>
        </div>
        <div className="actions">
          <span className="window-note">Change over five years</span>
          <Link className="button" href={`/regions/${regionId}/report`}>
            Report
          </Link>
        </div>
      </header>

      <div className={readings.length > 0 ? "split" : undefined}>
        <div>
          {packet.metrics.length > 0 ? (
            <Ledger metrics={packet.metrics} placement={changes} defined={defined} />
          ) : (
            <p className="meta">
              No figure here has two readings five years apart, so there is no change to
              show. Its current values are below.
            </p>
          )}
          <TableNotes placement={changes} general={placement.general} above="the figures above" />
          {packet.metrics.length > 0 && (
            <p className="table-note">
              Rank 1 is the better end where a measure defines one — the largest rise in
              income, the smallest in unemployment — and otherwise the largest rise.
            </p>
          )}
        </div>
        <ExplanationPanel explanations={readings} />
      </div>

      {trends.length > 0 && (
        <section className="section" aria-labelledby="trends-heading">
          <h2 id="trends-heading">Trends</h2>
          <div className="trends">
            {trends.map(({ metricId, observations }) => {
              const meta = findSeries(packet.metrics, packet.levels, metricId);
              const unit = meta?.unit ?? "";
              return (
                <TrendChart
                  key={metricId}
                  points={observations.map((o) => ({ date: o.period_start, value: o.value }))}
                  title={meta?.label ?? metricId}
                  unit={unit}
                  metricId={metricId}
                >
                  <details>
                    <summary>Values and their sources</summary>
                    <div className="scroll-x">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Period</th>
                            <th scope="col" className="num">
                              Value
                            </th>
                            <th scope="col">Source</th>
                            <th scope="col">Matched by</th>
                          </tr>
                        </thead>
                        <tbody>
                          {observations
                            .slice(-24)
                            .reverse()
                            .map((o) => (
                              <tr key={o.period_start}>
                                <td className="nowrap">{o.period_start}</td>
                                <td className="num">{formatMetric(o.value, unit, metricId)}</td>
                                <td>{o.source_id}</td>
                                <td>{o.match_method}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </TrendChart>
              );
            })}
          </div>
        </section>
      )}

      {packet.levels.length > 0 && (
        <section className="section" aria-labelledby="values-heading">
          <div className="section-head">
            <h2 id="values-heading">Current values</h2>
          </div>
          <p className="table-note">
            <Glossed
              text={
                "Each measure’s latest reading, ranked by value rather than by change. The " +
                "MOD-IV assessment records and HUD’s CHAS tables are single snapshots, so " +
                "they appear only here."
              }
              defined={defined}
            />
          </p>
          <CurrentValues levels={packet.levels} placement={values} defined={defined} />
          <TableNotes placement={values} above="the figures above" />
        </section>
      )}
    </main>
  );
}
