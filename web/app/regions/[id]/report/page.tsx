import Link from "next/link";
import { Fragment } from "react";

import { CostToOwn } from "@/components/CostToOwn";
import { Crumbs, Kind } from "@/components/Crumbs";
import { ChangeCell, Marks, NoteRows, RankText, TableNotes } from "@/components/Ledger";
import { MetricTerm } from "@/components/MetricTerm";
import { Masthead } from "@/components/Masthead";
import { PrintButton } from "@/components/PrintButton";
import { StandOuts } from "@/components/StandOuts";
import { api, artifactUrl, type Packet, regionsWithData } from "@/lib/api";
import { placeCaveats, scopesFor } from "@/lib/caveats";
import { costInputs } from "@/lib/costInputs";
import { formatMetric } from "@/lib/format";
import { groupRows } from "@/lib/groups";
import { displayName, peerNoun, scopeName } from "@/lib/names";
import { periodLabel, windowLabel } from "@/lib/periods";
import { RANK_HEADING, rankWords } from "@/lib/ranks";
import { isRestricted } from "@/lib/sources";
import { standOuts } from "@/lib/standouts";
import { paychecks, tradeoff, verdict } from "@/lib/verdict";

const WINDOW = "5y";

/** IRS migration vintages are tax-year pairs: "1718" is 2017–18. */
function vintage(sourceId: string, value: string): string {
  return sourceId === "irs_migration" && /^\d{4}$/.test(value)
    ? `20${value.slice(0, 2)}–${value.slice(2)}`
    : value;
}

type SourceGroup = {
  source_id: string;
  name: string;
  publisher: string;
  license: string;
  vintages: string[];
  fetched: string;
};

/** A packet's releases folded to one row per source, its vintages listed together. */
function bySource(sources: Packet["sources"]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const s of sources) {
    const group = groups.get(s.source_id) ?? {
      source_id: s.source_id,
      name: s.name,
      publisher: s.publisher,
      license: s.license,
      vintages: [],
      fetched: s.fetched_at,
    };
    group.vintages.push(vintage(s.source_id, s.vintage));
    if (s.fetched_at > group.fetched) group.fetched = s.fetched_at;
    groups.set(s.source_id, group);
  }
  return [...groups.values()];
}

/**
 * Which region reports exist: every region carrying data except the state, whose page
 * folded into the New Jersey page (ARCHITECTURE #127).
 *
 * Under `output: "export"` this is what tells Next how many pages to write; without it
 * a dynamic segment has no enumeration and the export fails.
 */
export async function generateStaticParams() {
  const regions = await regionsWithData();
  return regions.filter((r) => r.level !== "state").map((r) => ({ id: String(r.region_id) }));
}

