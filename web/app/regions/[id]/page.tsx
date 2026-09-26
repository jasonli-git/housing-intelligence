import Link from "next/link";

import { CostToOwn } from "@/components/CostToOwn";
import { ComputedBadge } from "@/components/ComputedBadge";
import { CountyModeWorkspace } from "@/components/CountyModeWorkspace";
import { Crumbs, Kind, kindOf } from "@/components/Crumbs";
import { CurrentValues } from "@/components/CurrentValues";
import { Definition } from "@/components/Definition";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Glossed } from "@/components/Glossed";
import { ProfileTicker } from "@/components/StateProfileTicker";
import { Ledger, TableNotes } from "@/components/Ledger";
import { MoreExpander } from "@/components/MoreExpander";
import { Masthead } from "@/components/Masthead";
import { RankOverview } from "@/components/RankOverview";
import { RegionStandOuts } from "@/components/RegionStandOuts";
import { TrendsExplorer } from "@/components/TrendsExplorer";
import { api, type PacketLevel, type PacketMetric, type Region, regionsWithData } from "@/lib/api";
import { placeCaveats, scopesFor } from "@/lib/caveats";
import { affordData, affordabilityForCounty } from "@/lib/affordData";
import { costInputs, homePrice } from "@/lib/costInputs";
import { formatMetric } from "@/lib/format";
import type { Term } from "@/lib/glossary";
import { groupRows } from "@/lib/groups";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { periodLabel, surveyYears } from "@/lib/periods";
import { standOuts } from "@/lib/standouts";
import {
  housingProfile,
  type PaycheckAnswer,
  paycheckAnswers,
  paychecks,
  rankBasisExample,
  tradeoff,
  verdict,
} from "@/lib/verdict";

// The only window published per region, and the only one with explanations
// (`manifest.json` → `windows`). Stated on the page rather than offered as a control,
// because a control with one working option is a promise the data cannot keep
// (ARCHITECTURE #125).
const WINDOW = "5y";

// The series worth plotting on a region page, in the order a reader wants them, and what
// a sentence calls each.
const TREND_METRICS = [
  { metricId: "zhvi_sfr", short: "home values" },
  { metricId: "zori_all", short: "rent" },
  { metricId: "acs_median_hh_income", short: "household income" },
];

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

