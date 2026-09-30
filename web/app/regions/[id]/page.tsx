import Link from "next/link";

import { CostToOwn } from "@/components/CostToOwn";
import { ComputedBadge } from "@/components/ComputedBadge";
import { CountyModeWorkspace } from "@/components/CountyModeWorkspace";
import { Crumbs, Kind, kindOf } from "@/components/Crumbs";
import { CurrentValues } from "@/components/CurrentValues";
import { DataDownload } from "@/components/DataDownload";
import { ConsumerReading, ExplanationPanel } from "@/components/ExplanationPanel";
import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import { IndexedComparison } from "@/components/IndexedComparison";
import { Glossed } from "@/components/Glossed";
import { ProfileTicker } from "@/components/StateProfileTicker";
import { Ledger, Margin, TableNotes } from "@/components/Ledger";
import { AnalystReadingJump, DetailedDataJump, MoreExpander } from "@/components/MoreExpander";
import { Masthead } from "@/components/Masthead";
import { RankOverview } from "@/components/RankOverview";
import { RegionStandOuts } from "@/components/RegionStandOuts";
import { TrendsExplorer } from "@/components/TrendsExplorer";
import { api, type PacketLevel, type PacketMetric, type Region, regionsWithData } from "@/lib/api";
import { indexedComparison } from "@/lib/chartInsights";
import { placeCaveats, scopesFor } from "@/lib/caveats";
import { affordData, affordabilityForCounty } from "@/lib/affordData";
import { costInputs, homePrice } from "@/lib/costInputs";
import { formatMetric } from "@/lib/format";
import type { Term } from "@/lib/glossary";
import { groupRows } from "@/lib/groups";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { periodLabel, surveyYears } from "@/lib/periods";
import { standOuts } from "@/lib/standouts";
import { firstEnd } from "@/lib/ranks";
import {
  anyMargin,
  changeMarginLabel,
  MARGIN_NOTE,
  marginLabel,
  NO_MARGIN,
  NO_SAMPLING_ERROR,
  uncertaintiesFrom,
} from "@/lib/uncertainty";
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
 * The population's date and uncertainty, defined in its badge. An ACS five-year estimate
 * is not a count on a date; the badge's change and its sampling caveat belong together.
 */
