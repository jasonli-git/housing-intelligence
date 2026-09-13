import Link from "next/link";

import { CostToOwn } from "@/components/CostToOwn";
import { CurrentValues } from "@/components/CurrentValues";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Definition, Glossed } from "@/components/Glossed";
import { Ledger, TableNotes } from "@/components/Ledger";
import { TrendsExplorer } from "@/components/TrendsExplorer";
import {
  api,
  nationalMortgageRate,
  type PacketLevel,
  type PacketMetric,
  type Region,
  regionsWithData,
} from "@/lib/api";
import { placeCaveats, scopesFor } from "@/lib/caveats";
import { formatMetric } from "@/lib/format";
import type { Term } from "@/lib/glossary";
import { groupRows } from "@/lib/groups";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { periodLabel, surveyYears } from "@/lib/periods";
import { housingProfile, paychecks, rankBasisExample, tradeoff, verdict } from "@/lib/verdict";

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

/** The national 30-year rate, labelled for a reader; fetched once per worker (`lib/api.ts`). */
async function mortgageRate() {
  const rate = await nationalMortgageRate();
  return rate ? { value: rate.value, asOf: periodLabel(rate.period_start) } : null;
}

/** Why a region has no tax bill, in a reader's terms. */
function noTaxReason(level: string): string {
  return level === "zip"
    ? "Property tax is not included: New Jersey’s assessment records give it by " +
        "municipality and county, not by ZIP code."
    : "Property tax is not included: this municipality’s assessment records could not " +
        "be matched to it by name.";
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
  const [region, packet, summary, explanations, rate] = await Promise.all([
    api.region(regionId),
    api.packet(regionId, WINDOW),
    api.summary(regionId, WINDOW),
    api.explanations(regionId, WINDOW),
    mortgageRate(),
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

  // The answers above the tables (Milestone 17), each from figures the tables carry.
  const peers = { name, count: peer_count, noun: peerNoun(peer_level), scope: scopeName(peer_scope) };
  const lead = verdict(peers, packet.metrics, packet.levels);
  const paid = paychecks(packet.metrics);
  const trade = tradeoff(peers, packet.levels);
  const profile = housingProfile(packet.levels);
  const rankExample = rankBasisExample(name, packet.metrics, packet.levels);

  // The cost to own needs a current market value, so it stands on Zillow's index only:
  // the ACS's owner-reported value is a survey five years old, and a monthly payment on
  // it would describe a market that has moved on.
  const level = (metricId: string) => packet.levels.find((l) => l.metric_id === metricId);
  const dated = (row: PacketLevel | undefined) =>
    row ? { value: row.value, asOf: periodLabel(row.period_end, row.metric_id) } : null;
  const home = dated(level("zhvi_sfr"));
  const taxBill = dated(level("modiv_median_tax_bill"));

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
          {lead && <p className="verdict">{lead}</p>}
          {trade && <p className="verdict-more">{trade}</p>}
          {/* On request, after the owner's review: the verdict is the answer, and the
              paychecks comparison is the reading a reader chooses to go on to. */}
          {paid && (
            <details className="verdict-details">
              <summary className="disclose">
                <span className="verdict-details-label">Did paychecks keep up?</span>
                <span className="disclose-hint">
                  <span className="when-closed">Details</span>
                  <span className="when-open">Hide</span>
                </span>
              </summary>
              <p className="verdict-more">{paid}</p>
            </details>
          )}
          {/* Said outright, and never folded away, because the interpretation panel beside
              it is model-written and a reader should not have to guess which this is (#139). */}
          {lead && (
            <p className="verdict-source">
              Computed from the figures on this page by fixed rules, not written by AI.
            </p>
          )}
          {profile.length > 0 && (
            <p className="profile">
              <span className="eyebrow">The housing</span>
              {profile.map((item) => (
                <span key={item.metric_id}>
                  <Definition
                    term={{
                      key: `profile-${item.metric_id}`,
                      title: item.label,
                      phrases: [],
                      definition: item.definition,
                    }}
                  >
                    {item.label}
                  </Definition>{" "}
                  <b>{item.value}</b>
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="actions">
          <Link className="button" href={`/regions/${regionId}/report`}>
            Report
          </Link>
        </div>
      </header>

      {home && rate && (
        <CostToOwn
          home={home}
          rate={rate}
          tax={taxBill}
          rent={dated(level("zori_all"))}
          noTax={taxBill ? null : noTaxReason(region.level)}
        />
      )}

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
              Ranked by change over five years, not by price or size: rank 1 is the largest
              rise, or the smallest where lower is better, as for unemployment.
              {rankExample && ` ${rankExample}`}
            </p>
          )}
        </div>
        <ExplanationPanel explanations={readings} />
      </div>

      {trends.length > 0 && (
        <section className="section" aria-labelledby="trends-heading">
          <h2 id="trends-heading">Trends</h2>
          <TrendsExplorer
            series={trends.map(({ metricId, observations }) => {
              const meta = findSeries(packet.metrics, packet.levels, metricId);
              const unit = meta?.unit ?? "";
              return {
                metricId,
                title: meta?.label ?? metricId,
                unit,
                // The end date alone: it is all the charts and the lines read (#148).
                points: observations.map((o) => ({ period_end: o.period_end, value: o.value })),
                // Keyed: it rides in a list of series into a client component, and React
                // asks every element created in a list for a key.
                table: (
                  <details key={metricId}>
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
                                <td className="nowrap">{periodLabel(o.period_end, metricId)}</td>
                                <td className="num">{formatMetric(o.value, unit, metricId)}</td>
                                <td>{o.source_id}</td>
                                <td>{o.match_method}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ),
              };
            })}
          />
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
                "Each measure’s latest reading, ranked by value rather than by change: rank 1 " +
                "is the highest, or the lowest where lower is better. The MOD-IV assessment " +
                "records and HUD’s CHAS tables are single snapshots, so they appear only here."
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