/**
 * The exportable region report, laid out from the analysis packet.
 *
 * The same packet the API serves and `hip pack` writes, rendered for a screen and a
 * sheet of paper instead of for a model. That is the point of the contract: two media,
 * one source of numbers, no second query path to keep in step. The Markdown export
 * below is the same packet through `hip.packets.report` — and since that rendering is
 * also a model's prompt, it keeps its own formatting (shares as ratios) while this page
 * shows them as percentages (ARCHITECTURE #124).
 *
 * Caveats are lettered on the rows they qualify and set out under each table, which is
 * where "beside the figure" lands on paper (#123). The scopes come from the summary; the
 * packet stays the authority on which caveats appear.
 *
 * Since Milestone 23 it prints the region page's cost cards at the 20% default, with no
 * control, and the same stand-out cards; on screen it is set as a sheet of paper, the
 * report's own look among the page types (globals.css).
 */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const regionId = Number(id);
  const [packet, summary] = await Promise.all([
    api.packet(regionId, WINDOW),
    api.summary(regionId, WINDOW),
  ]);

  if (!packet) {
    return (
      <>
        <Masthead affordability={{ kind: "route" }} />
        <main className="shell report">
          <h1 className="page-title">No report</h1>
          <p className="meta">
            Region {id} has no analytics for the {WINDOW} window, or the API is unreachable.{" "}
            <Link href={`/regions/${id}`}>Back to the region</Link>.
          </p>
        </main>
      </>
    );
  }

  const { region, window, comparisons } = packet;
  const name = displayName(region);
  const measureSections = groupRows(packet.metrics);
  const levelSections = groupRows(packet.levels);
  const placement = placeCaveats(
    [
      measureSections.flatMap((s) => s.rows.map((m) => m.metric_id)),
      levelSections.flatMap((s) => s.rows.map((l) => l.metric_id)),
    ],
    scopesFor(packet.caveats, summary?.caveat_scopes ?? []),
  );
  const [measures, current] = placement.tables;
  const sources = bySource(packet.sources);
  const sourceNames = new Map(sources.map((s) => [s.source_id, s.name]));
  const restricted = sources.filter(isRestricted).map((s) => s.name);
  // The region page's answers, printed with the report (Milestone 17).
  const peers = {
    name,
    count: comparisons.peer_count,
    noun: peerNoun(comparisons.peer_level),
    scope: scopeName(comparisons.peer_scope),
  };
  const lead = verdict(peers, packet.metrics, packet.levels);
  const paid = paychecks(packet.metrics);
  const trade = tradeoff(peers, packet.levels);
  const cost = await costInputs(region.level, packet.levels, packet.metrics);

  return (
    <>
      <Masthead affordability={{ kind: "route" }} />
      <main className="shell report">
      <header className="page-head" data-kind="report">
        <div>
          <Crumbs
            trail={[
              { href: "/", label: "New Jersey" },
              ...(region.parent && region.parent.level !== "state"
                ? [{ href: `/regions/${region.parent.region_id}`, label: displayName(region.parent) }]
                : []),
              { href: `/regions/${regionId}`, label: name },
            ]}
            here="Report"
          />
          <Kind kind="report" />
          {/* A no-break space before the dash, so a wrapped title never starts a line with it. */}
          <h1 className="page-title">{region.label}&nbsp;— housing report</h1>
          <p className="meta">
            {packet.metrics.length} measures over the five-year change window, each ranked
            against {scopeName(comparisons.peer_scope)}’s {comparisons.peer_count}{" "}
            {peerNoun(comparisons.peer_level)}.
          </p>
          <p className="muted">
            {/* The envelope, not a span every metric covers: sources publish at different
                frequencies, so each metric resolves the window to its own dates. The
                table gives them. */}
            Between them the measures reach from {periodLabel(window.start)} to{" "}
            {periodLabel(window.end)}; each covers its own window, given in the table.
          </p>
          {lead && <p className="verdict">{lead}</p>}
          {paid && <p className="verdict-more">{paid}</p>}
          {trade && <p className="verdict-more">{trade}</p>}
          {lead && (
            <p className="verdict-source">
              Computed from the figures in this report by fixed rules, not written by AI.
            </p>
          )}
        </div>
        <div className="actions print-hide">
          <PrintButton />
          {/*
            The published artifact path, not the API's. A static file cannot vary on
            `?window=`, so `hip publish` writes the window as a path segment; this href
            has to name the file that actually exists. In development both origins
            default to the local API, where this path is served by `hip publish`'s
            output rather than by FastAPI — so check the link against a published tree,
            not against `make api`.
          */}
          <a
            className="button"
            href={`${artifactUrl}/regions/${regionId}/report/${WINDOW}.md`}
            download={`${region.geoid}.md`}
          >
            Download Markdown
          </a>
        </div>
      </header>

      {cost && <CostToOwn {...cost} control={false} />}

      <StandOuts
        name={name}
        peers={`${scopeName(comparisons.peer_scope)}’s ${comparisons.peer_count} ${peerNoun(comparisons.peer_level)}`}
        items={standOuts(packet)}
      />

      <section className="section">
        <h2>Measures</h2>
        <div className="scroll-x">
          <table className="doc">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">Start</th>
                <th scope="col" className="num">Latest</th>
                <th scope="col" className="num">Change</th>
                <th scope="col" className="num">Per year</th>
                <th scope="col" className="num">{RANK_HEADING.change}</th>
                <th scope="col">Window</th>
              </tr>
            </thead>
            {measureSections.map((section) => (
              <tbody key={section.key}>
                <tr className="group">
                  <th colSpan={7} scope="colgroup">
                    {section.title}
                  </th>
                </tr>
                {section.rows.map((m) => (
                  <Fragment key={m.metric_id}>
                    <tr className={measures.inline.has(m.metric_id) ? "has-note" : undefined}>
                      <td>
                        <MetricTerm metricId={m.metric_id} label={m.label} scope="report-measures" />
                        <Marks letters={measures.marks.get(m.metric_id)} />
                      </td>
                      <td className="num">{formatMetric(m.start_value, m.unit, m.metric_id)}</td>
                      <td className="num">{formatMetric(m.end_value, m.unit, m.metric_id)}</td>
                      <ChangeCell pct={m.pct_change} className="num" />
                      <td className="num">{m.cagr === null ? "—" : `${m.cagr.toFixed(1)}%/yr`}</td>
                      <td className="num">
                        {m.rank === null || m.of === null ? (
                          "—"
                        ) : (
                          <RankText
                            rank={m.rank}
                            of={m.of}
                            words={rankWords(m.rank, m.of, "change", m.direction)}
                          />
                        )}
                      </td>
                      <td className="when">
                        {windowLabel(m.window_start, m.window_end, m.metric_id)}
                      </td>
                    </tr>
                    <NoteRows id={m.metric_id} texts={measures.inline.get(m.metric_id)} span={7} />
                  </Fragment>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <TableNotes placement={measures} general={placement.general} above="the table above" />
        <p className="table-note">
          Ranked by change over five years, not by price or size: rank 1 is the largest
          rise, or the smallest where lower is better, as for unemployment.
        </p>
      </section>

      {packet.levels.length > 0 && (
        <section className="section">
          <h2>Current values</h2>
          <p className="table-note">
            Ranked by value rather than by change. HUD’s CHAS tables and the MOD-IV
            assessment records are single snapshots, so they appear only here.
          </p>
          <div className="scroll-x">
            <table className="doc">
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col" className="num">Value</th>
                  <th scope="col" className="num">{RANK_HEADING.value}</th>
                  <th scope="col">As of</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              {levelSections.map((section) => (
                <tbody key={section.key}>
                  <tr className="group">
                    <th colSpan={5} scope="colgroup">
                      {section.title}
                    </th>
                  </tr>
                  {section.rows.map((l) => (
                    <Fragment key={l.metric_id}>
                      <tr className={current.inline.has(l.metric_id) ? "has-note" : undefined}>
                        <td>
                          <MetricTerm metricId={l.metric_id} label={l.label} scope="report-values" />
                          <Marks letters={current.marks.get(l.metric_id)} />
                        </td>
                        <td className="num">{formatMetric(l.value, l.unit, l.metric_id)}</td>
                        <td className="num">
                          {l.rank === null || l.of === null ? (
                            "—"
                          ) : (
                            <RankText
                              rank={l.rank}
                              of={l.of}
                              words={rankWords(l.rank, l.of, "value", l.direction)}
                            />
                          )}
                        </td>
                        <td className="when">{periodLabel(l.period_end, l.metric_id)}</td>
                        <td>{(l.source_id && sourceNames.get(l.source_id)) ?? l.source_id ?? "—"}</td>
                      </tr>
                      <NoteRows id={l.metric_id} texts={current.inline.get(l.metric_id)} span={5} />
                    </Fragment>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <TableNotes placement={current} above="the table above" />
        </section>
      )}

      <section className="section">
        <h2>Sources</h2>
        <div className="scroll-x">
          <table className="doc">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Publisher</th>
                <th scope="col">Vintages</th>
                <th scope="col">Retrieved</th>
                <th scope="col">Licence</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source_id}>
                  <td>{s.name}</td>
                  <td>{s.publisher}</td>
                  <td className="when">{s.vintages.join(", ")}</td>
                  <td className="when">{s.fetched.slice(0, 10)}</td>
                  <td>{s.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* The report's own copy of the terms: a printout leaves the licence line behind
            with the rest of the site, and a forwarded PDF is the copy most likely to
            reach someone who never saw the site. */}
        {restricted.length > 0 && (
          <p className="restriction licence-box">
            <strong className="licence-label">Not for commercial use</strong>
            <span className="visually-hidden">: </span>
            <span className="licence-text">
              {restricted.join(" and ")} {restricted.length === 1 ? "is" : "are"} licensed
              for non-commercial use with attribution. Figures derived from{" "}
              {restricted.length === 1 ? "it" : "them"} — this report included — carry that
              restriction onward, and this site cannot grant terms it was not given.
            </span>
          </p>
        )}
      </section>

      <footer className="muted">
        Generated from analysis packet {packet.packet_version} for region {region.region_id}{" "}
        (GEOID {region.geoid}). Every figure is read from the housing warehouse and produced
        by the sources above, subject to the notes. Nothing in this report is model-generated.
      </footer>
      </main>
    </>
  );
}