function asOfTerm(
  population: PacketLevel,
  compared: boolean,
  valueMargin: string | null,
  changeMargin: string | null,
): Term {
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
      (compared ? "The percentage in this badge compares it with the figure five years earlier. " : "") +
      [marginNote, changeMarginNote].filter(Boolean).join(" "),
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
 * housing is like — then separate disclosures for the automated summary and the full data.
 * The stand-outs lead in place of the tables because they are the tables' news; the tables
 * are one click away, and remembered open for a reader who opens them.
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
  const indexedInputs = trends.map(({ metricId, short, observations }) => ({
    metricId,
    label: short,
    points: observations.map((o) => ({ date: o.period_end, value: o.value })),
  }));

  const name = displayName(region);
  const county = region.ancestors.find((a) => a.level === "county");
  // One reading per audience since Milestone 30. A response published before it has no
  // `audience`, and every reading then was an analyst's.
  const readings = explanations?.explanations ?? [];
  const analyst = readings.find((r) => (r.audience ?? "analyst") === "analyst") ?? null;
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
  const paid = paychecks(packet.metrics);
  const answers = paycheckAnswers(packet.metrics);
  const trade = tradeoff(peers, packet.levels, uncertainties);
  // Population is promoted to the page head, where it can orient the reader without
  // repeating the same figure in the compact housing profile immediately below.
  const profile = housingProfile(packet.levels, packet.metrics, uncertainties).filter(
    (item) => item.metric_id !== "acs_population",
  );
  const standing = standOuts(packet, uncertainties);
  const changePreview = standing.find((item) => item.group === "leads")
    ?? standing.find((item) => item.group === "lags");
  const valuePreview = standing.find((item) => item.group === "value" && item.metric_id !== changePreview?.metric_id)
    ?? standing.find((item) => item.group === "value");
  const changePreviewMetric = packet.metrics.find((metric) => metric.metric_id === changePreview?.metric_id);
  const standoutMeasureCount = new Set(standing.map((item) => item.metric_id)).size;
  const rankExample = rankBasisExample(name, packet.metrics, packet.levels, uncertainties);
  const rankChartCount =
    Number(packet.metrics.some((row) => row.rank !== null && row.of !== null && row.of > 1)) +
    Number(packet.levels.some((row) => row.rank !== null && row.of !== null && row.of > 1));
  const hasIndexedComparison = indexedComparison(indexedInputs) !== null;
  const chartCount = trends.length + rankChartCount + Number(hasIndexedComparison);

  // One set per page: each glossary term is marked the first time it appears.
  const defined = new Set<string>();
  const order = <T extends { metric_id: string }>(rows: T[]) =>
    groupRows(rows).flatMap((section) => section.rows.map((row) => row.metric_id));
  const placement = placeCaveats(
    [order(packet.metrics), order(packet.levels)],
    scopesFor(packet.caveats, summary?.caveat_scopes ?? []),
  );
  const [changes, values] = placement.tables;

  // What the data expander holds, said on it, so a reader knows what one click opens.
  const contents = [
    packet.metrics.length > 0 ? `${packet.metrics.length} figures ranked by change` : null,
    packet.levels.length > 0 ? `${packet.levels.length} current values` : null,
    chartCount > 0
      ? `${chartCount} ${chartCount === 1 ? "chart" : "charts"}`
      : null,
  ].filter((part): part is string => part !== null);
  const moreTitle =
    trends.length > 0 ? "Every table and the trends" : "Every table";
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
      <main className="shell atlas-page atlas-local">
      <header className="page-head" data-kind={kindOf(region.level)}>
        <div className="region-head-main">
          <Crumbs
            trail={[
              { href: "/", label: "New Jersey" },
              ...(county ? [{ href: `/regions/${county.region_id}`, label: displayName(county) }] : []),
            ]}
            here={name}
          />
          <div className="page-head-eyebrow">
            <Kind kind={kindOf(region.level)} />
            {population && (
              <aside className="population-badge" aria-label="Population">
                <span className="population-badge-label">Population</span>
                <strong>{formatMetric(population.value, population.unit, population.metric_id)}</strong>
                {populationChange && (
                  <span className="population-badge-change">{changeWords(populationChange.pct_change)}</span>
                )}
                <span className="population-badge-year">
                  <FloatingMetricTerm
                    metricId={population.metric_id}
                    label={`${periodLabel(population.period_end)} estimate`}
                    definition={asOfTerm(
                      population,
                      Boolean(populationChange),
                      populationMargin,
                      populationChangeMargin,
                    ).definition}
                    why={null}
                  />
                </span>
              </aside>
            )}
          </div>
          <div className="page-title-row">
            <h1 className="page-title">{name}</h1>
            <ComputedBadge />
          </div>
          {/* Every rank names its own cohort now — "12th of 21 NJ counties" — so the
              line that named it once for the whole page is gone (Milestone 28). */}
          <p className="meta">{placeLine(region)}</p>
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
          <DetailedDataJump targetId="region-detailed-data" />
          {analyst && <AnalystReadingJump targetId="region-analyst-reading" />}
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
        <CostToOwn
          {...cost}
          beforeMoving={<ConsumerReading reading={consumer} section="before_moving" />}
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

      {/* Keep the interpretation visible even when no cost card can be calculated. */}
      {!cost && <ConsumerReading reading={consumer} section="before_moving" />}

      {/* The model's change reading leads into, but does not author, the computed ranks. */}
      <ConsumerReading reading={consumer} section="whats_changing" />

      {standing.length > 0 && (
        <details className="standouts-disclosure">
          <summary>
            <span className="standouts-disclosure-copy">
              <span className="standouts-disclosure-kicker">Computed rankings</span>
              <strong>See where {name} stands out</strong>
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
        </details>
      )}

      {analyst && (
        <details id="region-analyst-reading" className="analyst-disclosure">
          <summary>
            <span className="analyst-disclosure-copy">
              <span className="analyst-disclosure-kicker">Model-written reading</span>
              <strong>Automated data summary</strong>
              <span className="analyst-disclosure-hint">A detailed digest of the reported figures</span>
            </span>
            <span className="analyst-disclosure-icon" aria-hidden="true">+</span>
          </summary>
          <div className="analyst-disclosure-body">
            <ExplanationPanel reading={analyst} whole />
          </div>
        </details>
      )}

      <MoreExpander id="region-detailed-data" title={moreTitle} sub={`For the full picture: ${listed(contents)}.`}>
        <p className="data-download-line">
          <DataDownload regionId={regionId} geoid={region.geoid} window={WINDOW} />
          <span> — every figure below, with its kind, source and licence.</span>
        </p>
        <RankOverview
          changes={packet.metrics}
          values={packet.levels}
          peerLabel={peerNoun(peer_level)}
          uncertainties={uncertainties}
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
              uncertainties={uncertainties}
              peers={peers}
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
          {anyMargin(uncertainties) && <p className="table-note">{MARGIN_NOTE}</p>}
        </section>

        {trends.length > 0 && (
          <section className="section" aria-labelledby="trends-heading">
            <h2 id="trends-heading">Trends</h2>
            <IndexedComparison series={indexedInputs} />
            {hasIndexedComparison && (
              <div className="trend-detail-intro">
                <h3>Explore each measure</h3>
                <p>The year below changes only the individual charts, not the comparison above.</p>
              </div>
            )}
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
                  points: observations.map((o) => ({
                    period_end: o.period_end,
                    value: o.value,
                    margin: o.margin_of_error ?? null,
                  })),
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
                                  <td className="num">
                                    {formatMetric(o.value, unit, metricId)}
                                    <Margin
                                      label={marginLabel(
                                        o.value,
                                        o.margin_of_error ?? null,
                                        unit,
                                        metricId,
                                      )}
                                    />
                                  </td>
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
              uncertainties={uncertainties}
              peers={peers}
            />
            <TableNotes placement={values} above="the figures above" />
          </section>
        )}

      </MoreExpander>
      </div>
      </main>
    </>
  );
}