function listed(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function findSeries(metrics: PacketMetric[], levels: PacketLevel[], metricId: string) {
  return metrics.find((m) => m.metric_id === metricId) ?? levels.find((l) => l.metric_id === metricId);
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
 * housing is like — then one expander holding every table, the trends and the full
 * interpretation, for the reader who wants the whole picture. The stand-outs lead in place
 * of the tables because they are the tables' news; the tables are one click away, and
 * remembered open for a reader who opens them.
 */
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
      <>
        <Masthead affordability={{ kind: "route" }} />
        <main className="shell">
          <h1 className="page-title">Region not found</h1>
          <p className="meta">
            No region {id}, or the API is unreachable. <Link href="/">Back to New Jersey</Link>.
          </p>
        </main>
      </>
    );
  }

  const [series, cost, affordability] = await Promise.all([
    Promise.all(
      TREND_METRICS.map(async ({ metricId, short }) => ({
        metricId,
        short,
        observations: (await api.observations(regionId, metricId))?.observations ?? [],
      })),
    ),
    costInputs(region.level, packet.levels, packet.metrics),
    region.level === "county"
      ? affordData().then((data) => data ? affordabilityForCounty(data, regionId) : null)
      : Promise.resolve(null),
  ]);
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
  const answers = paycheckAnswers(packet.metrics);
  const trade = tradeoff(peers, packet.levels);
  // Population is promoted to the page head, where it can orient the reader without
  // repeating the same figure in the compact housing profile immediately below.
  const profile = housingProfile(packet.levels, packet.metrics).filter(
    (item) => item.metric_id !== "acs_population",
  );
  const standing = standOuts(packet);
  const rankExample = rankBasisExample(name, packet.metrics, packet.levels);
  const rankChartCount =
    Number(packet.metrics.some((row) => row.rank !== null && row.of !== null && row.of > 1)) +
    Number(packet.levels.some((row) => row.rank !== null && row.of !== null && row.of > 1));

  // One set per page: each glossary term is marked the first time it appears.
  const defined = new Set<string>();
  const order = <T extends { metric_id: string }>(rows: T[]) =>
    groupRows(rows).flatMap((section) => section.rows.map((row) => row.metric_id));
  const placement = placeCaveats(
    [order(packet.metrics), order(packet.levels)],
    scopesFor(packet.caveats, summary?.caveat_scopes ?? []),
  );
  const [changes, values] = placement.tables;

  // What the expander holds, said on it, so a reader knows what one click opens.
  const contents = [
    packet.metrics.length > 0 ? `${packet.metrics.length} figures ranked by change` : null,
    packet.levels.length > 0 ? `${packet.levels.length} current values` : null,
    trends.length + rankChartCount > 0
      ? `${trends.length + rankChartCount} ${trends.length + rankChartCount === 1 ? "chart" : "charts"}`
      : null,
    readings.length > 1 ? `${readings.length} models’ readings` : readings.length === 1 ? "a model’s reading" : null,
  ].filter((part): part is string => part !== null);
  const moreTitle =
    readings.length > 0
      ? "Every table, the trends and the interpretation"
      : trends.length > 0
        ? "Every table and the trends"
        : "Every table";
  const affordabilityControl = region.level === "county"
    ? { kind: "local" as const, fallbackHref: `/afford?place=${regionId}` }
    : region.level === "zip"
      ? {
          kind: "disabled" as const,
          reason: "Affordability mode is not available for ZIP code profiles",
        }
      : { kind: "route" as const };

  return (
    <>
      <Masthead affordability={affordabilityControl} />
      <main className="shell">
      <header className="page-head" data-kind={kindOf(region.level)}>
        <div className="region-head-main">
          <Crumbs
            trail={[
              { href: "/", label: "New Jersey" },
              ...(county ? [{ href: `/regions/${county.region_id}`, label: displayName(county) }] : []),
            ]}
            here={name}
          />
          {population && (
            <aside className="population-summary" aria-label="Population">
              <span className="population-summary-label">Population</span>
              <strong>
                {formatMetric(population.value, population.unit, population.metric_id)}
              </strong>
              <span className="population-summary-context">
                <Definition term={asOfTerm(population, Boolean(populationChange))}>
                  {periodLabel(population.period_end)} estimate
                </Definition>
                {populationChange && <> · {changeWords(populationChange.pct_change)}</>}
              </span>
            </aside>
          )}
          <Kind kind={kindOf(region.level)} />
          <div className="page-title-row">
            <h1 className="page-title">{name}</h1>
            <ComputedBadge />
          </div>
          <p className="meta">
            {placeLine(region)}
            {" · "}every figure ranked against {scopeName(peer_scope)}’s {peer_count}{" "}
            {peerNoun(peer_level)}
          </p>
          {lead && <p className="verdict">{lead}</p>}
          {trade && <p className="verdict-more">{trade}</p>}
          {/* The short answers in the line, the sentences behind them a click away: the
              answer is what a reader came for, the working what some go on to. */}
          {paid && answers && (
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
          <Link className="button report-action" href={`/regions/${regionId}/report`}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5.5 2.75h6l3 3v11.5h-9Z" />
              <path d="M11.5 2.75v3h3M8 9h4M8 12h4" />
            </svg>
            <span className="report-action-copy">
              <strong>Open full report</strong>
              <small>Print-ready detail</small>
            </span>
            <span className="report-action-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <ProfileTicker
        items={profile}
        title="Housing here"
        ariaLabel={`${name} housing profile`}
        className="region-profile-ticker"
        peerLabel={peerNoun(peer_level)}
      />

      {region.level === "county" && (
        <CountyModeWorkspace countyId={regionId} countyName={name} afford={affordability} />
      )}

      <div className="region-standard-content">

      {cost ? (
        <CostToOwn {...cost} />
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

      <RegionStandOuts
        name={name}
        peers={`${scopeName(peer_scope)}’s ${peer_count} ${peerNoun(peer_level)}`}
        items={standing}
      />

      <MoreExpander title={moreTitle} sub={`For the full picture: ${listed(contents)}.`}>
        <RankOverview
          changes={packet.metrics}
          values={packet.levels}
          peerLabel={peerNoun(peer_level)}
        />

        <section className="section" aria-labelledby="ledger-heading">
          <h2 id="ledger-heading">Every figure, ranked by change over five years</h2>
          {packet.metrics.length > 0 ? (
            <Ledger
              metrics={packet.metrics}
              placement={changes}
              defined={defined}
              regionLabel={name}
              sources={packet.sources}
              path={`/regions/${id}`}
            />
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
        </section>

        {trends.length > 0 && (
          <section className="section" aria-labelledby="trends-heading">
            <h2 id="trends-heading">Trends</h2>
            <TrendsExplorer
              series={trends.map(({ metricId, short, observations }) => {
                const meta = findSeries(packet.metrics, packet.levels, metricId);
                const unit = meta?.unit ?? "";
                return {
                  metricId,
                  title: meta?.label ?? metricId,
                  short,
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
            <CurrentValues
              levels={packet.levels}
              placement={values}
              defined={defined}
              regionLabel={name}
              sources={packet.sources}
              path={`/regions/${id}`}
            />
            <TableNotes placement={values} above="the figures above" />
          </section>
        )}

        {/* Whole, with no "Read the rest": opening the expander was the choice to read on. */}
        {readings.length > 0 && (
          <div className="section">
            <ExplanationPanel explanations={readings} whole />
          </div>
        )}
      </MoreExpander>
      </div>
      </main>
    </>
  );
}
